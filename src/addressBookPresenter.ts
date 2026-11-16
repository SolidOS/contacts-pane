import { NamedNode, Statement } from 'rdflib'
import { addPersonToGroup, groupMembers, getDataModelIssues } from './contactLogic'
import * as UI from 'solid-ui'
import { authn, store } from 'solid-logic'
import * as debug from './debug'
import { alertDialog, confirmDialog, getSameAs, deleteRecursive, deleteThingAndDoc } from './localUtils'
import { renderDeleteButton } from './components/delete-button'
import { groupMembership } from './groupMembershipControl'

const ns = UI.ns
const kb = store
let dom: any
let selectedGroups: any = {}
let ulPeople: any = null
let cardMain: any = null
let book: any = null
let dataBrowserContext: any = null

// ######## Group presenter

/** Point the presenter at the current address book and its shared elements.
 * The group bar renders itself now, so this only wires up the module state the
 * people list and its helpers still read.
 */
export function configureAddressBook ({ book: currentBook, dom: domElement, selectedGroups: groupsSelected, ulPeople: peopleUl, cardMain: cardMainEl, dataBrowserContext: context }: {
  book: NamedNode | null
  dom?: Document
  selectedGroups?: Record<string, boolean>
  ulPeople?: any
  cardMain?: any
  dataBrowserContext?: any
}) {
  if (domElement) dom = domElement
  if (groupsSelected) selectedGroups = groupsSelected
  if (peopleUl) ulPeople = peopleUl
  if (cardMainEl) cardMain = cardMainEl
  if (context) dataBrowserContext = context
  book = currentBook
}

/** How many contacts a group holds, or null while its document is unread.
 * An empty group still describes itself (type, fn), so "no statements at all"
 * is a reliable stand-in for "not fetched yet" -- and lets us show nothing
 * rather than a misleading 0.
 */
export function groupMemberCount (group: NamedNode): number | null {
  const loaded = kb.statementsMatching(null, null, null, group.doc()).length > 0

  return loaded ? groupMembers(kb, group).length : null
}

export async function handleURIsDroppedOnGroup (uris: string[], group: NamedNode) {
  for (const u of uris) {
    let thing: NamedNode | undefined = kb.sym(u)
    try {
      thing = await addPersonToGroup(thing, group)
    } catch (_e) {
      const msg = 'Error adding to group. Make sure you are adding a contact URI.'
      alertDialog(msg)
    }
    if (thing) refreshNames(ulPeople)
  }
}

export function groupsInOrder (book: any, options: any) {
  let sortMe: any[] = []
  if (options.foreignGroup) {
    sortMe.push([
      '',
      kb.any(options.foreignGroup, ns.vcard('fn')),
      options.foreignGroup
    ])
  }
  if (book) {
    const groupIndex = kb.any(book, ns.vcard('groupIndex')) as NamedNode | null
    const gs = book ? kb.each(book, ns.vcard('includesGroup'), null, groupIndex) : []
    const gs2 = gs.map((g: any) => [book, kb.any(g, ns.vcard('fn')), g])
    sortMe = sortMe.concat(gs2)
    sortMe.sort()
  }
  return sortMe.map(tuple => tuple[2])
}

export async function loadAllGroups (book: NamedNode | null): Promise<NamedNode[]> {
  const groupIndex = book && (kb.any(book, ns.vcard('groupIndex')) as NamedNode | null)
  if (groupIndex) {
    await kb.fetcher.load(groupIndex)
    const gs = (book ? kb.each(book, ns.vcard('includesGroup'), null, groupIndex) : []) as NamedNode[]
    await kb.fetcher.load(gs)
    return gs
  } else {
    return [] // no groups
  }
}

// The book could be the main subject, or linked from a group we are dealing with
export function findBookFromGroups (book: NamedNode | null): NamedNode {
  if (book) {
    return book
  }
  let g
  for (const gu in selectedGroups) {
    g = kb.sym(gu)
    const b = kb.any(undefined, ns.vcard('includesGroup'), g) as NamedNode | null
    if (b) return b
  }
  throw new Error(
    'findBookFromGroups: Cant find address book which this group is part of'
  )
}
// ######## Group presenter - END

// ######## Person presenter
/** Refresh the list of names.
 *
 * The list is the <contacts-pane-people-list> component now, which reads the
 * store itself; this remains the entry point the rest of the pane calls, and
 * falls back to the module variable for callers that don't hold the element.
 * `detailsView` is unused but kept so existing call sites stay valid.
 */
export function refreshNames (ulPeopleArg: any, detailsView: any = null, autoSelect = true) {
  const list = ulPeopleArg || ulPeople

  if (!list || typeof list.refresh !== 'function') {
    debug.warn('refreshNames called with invalid ulPeople:', list)
    return
  }

  list.refresh(autoSelect)
} // refreshNames

