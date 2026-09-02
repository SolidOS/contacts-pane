//  The logic behind the Tools view: maintenance and debugging routines for a
//  contacts database. Pure of DOM concerns -- each routine reports through a
//  `log` callback and asks questions through a `confirm` callback, so the
//  <contacts-pane-tools> component (or a test) decides how those look.
import * as UI from 'solid-ui'
import { store } from 'solid-logic'
import * as $rdf from 'rdflib'
import { NamedNode, Statement } from 'rdflib'
import { saveNewGroup, addPersonToGroup, groupMembers } from './contactLogic'
import { normalizeGroupUri } from './localUtils'
import * as debug from './debug'

const kb = store
const ns = UI.ns
const VCARD = ns.vcard

type Log = (message: string) => void
type Confirm = (message: string) => Promise<boolean>

/** Working state threaded through the duplicate scan. */
interface ScanState {
  book: NamedNode
  cards: NamedNode[]
  duplicates: NamedNode[]
  definitive: Record<string, NamedNode>
  nameless: NamedNode[]
  uniques: NamedNode[]
  uniqueSet: Record<string, boolean | NamedNode>
  uniquesSet: Record<string, boolean>
  [key: string]: any
}

/** Load the book's main name/email index. Throws when the load fails. */
export async function loadMainIndex (book: NamedNode, log: Log) {
  const nameEmailIndex = kb.any(book, ns.vcard('nameEmailIndex')) as NamedNode
  await kb.fetcher.load(nameEmailIndex)
  log('People index has been loaded')
}

/** Log headline numbers: contacts, groups, and the current selection. */
export function showStats (book: NamedNode, selectedGroups: Record<string, boolean>, log: Log) {
  const totalContacts = kb.each(undefined, VCARD('inAddressBook'), book).length
  log('' + totalContacts + ' contacts loaded. ')
  const groups = dedupedGroups(book)
  log('' + groups.length + ' total groups. ')
  log('' + Object.keys(selectedGroups).length + ' selected groups. ')
}

/** Repair the ACL of every card in the selected groups. */
export function checkAccess (selectedGroups: Record<string, boolean>, log: Log) {
  function doCard (card: NamedNode) {
    UI.acl.fixIndividualCardACL(card, (message: string) => log(message), (ok: boolean, message: any) => {
      if (ok) {
        log('Success for ' + UI.utils.label(card))
      } else {
        debug.error('Failure for ' + card + ': ' + message)
        log('Failure for ' + card + ': ' + message)
      }
    })
  }

  for (const groupUri in selectedGroups) {
    const group = kb.sym(groupUri)
    const members = groupMembers(kb, group)
    log(UI.utils.label(group) + ': ' + members.length + ' members')
    for (const card of members) {
      log(UI.utils.label(card))
      doCard(card)
    }
  }
}

/** The book's groups with normalized URIs, duplicates removed. */
function dedupedGroups (book: NamedNode): NamedNode[] {
  const groups = kb.each(book, VCARD('includesGroup')) as NamedNode[]
  const strings = new Set(groups.map(group => normalizeGroupUri(group.uri)))
  return [...strings].map(uri => kb.sym(uri))
}

/** Contacts that belong to no group at all. Loads the indexes it needs. */
export async function findGroupless (book: NamedNode, log: Log) {
  const groupIndex = kb.any(book, ns.vcard('groupIndex')) as NamedNode
  const nameEmailIndex = kb.any(book, ns.vcard('nameEmailIndex')) as NamedNode
  try {
    await kb.fetcher.load([nameEmailIndex, groupIndex])
    const groups = kb.each(book, ns.vcard('includesGroup')) as NamedNode[]
    await kb.fetcher.load(groups)
  } catch (e) {
    debug.error('Error loading groups. Stack: ' + e)
    log('Error loading groups or name index. If it persists, contact your admin.')
  }

  const reverseIndex: any = {}
  const groupless: any[] = []
  const groups = dedupedGroups(book)
  log('' + groups.length + ' total groups. ')

  for (const group of groups) {
    const members = groupMembers(kb, group)
    log(UI.utils.label(group) + ': ' + members.length + ' members')
    for (const member of members) {
      kb.allAliases(member).forEach((alias: any) => {
        reverseIndex[alias.uri] = group
      })
    }
  }

  const cards = kb.each(undefined, VCARD('inAddressBook'), book) as NamedNode[]
  log('' + cards.length + ' total contacts')
  for (const card of cards) {
    if (!reverseIndex[card.uri]) {
      groupless.push(card)
      log('   groupless ' + UI.utils.label(card))
    }
  }
  log('' + groupless.length + ' groupless contacts.')
  return groupless
}

