/* Create and edit data using public data
**
** organizations conveys many distinct typed of thing.
**
*/
import { icons, ns, style, widgets, store } from 'solid-ui'
import { NamedNode, Store, st } from 'rdflib'
import { queryPublicDataByName, filterByLanguage, wikidataParameters,
  AUTOCOMPLETE_LIMIT, QueryParameters, getPreferredLanguages } from './publicData'

const kb = store

const AUTOCOMPLETE_THRESHOLD = 4 // don't check until this many characters typed
const AUTOCOMPLETE_ROWS = 12 // 20?

const autocompleteRowStyle = 'border: 0.2em solid straw;'

/*
Autocomplete hapopens in four phases:
  - The saerch string is too small to bother
  - The search string is big enough, and we have not loaded the arrray
  - The search string is big enough, and we have loaded arrray up to the limit
      Display them and wait for more user input
  - The search string is big enough, and we have loaded arrray NOT to the limit
     so in that case we have got all matching ones.   No more fetches
     if user gets more precise, wait for them to select one - or reduce to a single
  - Optionally waiting for accept button to be pressed
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
    remove(options.cancelButton)
    remove(options.acceptButton)
    remove(div)
    if (callback) callback(object, name)
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
      } else {
        ;(row as any).style.display = 'none'
      }
    }
    if (hits == 1) { // Maybe require green confirmation button clicked?
      console.log(`  auto complete elimination:  "${filter}" -> "${pickedName}"`)
      gotIt(kb.sym(pick), pickedName) // uri, name
    }
  }

  function clearList () {
    while (table.children.length > 1) {
      table.removeChild(table.lastChild)
    }
  }
  async function refreshList() {
    var languagePrefs = await getPreferredLanguages()
    const filter = searchInput.value.trim().toLowerCase()
    if (filter.length < 4) { // too small
      clearList()
      candidatesLoaded = false
      return
    } else {
      if (candidatesLoaded && lastFilter && filter.startsWith(lastFilter)) {
          thinOut(filter) // reversible?
          return
      }
      var bindings
      try {
        bindings = await queryPublicDataByName(filter, OrgClass, options.queryParams)
        // bindings = await queryDbpedia(sparql)
      } catch (err) {
        complain('Error querying db of organizations: ' + err)
        return
      }
      candidatesLoaded = true
      console.log(`  ${bindings.length} results from db of organizations.`)
      const loadedEnough = bindings.length < AUTOCOMPLETE_LIMIT
      if (loadedEnough) {
        lastFilter = filter
      } else {
        lastFilter = null
      }
      clearList()
      const slimmed = filterByLanguage(bindings, languagePrefs)
      slimmed.forEach(binding => {
        const row = table.appendChild(dom.createElement('tr'))
        style.setStyle(row, 'autocompleteRowStyle')
        var uri = binding.subject.value
        var name = binding.name.value
        row.setAttribute('style', 'padding: 0.3em;')
        row.setAttribute('subject', uri)
        row.textContent = name
        row.addEventListener('click', async _event => {
          console.log('       click row textContent: ' + row.textContent)
          console.log('       click name: ' + name)
          gotIt(kb.sym(uri), name)
        })
      })
    }
  } // refreshList


/* sparqlForSearch
*
* name eg "mass"
* theType eg <http://umbel.org/umbel/rc/EducationalOrganization>
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
    options.cancelButton.addEventListener('click', cancelButtonHandler, false)
  }

  var candidatesLoaded = false
  var lastFilter = null
  const numberOfRows = AUTOCOMPLETE_ROWS
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

  searchInput.addEventListener('input', function (_event) {
    refreshList() // Active: select thing if just one left
  })
  return div
} // renderAutoComplete

const ends = 'ENDS';