export function selectPerson (ulPeopleArg: any, person: NamedNode, details: any) {
  if (!details) return
  const list = ulPeopleArg || ulPeople
  if (list && typeof list.markSelected === 'function') {
    list.markSelected(person) // Color to remember which one you picked
  }
  details.showLoading({ wide: true })
  let local
  try {
    local = book ? localNode(person) : person
  } catch (err) {
    details.showError('Cannot load contact: ' + err.message)
    return
  }
  kb.fetcher.nowOrWhenFetched(local.doc(), undefined, (ok: boolean, message: string) => {
    if (!ok) {
      debug.error('Failed to load contact card: ' + local + '. Stack: ' + message)
      details.showError('Failed to load contact. If it persists, contact your admin.')
      return
    }

    details.showContent(renderPane(local, 'contact'), { wide: true, kind: 'contact' })
  })
}

/** Show the contact in a tab of its own -- the people list's menu asks for
 * this. Prefers the address book's own copy of the card, like the link icon
 * that used to sit above the contact did. */
export function openContactInNewWindow (person: NamedNode) {
  let local = person
  try {
    local = book ? localNode(person) : person
  } catch (_err) {
    // No book-local copy; the person's own URI is still worth opening.
  }
  window.open(local.uri, '_blank', 'noopener')
}

/** Confirm and delete a contact: its WebID references in every group, its
 * group memberships, and finally its card and folder. Raised by the people
 * list's per-row menu. */
export async function deleteContact (person: NamedNode) {
  const details = cardMain

  if (!(await confirmDialog('Really delete this contact?'))) return

  const container = person.dir() // ASSUMPTION THAT CARD IS IN ITS OWN DIRECTORY

  const pname = kb.any(person, ns.vcard('fn'))
  debug.log('We are about to delete the contact ' + pname)

  //  - delete person's WebID's in each Group
  //  - delete the references to it in group files and save them back
  //  - delete the reference in people.ttl and save it back

  let removeFromGroups: Statement[] = []
  try {
    await loadAllGroups(book) // need to wait for all groups to be loaded in case they have a link to this person
    // load people.ttl
    const nameEmailIndex = kb.any(book, ns.vcard('nameEmailIndex')) as NamedNode
    await kb.fetcher.load(nameEmailIndex)

    // find all Groups
    const groups = groupMembership(person)
    // find person WebID's
    groups.forEach((group: NamedNode) => {
      const webids = getSameAs(kb, person, group.doc())
      // for each check in each Group that it is not used by an other person then delete
      webids.forEach((webid: NamedNode) => {
        if (getSameAs(kb, webid, group.doc()).length === 1) {
          removeFromGroups = removeFromGroups.concat(kb.statementsMatching(group, ns.vcard('hasMember'), webid, group.doc()))
        }
      })
    })

    // Only if folder deletion succeeds, proceed with person deletion
    await kb.updater.updateMany(removeFromGroups)
  } catch (err) {
    // Without this the handler rejected silently and nothing at all happened
    debug.error('Error removing contact from its groups. Stack: ' + err)
    details?.showError('Failed to remove the contact from its groups. If it persists, contact your admin.')
    return
  }

  try {
    await deleteThingAndDoc(person)
  } catch (err) {
    details?.showError('Failed to delete contact. If it persists, contact your admin.')
    return
  }

  try {
    await deleteRecursive(kb, container)
  } catch (err) {
    details?.showError('Failed to delete contact. If it persists, contact your admin.')
    return
  }
  refreshNames(ulPeople, details)
  details?.showMessage('Contact data deleted.')
}

export function deselectAllPeople (ulPeopleArg: any) {
  const list = ulPeopleArg || ulPeople
  if (list && typeof list.clearSelection === 'function') {
    list.clearSelection()
  }
}

function renderPane (subject: NamedNode, paneName: string) {
  const p = dataBrowserContext.session.paneRegistry.byName(paneName)
  const d = p.render(subject, dataBrowserContext)
  d.classList.add('renderPane')
  return d
}

function localNode (person: NamedNode): NamedNode {
  const aliases = kb.allAliases(person)
  const prefix = book.dir().uri
  for (let i = 0; i < aliases.length; i++) {
    if (aliases[i].uri.slice(0, prefix.length) === prefix) {
      return aliases[i]
    }
  }
  throw new Error('No local URI for ' + person)
}

// Check every group is in the list and add it if not.
export async function checkDataModel (book: NamedNode | null, details: any) {
  // await kb.fetcher.load(groups) // asssume loaded already
  const groups = await loadAllGroups(book)

  if (groups && groups.length > 0) {
    const { del, ins } = await getDataModelIssues(groups)

    if (authn.currentUser()) {
      if (del.length) {
        const notice = dom.createElement('div')
        renderDeleteButton(
          dom,
          notice, // where it appends it to
          'contact',
          async () => {
            await kb.updater.updateMany(del, ins)
            debug.log('Deleted ' + del.length + ' bad statements from groups')
          },
          { message: 'Clean up ' + del.length + ' bad statement(s) in the group files?' })
        details.addNotice(notice)
      }
    }
  }
}

// Prepare book data once so askName forms load instantly
export async function ensureBookLoaded () {
  const ourBook = findBookFromGroups(book) as NamedNode
  try {
    await kb.fetcher.load(ourBook)
  } catch (err) {
    throw new Error('Book won\'t load:' + ourBook)
  }
  const nameEmailIndex = kb.any(ourBook, ns.vcard('nameEmailIndex')) as NamedNode | null
  if (!nameEmailIndex) throw new Error('No nameEmailIndex')
  await kb.fetcher.load(nameEmailIndex)
}
