// Render a control to record the group memberships we have for this agent
import * as UI from 'solid-ui'
import { store, authn } from 'solid-logic'
import './styles/groupMembership.css'
import * as debug from './debug'
import { normalizeGroupUri, confirmDialog, alertDialog, isAWebID } from './localUtils'
import { refreshNames } from './addressBookPresenter'
import { vcardWebIDs } from './webidControl'

const ns = UI.ns
const kb = store

// Groups the person is a member of
export function groupMembership (person) {
  let groups = kb.statementsMatching(null, ns.owl('sameAs'), person).map(st => st.why)
    .concat(kb.each(null, ns.vcard('hasMember'), person))
  const strings = new Set(groups.map(group => normalizeGroupUri(group.uri))) // remove dups with normalized URIs
  groups = [...strings].map(uri => kb.sym(uri))
  return groups
}

/**
 * Render the group membership section for a given person.
 *
 * @param person - the contact whose memberships are being edited
 * @param context - the Data Browser context used by the pane registry
 * @param ulPeople - **optional** the `<ul>` element containing the master
 *   people list.  When provided (e.g. by the contacts pane) the control will
 *   automatically call `refreshNames(ulPeople)` after removing a membership so
 *   that the list on the left reflects the change.  If `null` this behaviour
 *   is skipped.
 */
export async function renderGroupMemberships (person, context, ulPeople) {
  // keep a reference to the people list (if any) so callers can ask us to
  // refresh it when group membership changes.  The callers that render an
  // address-book view pass their `ulPeople` element; other consumers may not
  // have one and can simply ignore it.
  const peopleUl = ulPeople || null

  // Remove a person from a group
  async function removeFromGroup (person, group) {
    const pname = kb.any(person, ns.vcard('fn'))
    const gname = kb.any(group, ns.vcard('fn'))
    // find all WebIDs of thing
    const thingwebids = kb.each(null, ns.owl('sameAs'), person, group.doc())
    // WebID can be deleted only if not used in another thing
    let webids = []
    thingwebids.forEach(webid => {
      if (kb.statementsMatching(webid, ns.owl('sameAs'), person, group.doc())) webids = webids.concat(webid)
    })
    webids = vcardWebIDs(kb, person).map(webid => webid.value)
    // When checking how many groups this entity belongs to we should look
    // at the person **and** any of their webID nodes.  Build an array of
    // named nodes so we can query all of them.
    const webidNodes = webids.map(u => kb.sym(u))
    const members = [person].concat(webidNodes)
    // collect all groups for any of these members, dedupe by URI
    let groups = members
      .flatMap(m => kb.each(null, ns.vcard('hasMember'), m))
    groups = [...new Set(groups.map(g => g.uri))].map(u => kb.sym(u))
    if (groups.length < 2) {
      alertDialog(
        'Must be a member of at least one group.  Add to another group first.'
      )
      return
    }
    const message = 'Remove ' + pname + ' from group ' + gname + '?'
    if (await confirmDialog(message)) {
      let del = kb
        .statementsMatching(person, undefined, undefined, group.doc())
        .concat(kb.statementsMatching(undefined, undefined, person, group.doc()))
      webids.forEach(webid => {
        if (kb.statementsMatching(webid, ns.owl('sameAs'), undefined, group.doc()).length < 2) {
          del = del.concat(kb.statementsMatching(undefined, undefined, webid, group.doc()))
        }
      })
      try {
        await kb.updater.update(del, [])
      } catch (err) {
        const message = 'Error removing member from group ' + group + ': ' + err
        container.appendChild(UI.widgets.errorMessageBlock(dom, message, 'pink'))
        return
      }
      debug.log('Removed ' + pname + ' from group ' + gname)
      // to allow refresh of card groupList
      kb.fetcher.unload(group.doc())
      await kb.fetcher.load(group.doc())
      syncGroupPills()
      // also update the people list if one exists (or via global fallback)
      refreshNames(peopleUl)
    }
  }

  function createGroupItem (group) {
    const gname = kb.any(group, ns.vcard('fn'))
    const label = gname ? gname.value : group.uri

    const li = dom.createElement('li')
    li.classList.add('group-membership-item')

    // Main group button
    const btn = dom.createElement('button')
    btn.setAttribute('type', 'button')
    btn.classList.add('allGroupsButton', 'actionButton', 'btn-secondary', 'action-button-focus')
    btn.textContent = label
    btn.title = label
    li.appendChild(btn)

    // Toolbar below the button: link icon + delete button
    const toolbar = dom.createElement('div')
    toolbar.classList.add('group-membership-toolbar')

    // Link icon
    const linkEl = UI.widgets.linkIcon(dom, group)
    linkEl.setAttribute('title', 'Link to ' + label)
    toolbar.appendChild(linkEl)

    if (authn.currentUser()) {
      // Delete button
      UI.widgets.deleteButtonWithCheck(
        dom,
        toolbar,
        'membership in ' + label,
        async function () {
          // async operation handles its own refresh once the group doc has
          // been reloaded
          await removeFromGroup(person, group)
        }
      )
    }

    li.appendChild(toolbar)
    return li
  }

  function syncGroupPills (groups = null) {
    const pillsWrapper = dom.createElement('ul')
    pillsWrapper.classList.add('group-pills-wrapper')
    container.appendChild(pillsWrapper)

    const header = dom.createElement('h3')
    header.classList.add('group-membership-header')
    header.textContent = 'Part of groups'
    container.insertBefore(header, pillsWrapper)
    
    groups = groups || groupMembership(person)

    if (groups.length === 0) {
      pillsWrapper.innerHTML = '<span>Not part of any Address Book group.</span>'
    } else {
      pillsWrapper.innerHTML = ''
    }

    groups.forEach(group => {
      pillsWrapper.appendChild(createGroupItem(group))
    })
  }

  async function loadGroupsFromBook (book = null) {
    if (!book) {
      book = kb.any(undefined, ns.vcard('includesGroup'))
      if (!book) {
        return [] // no book => no groups
      }
    }
    const groupIndex = kb.any(book, ns.vcard('groupIndex'))
    const gs = book ? kb.each(book, ns.vcard('includesGroup'), null, groupIndex) : []
    await kb.fetcher.load(gs)
    return gs
  }

  const { dom } = context
  const kb = context.session.store

  const container = dom.createElement('div')
  container.classList.add('group-membership-container')

  // find book any group and load all groups
  const groups = await loadGroupsFromBook()

  // renders the Part of Group
  container.refresh = syncGroupPills
  syncGroupPills(groups)
  return container
}