/** Move every groupless contact into a "No group" group, after asking.
 * Returns true when the groups changed, so the caller can refresh the bar. */
export async function fixGroupless (book: NamedNode, log: Log, confirm: Confirm) {
  const groupless = await findGroupless(book, log)
  if (groupless.length === 0) {
    log('No groupless contacts found.')
    return false
  }

  let groupOfUngrouped: any = null
  try {
    groupOfUngrouped = await saveNewGroup(book, 'No group')
  } catch (_e) {
    // The group may exist already; adding below still works then.
  }

  if (!(await confirm(`Add the ${groupless.length} contacts without groups to a 'No group' group?`))) {
    return false
  }

  for (const person of groupless) {
    if (groupOfUngrouped) {
      log('   adding ' + UI.utils.label(person))
      await addPersonToGroup(person, groupOfUngrouped)
    }
  }
  log('People moved to group.')
  return true
}

/** Scan the whole book for duplicate and nameless contacts, then write a
 * cleaned-up index and cleaned-up copies of every group. */
export async function findDuplicates (book: NamedNode, log: Log, confirm: Confirm) {
  const s: ScanState = {
    book,
    cards: [],
    duplicates: [],
    definitive: {},
    nameless: [],
    uniques: [],
    uniqueSet: {},
    uniquesSet: {}
  }

  s.nameEmailIndex = kb.any(book, ns.vcard('nameEmailIndex'))
  log('Loading name index...')
  await kb.fetcher.load(s.nameEmailIndex)
  log('Loaded name index.')

  s.groupObjects = groupsSorted(book)
  log('Loading ' + s.groupObjects.length + ' groups... ')
  await kb.fetcher.load(s.groupObjects)

  scanForDuplicates(s, log)
  checkGroupMembers(s, log)
  await checkAllNameless(s, log, confirm)
  await saveCleanPeople(s, log)
  await saveAllGroups(s, log)
  log('Done!')
}

/** The book's groups sorted by name, as plain group nodes. */
function groupsSorted (book: NamedNode): NamedNode[] {
  if (!book) return []
  const gs = kb.each(book, ns.vcard('includesGroup')) as NamedNode[]
  const sortMe = gs.map(g => [book, kb.any(g, ns.vcard('fn')), g])
  sortMe.sort()
  return sortMe.map(tuple => tuple[2] as NamedNode)
}

/** Partition the cards into definitive, name-duplicates, and nameless. */
function scanForDuplicates (s: ScanState, log: Log) {
  s.cards = kb.each(undefined, VCARD('inAddressBook'), s.book) as NamedNode[]
  log('' + s.cards.length + ' total contacts')

  for (const card of s.cards) {
    const name = kb.anyValue(card, ns.vcard('fn'))
    if (!name) {
      s.nameless.push(card)
      continue
    }
    if (s.definitive[name] === card) {
      // pass
    } else if (s.definitive[name]) {
      s.duplicates.push(card)
    } else {
      s.definitive[name] = card
    }
  }

  s.duplicateSet = {}
  for (const duplicate of s.duplicates) {
    s.duplicateSet[duplicate.uri] = duplicate
  }
  s.namelessSet = {}
  for (const nameless of s.nameless) {
    s.namelessSet[nameless.uri] = nameless
  }
  for (const card of s.cards) {
    if (!s.duplicateSet[card.uri] && !s.namelessSet[card.uri]) {
      s.uniques.push(card)
      s.uniqueSet[card.uri] = card
    }
  }
  log('Uniques: ' + s.uniques.length)
  log('' + s.nameless.length + ' nameless contacts.')
  log('' + s.duplicates.length + ' name-duplicate contacts, leaving ' +
    (s.cards.length - s.duplicates.length))
}

/** Log how group membership compares with the set of unique cards. */
function checkGroupMembers (s: ScanState, log: Log) {
  log('Groups loaded')
  for (const unique of s.uniques) {
    s.uniquesSet[unique.uri] = true
  }
  s.groupMembers = []
  kb.each(null, ns.vcard('hasMember'))
    .forEach(group => { s.groupMembers = s.groupMembers.concat(groupMembers(kb, group as NamedNode)) })
  log('  Naive group members ' + s.groupMembers.length)
  const memberSet: Record<string, NamedNode> = {}
  for (const member of s.groupMembers) {
    memberSet[member.uri] = member
  }
  log('  Compact group members ' + Object.keys(memberSet).length)
}

/** Compare the nameless cards with each other; identical ones are duplicates,
 * the first of each kind a candidate for rescue. */
