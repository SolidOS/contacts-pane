/* Create and edit data on Organizations
**
** organizations conver many distinct typed of thing.. Th
**
*/
import { icons, ns, style, widgets, store } from 'solid-ui'
import { NamedNode, Store, st } from 'rdflib'
// import { getChat, longChatPane } from 'chat-pane'
// import { renderGroupMemberships } from './groupMembershipControl.js'

const kb = store

const AUTOCOMPLETE_THRESHOLD = 4 // don't check until this many characters typed
const AUTOCOMPLETE_ROWS = 12 // 20?
const AUTOCOMPLETE_LIMIT = 100 // How many to get from server

const USER_PREFERED_LANGUAGE = ['fr', 'en', 'de', 'it'] // @ get from user preferences

const autocompleteRowStyle = 'border: 0.2em solid straw;'

/*
Four phases:
  - The saerch string is too small to bother
  - The search string is big enough, and we have not loaded the arrray
  - The search string is big enough, and we have loaded arrray up to the limit
      Display them and wait for more user input
  - The search string is big enough, and we have loaded arrray NOT to the limit
     so in that case we have got all matching ones.   No more fetches
     if user gets more precise, wait for them to select one - or reduce to a single
  - Optionally waiting for accept button to be pressed
*/

interface Term {
  type: string;
  value: string
}

interface Binding {
  subject: Term;
  name: Term
}

type Bindings = Binding[]

/* From an array of bindings with a names for each row,
 * remove dupliacte names for the same thing, leaving the user's
 * preferred language version
*/
export function filterByLanguage (bindings, languagePrefs) {
  let uris = {}
  console.log(' Filter by language: '  + bindings.length)
  bindings.forEach(binding => { // Organize names by their subject
    const uri = binding.subject.value
    uris[uri] = uris[uri] || []
    uris[uri].push(binding)
  })

  var languagePrefs2 = languagePrefs
  languagePrefs2.reverse() // prefered last

  var slimmed = []
  for (const u in uris) { // needs hasOwnProperty ?
    // console.log('   Filter uri : ' + u )
    const bindings = uris[u]
    // console.log('   Filter bindings : ' + JSON.stringify(bindings) )
    const sortMe  = bindings.map(binding => {
      return [ languagePrefs2.indexOf(binding.name['xml:lang']), binding]
    })
    // console.log('   Filter sortme : ' + sortMe.length )

    sortMe.sort() // best at th ebottom
    sortMe.reverse() // best at the top
    slimmed.push(sortMe[0][1])
  } // map u
  return slimmed
}

export function queryURIForDbpediaSearch (query:string):string {
  const myUrlWithParams = new URL("https://dbpedia.org/sparql/");

  // myUrlWithParams.searchParams.append("default-graph-uri", "http://dbpedia.org");
  myUrlWithParams.searchParams.append("query", query);

  console.log(myUrlWithParams.href);
  return myUrlWithParams.href
}

export async function queryDbpedia (sparql: string): Promise<Bindings> {
  console.log('Querying org data in dbpedia: ' + sparql)
  const queryURI  = queryURIForDbpediaSearch(sparql)
  const options = { credentials: 'omit',
    headers: { 'Accept': 'application/json'}
  } // CORS
  var response
  response = await kb.fetcher.webOperation('GET', queryURI, options)
  //complain('Error querying db of organizations: ' + err)
  const text = response.responseText
  console.log('    Query result ' + text)
  const json = JSON.parse(text)
  console.log('    Query result JSON' + JSON.stringify(json, null, 4))
  const bindings = json.results.bindings
  return bindings
}

type AutocompleteOptions = { cancelButton?: HTMLElement, acceptButton?: HTMLElement }

