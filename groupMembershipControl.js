
// Render a control to record the group membetships we have for this agent
import * as UI from 'solid-ui'

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
  function removeFromGroup (thing, group) {
    var pname = kb.any(thing, ns.vcard('fn'))
    var gname = kb.any(group, ns.vcard('fn'))
    var groups = kb.each(null, ns.vcard('hasMember'), thing)
    if (groups.length < 2) {
      alert(
        'Must be a member of at least one group.  Add to another group first.'
      )
      return
    }
    var message = 'Remove ' + pname + ' from group ' + gname + '?'
    if (confirm(message)) {
      var del = [
        $rdf.st(group, ns.vcard('hasMember'), thing, group.doc()),
        $rdf.st(thing, ns.vcard('fn'), pname, group.doc())
      ]
      kb.updater.update(del, [], function (uri, ok, err) {
        if (!ok) {
          const message = 'Error removing member from group ' + group + ': ' + err
          groupList.parentNode.appendChild(UI.widgets.errorMessageBlock(dom, message, 'pink'))
          return
        }
        console.log('Removed ' + pname + ' from group ' + gname)
        syncGroupList()
      })
    }
  }
  function newRowForGroup (group) {
    var options = {
      deleteFunction: function () {
        removeFromGroup(person, group)
      },
      noun: 'membership'
    }
    var tr = UI.widgets.personTR(dom, null, group, options)
    return tr
  }

  function syncGroupList () {
    var groups = kb.each(null, ns.vcard('hasMember'), person)
    utils.syncTableToArray(groupList, groups, newRowForGroup)
  }

  const { dom } = context
  const groupList = dom.createElement('table')
  groupList.refresh = syncGroupList
  syncGroupList()
  return groupList
}
