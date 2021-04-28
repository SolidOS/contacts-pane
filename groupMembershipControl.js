
// Render a control to record the group memberships we have for this agent
import * as UI from 'solid-ui'
import { updateMany } from './contactLogic'
import { getPersonas, removeWebIDsFromGroup } from './webidControl'

const $rdf = UI.rdf
const ns = UI.ns
// const buttons = UI.buttonsn  no
// const widgets = UI.widgets
const utils = UI.utils
const kb = UI.store
// const style = UI.style

// Groups the person is a member of
export async function renderGroupMemberships (person, context) {
  // Remove a person from a group
  async function removeFromGroup (thing, group) {
    const pname = kb.any(thing, ns.vcard('fn'))
    const gname = kb.any(group, ns.vcard('fn'))
    const groups = kb.each(null, ns.vcard('hasMember'), thing)
    if (groups.length < 2) {
      alert(
        'Must be a member of at least one group.  Add to another group first.'
      )
      return
    }
    const message = 'Remove ' + pname + ' from group ' + gname + '?'
    if (confirm(message)) {
      const del = [
        $rdf.st(group, ns.vcard('hasMember'), thing, group.doc()),
        $rdf.st(thing, ns.vcard('fn'), pname, group.doc())
      ]
      kb.updater.update(del, [], function (uri, ok, err) {
        if (!ok) {
          const message = 'Error removing member from group ' + group + ': ' + err
          groupList.parentNode.appendChild(UI.widgets.errorMessageBlock(dom, message, 'pink'))
        }
      })
      // remove webids from group
      const webIDs = getPersonas(kb, thing)
      const delWebIDs = await removeWebIDsFromGroup(webIDs, group, kb)
      await updateMany(delWebIDs) // TODO updater.update
      console.log('Removed ' + pname + ' from group ' + gname)
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

  function syncGroupList () {
    const groups = kb.each(null, ns.vcard('hasMember'), person)
    utils.syncTableToArray(groupList, groups, newRowForGroup)
  }

  const { dom } = context
  const groupList = dom.createElement('table')
  groupList.refresh = syncGroupList
  syncGroupList()
  return groupList
}
