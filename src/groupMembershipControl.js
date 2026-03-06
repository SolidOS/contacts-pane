// Render a control to record the group memberships we have for this agent
import * as UI from 'solid-ui'
import { store } from 'solid-logic'
import './styles/groupMembership.css'
import * as debug from './debug'
import { normalizeGroupUri } from './localUtils'

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

export async function renderGroupMemberships (person, context) {
  // Remove a person from a group
  async function removeFromGroup (thing, group) {
    const pname = kb.any(thing, ns.vcard('fn'))
    const gname = kb.any(group, ns.vcard('fn'))
    // find all WebIDs of thing
    const thingwebids = kb.each(null, ns.owl('sameAs'), thing, group.doc())
    // WebID can be deleted only if not used in another thing
    let webids = []
    thingwebids.forEach(webid => {
      if (kb.statementsMatching(webid, ns.owl('sameAs'), thing, group.doc())) webids = webids.concat(webid)
    })
    let thingOrWebid = thing
    if (webids.length > 0) thingOrWebid = webids[0]
    const groups = kb.each(null, ns.vcard('hasMember'), thingOrWebid) // in all groups a person has same structure
    if (groups.length < 2) {
      alert(
        'Must be a member of at least one group.  Add to another group first.'
      )
      return
    }
    const message = 'Remove ' + pname + ' from group ' + gname + '?'
    if (confirm(message)) {
      let del = kb
        .statementsMatching(person, undefined, undefined, group.doc())
        .concat(kb.statementsMatching(undefined, undefined, person, group.doc()))
      webids.forEach(webid => {
        if (kb.statementsMatching(webid, ns.owl('sameAs'), undefined, group.doc()).length < 2) {
          del = del.concat(kb.statementsMatching(undefined, undefined, webid, group.doc()))
        }
      })
      kb.updater.update(del, [], function (uri, ok, err) {
        if (!ok) {
          const message = 'Error removing member from group ' + group + ': ' + err
          container.appendChild(UI.widgets.errorMessageBlock(dom, message, 'pink'))
        }
      })
      debug.log('Removed ' + pname + ' from group ' + gname)
      // to allow refresh of card groupList
      kb.fetcher.unload(group.doc())
      await kb.fetcher.load(group.doc())
      syncGroupPills()
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

    // Delete button
    UI.widgets.deleteButtonWithCheck(
      dom,
      toolbar,
      'membership in ' + label,
      function () {
        removeFromGroup(person, group)
      }
    )

    li.appendChild(toolbar)
    return li
  }

  function syncGroupPills () {
    const groups = groupMembership(person)
    const pillsWrapper = container.querySelector('.group-pills-wrapper')
    if (groups.length === 0) {
      pillsWrapper.innerHTML = 'Not part of any Address Book groups.'
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
        return // no book => no groups
      }
    }
    const groupIndex = kb.any(book, ns.vcard('groupIndex'))
    const gs = book ? kb.each(book, ns.vcard('includesGroup'), null, groupIndex) : []
    await kb.fetcher.load(gs)
  }

  const { dom } = context
  const kb = context.session.store

  const container = dom.createElement('div')
  container.classList.add('group-membership-container')

  // Header
  const header = dom.createElement('h3')
  header.classList.add('group-membership-header')
  header.textContent = 'Part of groups'
  container.appendChild(header)

  const pillsWrapper = dom.createElement('ul')
  pillsWrapper.classList.add('group-pills-wrapper')
  container.appendChild(pillsWrapper)

  // find book any group and load all groups
  await loadGroupsFromBook()

  container.refresh = syncGroupPills
  syncGroupPills()
  return container
}
