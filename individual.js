import * as UI from 'solid-ui'
import { renderMugshotGallery } from './mugshotGallery'
import { renderWedidControl } from './webidControl'
import { renderGroupMemberships } from './groupMembershipControl.js'
import individualFormText from './individualForm'
import organizationFormText from './organizationForm'
import VCARD_ONTOLOGY_TEXT from './vcard.js'

const $rdf = UI.rdf
const ns = UI.ns
// const utils = UI.utils
const kb = UI.store
const style = UI.style

export function loadTurtleText (kb, thing, text) {
  const doc = thing.doc()
  if (!kb.holds(undefined, undefined, undefined, doc)) {
    // If not loaded already
    $rdf.parse(text, kb, doc.uri, 'text/turtle') // Load  directly
  }
}

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

  /// ///////////////////////////
  const t = kb.findTypeURIs(subject)
  const isOrganization = !!(t[ns.vcard('Organization').uri] || t[ns.schema('Organization').uri])

  const individualForm = kb.sym(
    'https://solid.github.io/solid-panes/contact/individualForm.ttl#form1'
  )
  loadTurtleText(kb, individualForm, individualFormText)

  const organizationForm = kb.sym(
    'https://solid.github.io/solid-panes/contact/organizationForm.ttl#form1'
  )
  loadTurtleText(kb, organizationForm, organizationFormText)

  // Background metadata for this pane we bundle with the JS
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

  div.style = style.paneDivStyle || 'padding: 0.5em 1.5em 1em 1.5em;'

  UI.authn.checkUser() // kick off async operation @@@ use async version

  div.appendChild(renderMugshotGallery(dom, subject))

  const form = isOrganization ? organizationForm : individualForm
  UI.widgets.appendForm(
    dom,
    div,
    {},
    subject,
    form,
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
