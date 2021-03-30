/* Create and edit data using public data
**
** organization conveys many distinct types of thing.
**
*/
import { icons, ns, style, widgets, store } from 'solid-ui'
import { NamedNode, Store, st } from 'rdflib'
import { queryPublicDataByName, filterByLanguage, wikidataParameters,
  AUTOCOMPLETE_LIMIT, QueryParameters, getPreferredLanguages } from './publicData'

const kb = store

const AUTOCOMPLETE_THRESHOLD = 4 // don't check until this many characters typed
const AUTOCOMPLETE_ROWS = 20 // 20?
const AUTOCOMPLETE_ROWS_STRETCH = 40
const AUTOCOMPLETE_DEBOUNCE_MS = 300

const autocompleteRowStyle = 'border: 0.2em solid straw;' // @@ white

/*
Autocomplete happens in four phases:
  1. The search string is too small to bother
  2. The search string is big enough, and we have not loaded the array
  3. The search string is big enough, and we have loaded array up to the limit
       Display them and wait for more user input
  4. The search string is big enough, and we have loaded array NOT to the limit
     but including all matches.   No more fetches.
     If user gets more precise, wait for them to select one - or reduce to a single
  5. Optionally waiting for accept button to be pressed
*/

type AutocompleteOptions = { cancelButton?: HTMLElement,
                             acceptButton?: HTMLElement,
                             class: NamedNode,
                             queryParams: QueryParameters  }

interface Callback1 {
  (subject: NamedNode, name: string): void;
}

