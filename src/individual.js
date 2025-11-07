import * as UI from 'solid-ui'
import { authn, store } from 'solid-logic'
import { renderMugshotGallery } from './mugshotGallery'
import { renderWebIdControl, renderPublicIdControl } from './webidControl'
import { renderGroupMemberships } from './groupMembershipControl'
import textOfForms from './ontology/forms.ttl'
import VCARD_ONTOLOGY_TEXT from './ontology/vcard.ttl'
import * as $rdf from 'rdflib'

const ns = UI.ns
const kb = store
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
  const editable = kb.updater.editable(subject.doc().uri, kb)

  const individualForm = kb.sym(
    'https://solid.github.io/solid-panes/contact/individualForm.ttl#form1'
  )
  loadTurtleText(kb, individualForm, textOfForms)

  const orgDetailsForm = kb.sym( // orgDetailsForm organizationForm
    'https://solid.github.io/solid-panes/contact/individualForm.ttl#orgDetailsForm'
  )

  // Ontology metadata for this pane we bundle with the JS
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

  authn.checkUser() // kick off async operation @@@ use async version

  div.appendChild(renderMugshotGallery(dom, subject))

  const form = isOrganization ? orgDetailsForm : individualForm
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

  // Auto complete searches in a table
  // Prefer the fom below renderPublicIdControl
  /*
  if (isOrganization) {
    const publicDataTable = div.appendChild(dom.createElement('table'))
    async function publicDataSearchRow (name) {
      async function autoCompleteDone (object, _name) {
        right.innerHTML = ''
        right.appendchild(UI.widgets.personTR(dom, object))
      }
      const row = dom.createElement('tr')
      const left = row.appendChild(dom.createElement('td'))
      left.textContent = name
      const right = row.appendChild(dom.createElement('td'))
      right.appendChild(await renderAutoComplete(dom, subject, ns.owl('sameAs'), autoCompleteDone))
      return row
    }
    publicDataTable.appendChild(await publicDataSearchRow('dbpedia'))
  }
*/
  // Allow to attach documents etc to the contact card

  UI.widgets.attachmentList(dom, subject, div, {
    modify: editable
    // promptIcon: UI.icons.iconBase +  'noun_681601.svg',
    // predicate: UI.ns.vcard('url') // @@@@@@@@@ ,--- no, the vcard ontology structure uses a bnode.
  })

  spacer()

  if (isOrganization) {
    div.appendChild(await renderPublicIdControl(subject, dataBrowserContext))
  } else {
    div.appendChild(await renderWebIdControl(subject, dataBrowserContext))
  }
  // div.appendChild(dom.createElement('hr'))
} // renderIndividual
