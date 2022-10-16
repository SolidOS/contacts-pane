
// Render a control to record the group memberships we have for this agent
import * as UI from 'solid-ui'

// const $rdf = UI.rdf
const ns = UI.ns
// const buttons = UI.buttonsn  no
// const widgets = UI.widgets
const utils = UI.utils
// const style = UI.style

// Groups the person is a member of
export async function renderGroupMemberships (person, context) {
  // Remove a person from a group
  async function removeFromGroup (thing, group) {
    const pname = kb.any(thing, ns.vcard('fn'))
    const gname = kb.any(group, ns.vcard('fn'))
    // find all WebIDs of thing
    const thingwebids = kb.each(null, ns.owl('sameAs'), thing, group.doc())
    // WebID can be deleted only if not used in another thing
    let webids = []
    thingwebids.map(webid => {
      if (kb.any(webid, ns.owl('sameAs'), thing, group.doc()).length = 1 ) webids = webids.concat(webid)
      }
    )
    // const webids = kb.any(webid, ns.owl('sameAs'))
    let thingOrWebid = thing
    if (webids.length > 0) thingOrWebid = kb.sym(webids[0])
    const groups = kb.each(null, ns.vcard('hasMember'), thingOrWebid)
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
      webids.map(webid => del.concat(kb.statementsMatching(undefined,undefined, webid, group.doc())))
      kb.updater.update(del, [], function (uri, ok, err) {
        if (!ok) {
          const message = 'Error removing member from group ' + group + ': ' + err
          groupList.parentNode.appendChild(UI.widgets.errorMessageBlock(dom, message, 'pink'))
        }
      })
      console.log('Removed ' + pname + ' from group ' + gname)
      // to allow refresh of card groupList
      kb.fetcher.unload(group.doc())
      await kb.fetcher.load(group.doc())
      syncGroupList()
    }
  }

  function newRowForGroup (group) {
    const options = {
      deleteFunction: function () {
        removeFromGroup(person, group)
      },
      noun: 'membership'
    }
    const tr = UI.widgets.personTR(dom, null, group, options)
    return tr
  }

  // find all documents where person ns.vcard('fn')
  function syncGroupList () {
    // person and/or WebIDs to be changed
    // const groups = kb.each(null, ns.vcard('hasMember'), person)
    const groups = kb.each(person, ns.vcard('fn'), undefined) // non il faut acceder a la liste des group.doc()
    utils.syncTableToArray(groupList, groups, newRowForGroup)
  }

  async function loadGroupsFromBook (book = null) {
    if (!book) {
      book = kb.any(undefined, ns.vcard('includesGroup'))
      if (!book) {
        throw new Error('findBookFromGroups: Cant find address book which this group is part of')
      }
    }
    const groupIndex = kb.any(book, ns.vcard('groupIndex'))
    const gs = book ? kb.each(book, ns.vcard('includesGroup'), null, groupIndex) : []
    await kb.fetcher.load(gs)
  }

  const { dom } = context
  const kb = context.session.store
  const groupList = dom.createElement('table')

  // find book any group and load all groups
  await loadGroupsFromBook()

  groupList.refresh = syncGroupList
  syncGroupList()
  return groupList
}
