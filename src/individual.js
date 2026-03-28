import * as UI from 'solid-ui'
import { authn, store } from 'solid-logic'
import { renderMugshotGallery } from './mugshotGallery'
import { renderWebIdControl, renderPublicIdControl } from './webidControl'
import { renderGroupMemberships } from './groupMembershipControl'
import formsSource from './ontology/individualAndOrganizationForm.ttl'
import VCARD_ONTOLOGY_TEXT from './ontology/vcard.ttl'
import './styles/individual.css'
import './styles/contactsRDFFormsEnforced.css'
import { renderForm, loadDocument } from './rdfFormsHelper'
import * as debug from './debug'
import { skipLabelsFromTabbing, isAWebID } from './localUtils'

const ns = UI.ns
const kb = store

const formsName = 'individualAndOrganizationForm.ttl' // The name of the form file
const vcardName = 'vcard.ttl' // The name of the vcard file

export async function renderIndividual (dom, div, subject, dataBrowserContext) {
  const t = kb.findTypeURIs(subject)
  const isOrganization = !!(t[ns.vcard('Organization').uri] || t[ns.schema('Organization').uri])
  const editable = kb.updater.editable(subject.doc().uri, kb)

  // We load the local form document
  loadDocument(kb, formsSource, formsName)

  // We need to make sure VCARD ontology is loaded in the store
  const vcardOntUri = UI.ns.vcard('Type').doc().uri // URI to VCARD
  loadDocument(kb, VCARD_ONTOLOGY_TEXT, vcardName, vcardOntUri)

  try {
    await kb.fetcher.load(subject.doc())
  } catch (err) {
    debug.error('Error loading profile card. Stack: ' + err)
    throw new Error('Failed to load profile card.')
  } // end of try catch on load

  div.classList.add('individualPane')

  authn.checkUser() // kick off async operation @@@ use async version

  div.appendChild(renderMugshotGallery(dom, subject))

  const whichForm = isOrganization ? 'organizationForm' : 'individualForm'

  renderForm(div, subject, formsSource, formsName, store, dom, subject.doc(), whichForm)
  // Improve keyboard navigation: prevent tabbing into label links created by rdflib/solid-ui forms
  skipLabelsFromTabbing(div)

  // forward list element from context if available; some callers (such as
  // the contacts pane) attach `ulPeople` so that group membership control can
  // refresh the master list when a membership is removed.
  if (!isAWebID(subject)) {
    div.appendChild(await renderGroupMemberships(
      subject,
      dataBrowserContext,
      dataBrowserContext.ulPeople
    ))
  }

  if (authn.currentUser()) {
    // Allow to attach documents etc to the profile card
    // creates a
    const h3 = div.appendChild(dom.createElement('h3'))
    h3.textContent = 'Attach a link to any file'
    h3.classList.add('contactPanedHeading')

    UI.widgets.attachmentList(dom, subject, div, {
      modify: editable
      // promptIcon: UI.icons.iconBase +  'noun_681601.svg',
      // predicate: default <http://www.w3.org/2005/01/wf/flow#attachment>
    })
  }

  if (isOrganization) {
    div.appendChild(await renderPublicIdControl(subject, dataBrowserContext))
  } else if (!isAWebID(subject)) {
    // Only render WebID control for a contact and not. WebID.
    div.appendChild(await renderWebIdControl(subject, dataBrowserContext))
  }
} // renderIndividual