interface Callback1 {
  (subject: NamedNode, name: string): void;
}
export async function renderAutoComplete (dom: HTMLDocument, options:AutocompleteOptions, // subject:NamedNode, predicate:NamedNode,
  callback: Callback1) {
  function complain (message) {
    const errorRow = table.appendChild(dom.createElement('tr'))
    console.log(message)
    errorRow.appendChild(widgets.errorMessageBlock(dom, message, 'pink'))
    style.setStyle(errorRow, 'autocompleteRowStyle')
    errorRow.style.padding = '1em'
  }
  function finish (object, name) {
    console.log('Auto complete: finish! '  + object)
    div.innerHTML = '' // Clear out the table
    if (callback) callback(object, name)
  }
  async function gotIt(object:NamedNode, name:string) {
    if (options.acceptButton) {
       (options.acceptButton as any).disabled = false
       searchInput.value = name // complete it
       foundName = name
       foundObject = object
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
     (options.acceptButton as any).disabled == true; // start again
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
      gotIt(kb.sym(pick), table.children[1].textContent) // uri, name
    }
  }

  function clearList () {
    while (table.children.length > 1) {
      table.removeChild(table.lastChild)
    }
  }
  async function refreshList() {
    var languagePrefs = USER_PREFERED_LANGUAGE
    const filter = searchInput.value.trim().toLowerCase()
    if (filter.length === 0) return
    if (filter.length >= 4) {
      if (candidatesLoaded && lastFilter && filter.startsWith(lastFilter)) {
          thinOut(filter) // reversible?
          return
      }
      const sparql = sparqlForSearch(filter, OrgClass)
      var bindings
      try {
        bindings = await queryDbpedia(sparql)
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
        const uri = binding.subject.value
        const name = binding.name.value
        row.setAttribute('style', 'padding: 0.3em;')
        row.setAttribute('subject', uri)
        row.textContent = name
        row.addEventListener('click', _event => { gotIt(kb.sym(uri), name)})
      })
    } else {
      candidatesLoaded = false
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

  var candidatesLoaded = false
  var lastFilter = null
  const OrgClass = kb.sym('http://umbel.org/umbel/rc/EducationalOrganization') // @@@ other
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
}

export async function getDbpediaDetails (kb, solidSubject:NamedNode, dbpediaSubject:NamedNode) {
// Note below the string form of the named node with <> works in SPARQL
  const sparql = `select distinct ?city, ?state, ?country, ?homepage, ?logo, ?lat, ?long,  WHERE {
    OPTIONAL { <${dbpediaSubject}> <http://dbpedia.org/ontology/city> ?city }
    OPTIONAL { ${dbpediaSubject} <http://dbpedia.org/ontology/state> ?state }
    OPTIONAL { ${dbpediaSubject} <http://dbpedia.org/ontology/country> ?country }
    OPTIONAL { ${dbpediaSubject} foaf:homepage ?homepage }
    OPTIONAL { ${dbpediaSubject} foaf:lat ?lat; foaf:long ?long }
    OPTIONAL { ${dbpediaSubject} <http://dbpedia.org/ontology/country> ?country }
   }`
   const predMap = {
     city: ns.vcard('locality'),
     state: ns.vcard('region'),
     country: ns.vcard('country-name'),
     homepage: ns.foaf('homepage'),
     lat: ns.geo('latitude'),
     long: ns.geo('longitude'),
   }
  const bindings = await queryDbpedia(sparql)
  bindings.forEach(binding => {
    const uri = binding.subject.value
    const name = binding.name.value
  })
}


function wikidataQueryAcadInstite (name) {
  let clean = name.replace(/\W/g, '') // Remove non alphanum so as to protect regexp
  return `#Acad Inst, with pictures
#defaultView:ImageGrid
SELECT ?item ?name ?pic
WHERE
{
  ?item wdt:P31 wd:Q4671277 .
  ?item wdt:P18 ?pic ; rdfs:label ?name.
  FILTER regex(?name, "${clean}", "i")

SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en" }
} LIMIT ${AUTOCOMPLETE_LIMIT}`
}

const wikidataEndpoint = 'https://query.wikidata.org/sparql?query=(SPARQL_query)'

const test1 =
`SELECT ?item ?name ?pic
WHERE
{

   ?klass wdt:P279* wd:Q4671277 .

?item wdt:P31 ?klass .
?item wdt:P18 ?pic ; rdfs:label ?name.
FILTER regex(?name, "mass", "i")

SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en" }
} LIMIT 20 `;


const ends = 'ENDS';
