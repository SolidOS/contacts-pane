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

// import orgFormText from './organizationForm.js'


/* Example query uri:
http://dbpedia.org/sparql/?default-graph-uri=http%3A%2F%2Fdbpedia.org&query=select+distinct+%3Fx%2C+%3Fname+where+%7B+%3Fx+a+%3Chttp%3A%2F%2Fumbel.org%2Fumbel%2Frc%2FEducationalOrganization%3E%3B+rdfs%3Alabel+%3Fname%0D%0A%0D%0A+FILTER+regex%28%3Fname%2C+%22Mass%22%2C+%22i%22%29+%0D%0A%0D%0A+%7D+LIMIT+100&format=text%2Fhtml&CXML_redir_for_subjs=121&CXML_redir_for_hrefs=&timeout=30000&debug=on&run=+Run+Query+
*/

/*
Three phases:
  - The saerch string is too small to bother
  - The search string is big enough, and we have not loaded the arrray
  - The search string is big enough, and we have loaded arrray up to the limit
      Display them and wait for more user input
  - The search string is big enough, and we have loaded arrray NOT to the limit
     so in that case we have got all matching ones.   No more fetches
     if user gets more precise, wait for them to select one - or reduce to a single
  -
*/

export async function renderAutoComplete (dom: HTMLDocument, subject:NamedNode, predicate:NamedNode) {
  function complain (message) {
    console.log(message)
    table.children[1].appendChild(widgets.errorMessageBlock(dom, message, 'pink'))
  }

  async function gotIt( object) {
    try {
      await kb.updater.update([], [st(subject, predicate, object, subject.doc())])
    } catch (err) {
      complain('Error saving Org identity')
    }
  }

  function nameMatch (filter:string, candidate: string):Boolean {
    const parts = filter.split(' ') // Each name part must be somewhere
    for (let j = 0; j < parts.length; j++) {
      const word = parts[j]
      if (candidate.toLowerCase().indexOf(word) < 0) return false
    }
    return true
  }

  function thinOut (filter) {
    for (let j = table.children.length; j > 0; j--) { // backwards as we are removing rows
      let row = table.children[j]
      if (!nameMatch(filter, row.textContent)) {
        table.removeChild(row)
      }
    }
    if (table.children.length == 2) { // Maybe require green confirmation button clicked?
      const pick = table.children[1].getAttribute('subject')
      gotIt(pick)
    }
  }

  async function refreshList() {
    const filter = searchInput.value.trim().toLowerCase()
    if (filter.length === 0) return
    if (filter.length >= 4) {
      if (candidatesLoaded) {
        thinOut(filter)
      } else {
        const sparql = sparqlForSearch(filter, OrgClass)
        console.log('Querying org data in dbpedia: ' + sparql)
        const queryURI  = queryURIForSearch(sparql)
        const options = {}
        var result
        try {
          result = await kb.fetcher.webOperation('GET', queryURI, options)
        } catch (err) {
          complain('Error querying db of organizations')
          return
        }
        console.log('    Query result ' + result)
        const bindings = JSON.parse(result)
        bindings.forEach(binding => {
          const row = table.appendChild(dom.createElement('tr'))
          row.setAttribute('subject', binding.candidate)
          row.textContent = binding.name
        })
        candidatesLoaded = true
      }
    }
  } // refreshList

  var candidatesLoaded = false
  const OrgClass = kb.sym('http://umbel.org/umbel/rc/EducationalOrganization') // @@@ other
  const query = `select distinct ?x, ?name where {
     ?x a <http://umbel.org/umbel/rc/EducationalOrganization>;
     rdfs:label ?name
 FILTER regex(?name, "Mass", "i")

} LIMIT 1000`


/* sparqlForSearch
*
* name eg "mass"
* theType eg <http://umbel.org/umbel/rc/EducationalOrganization>
*/
  function sparqlForSearch (name:string, theType:NamedNode):string {
    let clean = name.replace(/\W/g, '') // Remove non alphanum so as to protect regexp
    return
    `select distinct ?x, ?name where {
       ?x a <${theType.uri}>;
       rdfs:label ?name
    FILTER regex(?name, "${clean}", "i")

    } LIMIT 1000`
  }

  function queryURIForSearch (query:string):string {
    const myUrlWithParams = new URL("http://dbpedia.org/sparql/");

    myUrlWithParams.searchParams.append("default-graph-uri", "http://dbpedia.org");
    myUrlWithParams.searchParams.append("query", query);

    console.log(myUrlWithParams.href);
    return myUrlWithParams.href
  }

  const numberOfRows = AUTOCOMPLETE_ROWS
  const table = dom.createElement('table')
  const head = table.appendChild(dom.createElement('tr'))
  const cell = head.appendChild(dom.createElement('td'))
  const searchInput = cell.appendChild(dom.createElement('input'))
  searchInput.setAttribute('type', 'text')
  const searchInputStyle = style.searchInputStyle ||
    'border: 0.1em solid #444; border-radius: 0.5em; width: 100%; font-size: 100%; padding: 0.1em 0.6em' // @
  searchInput.setAttribute('style', searchInputStyle)

  searchInput.addEventListener('input', function (_event) {
    refreshList() // Active: select thing if just one left
  })
  /*
  for (let i=0; i < numberOfRows; i++) {
    const row = table.appendChild(dom.createElement('tr'))
    const cell2 = row.appendChild(dom.createElement('td'))
    cell2.textContent = ''
  }
  */
  return table
}