async function checkAllNameless (s: ScanState, log: Log, confirm: Confirm) {
  s.nameLessIndex = {}
  s.namelessUniques = []
  s.nameLessZeroData = []
  s.nameOnlyErrors = []
  s.nameOnlyDuplicatesGroupDiff = []

  log('Nameless to check: ' + s.nameless.length)
  for (const card of s.nameless) {
    const exact = await checkOneNameless(s, card, log)
    log('    Nameless check returns ' + exact)
  }

  log('namelessUniques: ' + s.namelessUniques.length)
  if (s.namelessUniques.length === 0) return

  if (await confirm('Add all ' + s.namelessUniques.length + ' nameless contacts to the rescued set?')) {
    s.uniques = s.uniques.concat(s.namelessUniques)
    for (const unique of s.namelessUniques) {
      s.uniqueSet[unique.uri] = true
    }
  }
}

async function checkOneNameless (s: ScanState, card: NamedNode, log: Log) {
  try {
    await kb.fetcher.load(card)
  } catch (e) {
    log('Cant load a nameless card!: ' + e)
    s.nameOnlyErrors.push(card)
    return false
  }

  log(' Nameless check ' + card)
  const exclude: Record<string, boolean> = {}
  exclude[ns.vcard('hasUID').uri] = true
  exclude[ns.dc('created').uri] = true
  exclude[ns.dc('modified').uri] = true
  const desc = kb
    .statementsMatching(null, null, null, card.doc())
    .filter(st => !exclude[st.predicate.uri])

  if (!desc.length) {
    log('  Zero length ' + card)
    s.nameLessZeroData.push(card)
    return false
  }

  // Cheat: serialize and compare
  const cardText = new ($rdf.Serializer as any)(kb)
    .setBase(card.doc().uri)
    .statementsToN3(desc)
  const other = s.nameLessIndex[cardText]
  if (other) {
    log('  Matches with ' + other)
    const cardGroups = kb.each(null, ns.vcard('hasMember'), card)
    const otherGroups = kb.each(null, ns.vcard('hasMember'), other)
    for (const cardGroup of cardGroups) {
      if (!otherGroups.some(otherGroup => otherGroup.sameTerm(cardGroup))) {
        log('This one groups: ' + cardGroups)
        log('Other one groups: ' + otherGroups)
        log('Cant skip this one because it has a group, ' + cardGroup +
          ', which the other does not.')
        s.nameOnlyDuplicatesGroupDiff.push(card)
        return false
      }
    }
    debug.log('Group check done -- exact duplicate: ' + card)
  } else {
    log('First nameless like: ' + card.doc())
    log('___________________________________________')
    log(cardText)
    log('___________________________________________')
    s.nameLessIndex[cardText] = card
    s.namelessUniques.push(card)
  }
  return true
}

/** Write an index of just the unique cards next to the book. */
async function saveCleanPeople (s: ScanState, log: Log) {
  const cleanPeople = kb.sym(s.book.dir()!.uri + 'clean-people.ttl')
  try {
    let sts: Statement[] = []
    for (const unique of s.uniques) {
      sts = sts.concat(kb.connectedStatements(unique, s.nameEmailIndex))
    }
    const sz = new ($rdf.Serializer as any)(kb).setBase(s.nameEmailIndex.uri)
    log('Serializing index of uniques...')
    const data = sz.statementsToN3(sts)

    await kb.fetcher.webOperation('PUT', cleanPeople, {
      data,
      contentType: 'text/turtle'
    })
    log('Done uniques log ' + cleanPeople)
  } catch (e) {
    log('Error saving uniques: ' + e)
  }
}

async function saveCleanGroup (s: ScanState, log: Log, group: NamedNode) {
  const cleanGroup = kb.sym(group.uri.replace('/Group/', '/NewGroup/'))
  try {
    let sts: Statement[] = []
    for (const unique of s.uniques) {
      sts = sts.concat(kb.connectedStatements(unique, group.doc()))
    }
    const sz = new ($rdf.Serializer as any)(kb).setBase(group.uri)
    log('   Regenerating group of uniques...' + cleanGroup)
    const data = sz.statementsToN3(sts)

    await kb.fetcher.webOperation('PUT', cleanGroup, {
      data,
      contentType: 'text/turtle'
    })
    log('     Done uniques group ' + cleanGroup)
  } catch (e) {
    log('Error saving : ' + e)
  }
}

function saveAllGroups (s: ScanState, log: Log) {
  log('Saving ALL GROUPS')
  return Promise.all(s.groupObjects.map((group: NamedNode) => saveCleanGroup(s, log, group)))
}