// The core of the autocomplete UI
export async function renderAutoComplete (dom: HTMLDocument, options:AutocompleteOptions, // subject:NamedNode, predicate:NamedNode,
  callback: Callback1) {
  function complain (message) {
    const errorRow = table.appendChild(dom.createElement('tr'))
    console.log(message)
    errorRow.appendChild(widgets.errorMessageBlock(dom, message, 'pink'))
    style.setStyle(errorRow, 'autocompleteRowStyle')
    errorRow.style.padding = '1em'
  }
  function remove (ele?: HTMLElement) {
    if (ele) {
      ele.parentNode.removeChild(ele)
    }
  }
  function finish (object, name) {
    console.log('Auto complete: finish! '  + object)
     // remove(options.cancelButton)
    // remove(options.acceptButton)
    // remove(div)
    callback(object, name)
  }
  async function gotIt(object:NamedNode, name:string) {
    if (options.acceptButton) {
       (options.acceptButton as any).disabled = false
       searchInput.value = name // complete it
       foundName = name
       foundObject = object
       console.log('Auto complete: name: '  + name)
       console.log('Auto complete: waiting for accept '  + object)
       return
    }
    finish(object, name)
  }

  async function acceptButtonHandler (_event) {
    if (searchInput.value === foundName) { // still
      finish(foundObject, foundName)
    } else {
      (options.acceptButton as any).disabled = true
    }
  }

  async function cancelButtonHandler (_event) {
    console.log('Auto complete: Canceled by user! ')
    div.innerHTML = '' // Clear out the table
  }

  function nameMatch (filter:string, candidate: string):boolean {
    const parts = filter.split(' ') // Each name part must be somewhere
    for (let j = 0; j < parts.length; j++) {
      const word = parts[j]
      if (candidate.toLowerCase().indexOf(word) < 0) return false
    }
    return true
  }

  function cancelText (_event) {
     searchInput.value = '';
     if (options.acceptButton) {
       (options.acceptButton as any).disabled == true; // start again
     }
     candidatesLoaded = false
  }

  function thinOut (filter) {
    var hits = 0
    var pick = null, pickedName = ''
    for (let j = table.children.length - 1; j > 0; j--) { // backwards as we are removing rows
      let row = table.children[j]
      if (nameMatch(filter, row.textContent)) {
        hits += 1
        pick = row.getAttribute('subject')
        pickedName = row.textContent
        ;(row as any).style.display = ''
        ;(row as any).style.color = 'blue' // @@ chose color
      } else {
        ;(row as any).style.display = 'none'
      }
    }
    if (hits == 1) { // Maybe require green confirmation button be clicked?
      console.log(`  auto complete elimination:  "${filter}" -> "${pickedName}"`)
      gotIt(kb.sym(pick), pickedName) // uri, name
    }
  }

  function clearList () {
    while (table.children.length > 1) {
      table.removeChild(table.lastChild)
    }
  }

  async function inputEventHHandler(_event) {
    if (runningTimeout) {
      clearTimeout(runningTimeout)
    }
    setTimeout(refreshList, AUTOCOMPLETE_DEBOUNCE_MS)
  }

  async function refreshList() {
    if (inputEventHandlerLock) {
      console.log (`Ignoring "${searchInput.value}" because of lock `)
      return
    }
    inputEventHandlerLock = true
    var languagePrefs = await getPreferredLanguages()
    const filter = searchInput.value.trim().toLowerCase()
    if (filter.length < AUTOCOMPLETE_THRESHOLD) { // too small
      clearList()
      candidatesLoaded = false
      numberOfRows = AUTOCOMPLETE_ROWS
    } else {
      if (allDisplayed && lastFilter && filter.startsWith(lastFilter)) {
          thinOut(filter) // reversible?
          inputEventHandlerLock = false
          return
      }
      var bindings
      try {
        bindings = await queryPublicDataByName(filter, OrgClass, options.queryParams)
        // bindings = await queryDbpedia(sparql)
      } catch (err) {
        complain('Error querying db of organizations: ' + err)
        inputEventHandlerLock = false
        return
      }
      candidatesLoaded = true
      const loadedEnough = bindings.length < AUTOCOMPLETE_LIMIT
      if (loadedEnough) {
        lastFilter = filter
      } else {
        lastFilter = null
      }
      clearList()
      const slimmed = filterByLanguage(bindings, languagePrefs)
      if (loadedEnough && slimmed.length <= AUTOCOMPLETE_ROWS_STRETCH) {
        numberOfRows = slimmed.length // stretch if it means we get all items
      }
      allDisplayed = loadedEnough && slimmed.length <= numberOfRows
      console.log(` Filter:"${filter}" bindings: ${bindings.length}, slimmed to ${slimmed.length}; rows: ${numberOfRows}, Enough? ${loadedEnough}, All displayed? ${allDisplayed}`)
      slimmed.slice(0,numberOfRows).forEach(binding => {
        const row = table.appendChild(dom.createElement('tr'))
        style.setStyle(row, 'autocompleteRowStyle')
        var uri = binding.subject.value
        var name = binding.name.value
        row.setAttribute('style', 'padding: 0.3em;')
        row.setAttribute('subject', uri)
        row.style.color = allDisplayed ? '#080' : '#000' // green means 'you should find it here'
        row.textContent = name
        row.addEventListener('click', async _event => {
          console.log('       click row textContent: ' + row.textContent)
          console.log('       click name: ' + name)
          gotIt(kb.sym(uri), name)
        })
      })
    }
    inputEventHandlerLock = false
  } // refreshList


/* sparqlForSearch
*
* name -- e.g., "mass"
* theType -- e.g., <http://umbel.org/umbel/rc/EducationalOrganization>
*/
  function sparqlForSearch (name:string, theType:NamedNode):string {
    let clean = name.replace(/\W/g, '') // Remove non alphanum so as to protect regexp
    const sparql = `select distinct ?subject, ?name where {
      ?subject a <${theType.uri}>; rdfs:label ?name
      FILTER regex(?name, "${clean}", "i")
    } LIMIT ${AUTOCOMPLETE_LIMIT}`
    return sparql
  }

  const queryParams: QueryParameters = options.queryParams
  const OrgClass = options.class // kb.sym('http://umbel.org/umbel/rc/EducationalOrganization') // @@@ other
  if (options.acceptButton) {
    options.acceptButton.addEventListener('click', acceptButtonHandler, false)
  }
  if (options.cancelButton) {
    // options.cancelButton.addEventListener('click', cancelButtonHandler, false)
  }

  let candidatesLoaded = false
  let runningTimeout = null
  let inputEventHandlerLock = false
  let allDisplayed = false
  var lastFilter = null
  var numberOfRows = AUTOCOMPLETE_ROWS
  var div = dom.createElement('div')
  var foundName = null // once found accepted string must match this
  var foundObject = null
  var table = div.appendChild(dom.createElement('table'))
  table.setAttribute('style', 'max-width: 30em; margin: 0.5em;')
  const head = table.appendChild(dom.createElement('tr'))
  style.setStyle(head, 'autocompleteRowStyle')
  const cell = head.appendChild(dom.createElement('td'))
  const searchInput = cell.appendChild(dom.createElement('input'))
  searchInput.setAttribute('type', 'text')
  const searchInputStyle = style.searchInputStyle ||
    'border: 0.1em solid #444; border-radius: 0.5em; width: 100%; font-size: 100%; padding: 0.1em 0.6em' // @
  searchInput.setAttribute('style', searchInputStyle)
  searchInput.addEventListener('keyup', function (event) {
    if (event.keyCode === 13) {
      acceptButtonHandler(event)
    }
  }, false);

  searchInput.addEventListener('input', inputEventHHandler)
  return div
} // renderAutoComplete

const ends = 'ENDS';
