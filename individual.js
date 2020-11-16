import * as UI from 'solid-ui'
import { renderMugshotGallery } from './mugshotGallery'
import { renderWedidControl } from './webidControl'
import individualFormText from './individualForm'
import VCARD_ONTOLOGY_TEXT from './vcard.js'

const $rdf = UI.rdf
const ns = UI.ns
const utils = UI.utils
const kb = UI.store

// Render Individual card

export async function renderIndividual (dom, div, subject) {
  // ////////////////////  DRAG and Drop for mugshot image

  function complain (message) {
    console.log(message)
    div.appendChild(UI.widgets.errorMessageBlock(dom, message, 'pink'))
  }

  function complainIfBad (ok, body) {
    if (!ok) {
      complain('Error: ' + body)
    }
  }

  /// ///////////////////////////

  // div.appendChild(renderMugshotGallery(dom, subject))

  // Background metadata for this pane we bundle with the JS
  const individualForm = kb.sym(
    'https://solid.github.io/solid-panes/contact/individualForm.ttl#form1'
  )
  const individualFormDoc = individualForm.doc()
  if (!kb.holds(undefined, undefined, undefined, individualFormDoc)) {
    // If not loaded already
    // var individualFormText = require('./individualForm.js')
    $rdf.parse(individualFormText, kb, individualFormDoc.uri, 'text/turtle') // Load form directly
  }
  const vcardOnt = UI.ns.vcard('Type').doc()
  if (!kb.holds(undefined, undefined, undefined, vcardOnt)) {
    // If not loaded already
    $rdf.parse(VCARD_ONTOLOGY_TEXT, kb, vcardOnt.uri, 'text/turtle') // Load ontology directly
  }

  var toBeFetched = [subject.doc()] // was: individualFormDoc, UI.ns.vcard('Type').doc()
  try {
    await kb.fetcher.load(toBeFetched)
  } catch (err) {
    complain('Error: Failed to load contact card: ' + err)
  } // end of try catch on load

  function setPaneStyle () {
    var types = kb.findTypeURIs(subject)
    var mystyle = 'padding: 0.5em 1.5em 1em 1.5em; '
    var backgroundColor = null
    for (var uri in types) {
      backgroundColor = kb.anyValue(
        kb.sym(uri),
        ns.solid('profileHighlightColor')
      )
      if (backgroundColor) break
    }
    // allow the parent element to define background by default
    backgroundColor = backgroundColor || 'transparent'
    mystyle += 'background-color: ' + backgroundColor + '; '
    div.setAttribute('style', mystyle)
  }
  setPaneStyle()

  UI.authn.checkUser() // kick off async operation @@@ use async version

  div.appendChild(renderMugshotGallery(dom, subject))

  UI.widgets.appendForm(
    dom,
    div,
    {},
    subject,
    individualForm,
    subject.doc(),
    complainIfBad
  )

  div
    .appendChild(dom.createElement('div'))
    .setAttribute('style', 'height: 1em') // spacer

  div.appendChild(await renderWedidControl(subject, { dom }))

  // Allow to attach documents etc to the contact card
  UI.widgets.attachmentList(dom, subject, div, {
    // promptIcon: UI.icons.iconBase +  'noun_681601.svg',
    predicate: UI.ns.vcard('url') // @@@@@@@@@ ,--- no, the vcard ontology structure uses a bnode.
  })

  div.appendChild(dom.createElement('hr'))

  /* moved to webidcontrol.js OWTTE
  var pages = kb.each(subject, ns.vcard('url')) // vcard:url [ a vcard:HomePage; vcard:value <http://www.w3.org/People/Berners-Lee>],
  pages.forEach(function (p) {
    var cla = kb.any(p, ns.rdf('type'))
    var val = kb.any(p, ns.vcard('value'))
    if (val) {
      var tr = table.appendChild(dom.createElement('tr'))
      tr.setAttribute('style', 'margin-top: 0.1em solid #ccc;')

      var nameTD = tr.appendChild(dom.createElement('td'))
      nameTD.textContent = utils.label(cla)

      var formTD = tr.appendChild(dom.createElement('td'))
      var anchor = formTD.appendChild(dom.createElement('a'))
      anchor.setAttribute('href', val.uri)
      var span = anchor.appendChild(dom.createElement('span'))
      span.textContent = val.uri
    }
  })
*/
  div.appendChild(dom.createElement('hr'))

  // Groups the person is a member of

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
          return complain(
            'Error removing member from group ' + group + ': ' + err
          )
        }
        console.log('Removed ' + pname + ' from group ' + gname)
        syncGroupList()
      })
    }
  }

  function newRowForGroup (group) {
    var options = {
      deleteFunction: function () {
        removeFromGroup(subject, group)
      },
      noun: 'membership'
    }
    var tr = UI.widgets.personTR(dom, null, group, options)
    return tr
  }

  var groupList = div.appendChild(dom.createElement('table'))
  function syncGroupList () {
    var groups = kb.each(null, ns.vcard('hasMember'), subject)
    utils.syncTableToArray(groupList, groups, newRowForGroup)
  }
  groupList.refresh = syncGroupList
  syncGroupList()
} // renderIndividual
