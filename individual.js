import * as UI from 'solid-ui'
import { renderMugshotGallery } from './mugshotGallery'
import { renderWedidControl } from './webidControl'
import { renderGroupMemberships } from './groupMembershipControl.js'
import individualFormText from './individualForm'
import VCARD_ONTOLOGY_TEXT from './vcard.js'

const $rdf = UI.rdf
const ns = UI.ns
// const utils = UI.utils
const kb = UI.store

// Render Individual card

export async function renderIndividual (dom, div, subject, dataBrowserContext) {
  // ////////////////////  DRAG and Drop for mugshot image

  function complain (message) {
    console.log(message)
    div.appendChild(UI.widgets.errorMessageBlock(dom, message, 'pink'))
  }

  function spacer () {
    div
      .appendChild(dom.createElement('div'))
      .setAttribute('style', 'height: 1em')
  }
  function complainIfBad (ok, body) {
    if (!ok) {
      complain('Error: ' + body)
    }
  }

  function setPaneStyle () {
    const types = kb.findTypeURIs(subject)
    let mystyle = 'padding: 0.5em 1.5em 1em 1.5em; '
    let backgroundColor = null
    for (const uri in types) {
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

  /// ///////////////////////////

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

  try {
    await kb.fetcher.load(subject.doc())
  } catch (err) {
    complain('Error: Failed to load contact card: ' + err)
  } // end of try catch on load

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

  spacer()

  div.appendChild(await renderGroupMemberships(subject, dataBrowserContext))

  spacer()

  // Allow to attach documents etc to the contact card

  const editable = kb.updater.editable(subject.doc().uri, kb)
  UI.widgets.attachmentList(dom, subject, div, {
    modify: editable
    // promptIcon: UI.icons.iconBase +  'noun_681601.svg',
    // predicate: UI.ns.vcard('url') // @@@@@@@@@ ,--- no, the vcard ontology structure uses a bnode.
  })

  spacer()

  div.appendChild(await renderWedidControl(subject, dataBrowserContext))

  // div.appendChild(dom.createElement('hr'))
} // renderIndividual
