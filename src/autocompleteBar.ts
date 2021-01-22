// The Control with decorations

import { icons, ns, style, widgets, store } from 'solid-ui'

import * as UI from 'solid-ui'
import { renderAutoComplete } from './autocompletePicker' // dbpediaParameters

import { NamedNode, Store, st } from 'rdflib'
import { queryPublicDataByName, filterByLanguage, wikidataParameters,
  AUTOCOMPLETE_LIMIT, QueryParameters, getPreferredLanguages } from './publicData'

const WEBID_NOUN = 'Solid ID'

const kb = store

const AUTOCOMPLETE_THRESHOLD = 4 // don't check until this many characters typed
const AUTOCOMPLETE_ROWS = 12 // 20?

const GREEN_PLUS = UI.icons.iconBase + 'noun_34653_green.svg'
const SEARCH_ICON = UI.icons.iconBase + 'noun_Search_875351.svg'

export async function renderAutocompleteControl (dom:HTMLDocument, person:NamedNode, options, queryParameters: QueryParameters, addOneIdAndRefresh): Promise<HTMLElement> {

  async function autoCompleteDone (object, _name) {
    const webid = object.uri
    return addOneIdAndRefresh(person, webid)
  }

  async function greenButtonHandler (_event) {
    const webid = await widgets.askName(dom, store, creationArea, ns.vcard('url'), null, WEBID_NOUN)
    if (!webid) {
      return // cancelled by user
    }
    return addOneIdAndRefresh(person, webid)
  }
  async function searchButtonHandler (_event) {
    async function autoCompleteDone (object, _name) {
      const webid = object.uri
      return addOneIdAndRefresh(person, webid)
    }
    // was = dbpediaParameters
    const queryParams = wikidataParameters

    const classURI = queryParams.class.Insitute
    if (!classURI) throw new Error('Fatal: public data parms no class for this')
    const acceptButton = widgets.continueButton(dom)
    const cancelButton = widgets.cancelButton(dom)

    const acOptions = {
      queryParams,
      class: kb.sym(classURI),
      acceptButton,
      cancelButton
    }
    creationArea.appendChild(await renderAutoComplete(dom, acOptions, autoCompleteDone))
    creationArea.appendChild(acceptButton)
    creationArea.appendChild(cancelButton)
  }

  async function droppedURIHandler (uris) {
    for (const webid of uris) { // normally one but can be more than one
      await addOneIdAndRefresh(person, webid)
    }
  }

  // const { dom } = dataBrowserContext
  options = options || {}
  options.editable = kb.updater.editable(person.doc().uri, kb)

  const creationArea = dom.createElement('div')
  if (options.editable) {

    creationArea.appendChild(await renderAutoComplete(dom, options, autoCompleteDone))
    creationArea.style.width = '100%'
    const plus = creationArea.appendChild(widgets.button(dom, GREEN_PLUS, options.idNoun, greenButtonHandler))
    widgets.makeDropTarget(plus, droppedURIHandler, null)
    if (options.dbLookup) {
      creationArea.appendChild(widgets.button(dom, SEARCH_ICON, options.idNoun, searchButtonHandler))
    }
  }
  return creationArea
} // renderAutocompleteControl

// ends
