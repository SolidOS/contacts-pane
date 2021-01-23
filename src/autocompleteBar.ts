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

export async function renderAutocompleteControl (dom:HTMLDocument,
   person:NamedNode, options, addOneIdAndRefresh): Promise<HTMLElement> {

  async function autoCompleteDone (object, _name) {
    const webid = object.uri
    removeDecorated()
    return addOneIdAndRefresh(person, webid)
  }

  async function greenButtonHandler (_event) {
    const webid = await widgets.askName(dom, store, creationArea, ns.vcard('url'), null, WEBID_NOUN)
    if (!webid) {
      return // cancelled by user
    }
    return addOneIdAndRefresh(person, webid)
  }
  function removeDecorated () {
    creationArea.removeChild(decoratedAutocomplete)
    decoratedAutocomplete = null
  }
  async function searchButtonHandler (_event) {
    if (decoratedAutocomplete) {
      creationArea.removeChild(decoratedAutocomplete)
      decoratedAutocomplete = null
    } else {
      decoratedAutocomplete = dom.createElement('div')
      decoratedAutocomplete.appendChild(await renderAutoComplete(dom, acOptions, autoCompleteDone))
      decoratedAutocomplete.appendChild(acceptButton)
      decoratedAutocomplete.appendChild(cancelButton)
      creationArea.appendChild(decoratedAutocomplete)
    }
  }

  async function droppedURIHandler (uris) {
    for (const webid of uris) { // normally one but can be more than one
      await addOneIdAndRefresh(person, webid)
    }
  }

  const queryParams = options.queryParameters || wikidataParameters
  const acceptButton = widgets.continueButton(dom)
  const cancelButton = widgets.cancelButton(dom, removeDecorated)
  const klass = options.class
  const acOptions = {
    queryParams,
    class:klass,
    acceptButton,
    cancelButton
  }

  var decoratedAutocomplete = null
  // const { dom } = dataBrowserContext
  options = options || {}
  options.editable = kb.updater.editable(person.doc().uri, kb)

  const creationArea = dom.createElement('div')
  if (options.editable) {

    // creationArea.appendChild(await renderAutoComplete(dom, options, autoCompleteDone)) wait for searchButton
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
