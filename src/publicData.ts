/* Logic to access public data stores
*
* including filtering resut by natural language etc
*/
import { NamedNode, Store, st } from 'rdflib'

import { icons, ns, style, widgets, store } from 'solid-ui'

const kb = store

export const AUTOCOMPLETE_LIMIT = 100 // How many to get from server

interface Term {
  type: string;
  value: string
}

interface Binding {
  subject: Term;
  name: Term
}

type Bindings = Binding[]

export type QueryParameters =
{ label: string;
  logo: string;
  sparql: string;
  endpoint: string;
  class: object
}

export const dbpediaParameters:QueryParameters = {
  label: 'DBPedia',
  logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/DBpediaLogo.svg/263px-DBpediaLogo.svg.png',
  sparql: `select distinct ?subject, ?name where {
    ?subject a $(class); rdfs:label ?name
    FILTER regex(?name, "$(name)", "i")
  } LIMIT $(limit)`,
  endpoint: 'https://dbpedia.org/sparql/',
    class: { AcademicInsitution: 'http://umbel.org/umbel/rc/EducationalOrganization'}
}

export const wikidataParameters = {
  label: 'WikiData',
  logo: 'https://www.wikimedia.org/static/images/project-logos/wikidatawiki.png',
  sparql: `SELECT ?subject ?name
WHERE
{
   ?klass wdt:P279* $(class) .
?subject wdt:P31 ?klass .
?subject wdt:P18 ?pic ; rdfs:label ?name.
FILTER regex(?name, "$(name)", "i")

# SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en" }
} LIMIT $(limit) `, // was SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en" }
  endpoint: 'https://query.wikidata.org/sparql',
  class: {  AcademicInsitution: 'http://www.wikidata.org/entity/Q4671277',
            Enterprise:        'http://www.wikidata.org/entity/Q6881511',
            Business:          'http://www.wikidata.org/entity/Q4830453',
            NGO:               'http://www.wikidata.org/entity/Q79913',
            CharitableOrganization: 'http://www.wikidata.org/entity/Q708676',
            Insitute: 'http://www.wikidata.org/entity/Q1664720'}
}

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

export async function queryPublicDataByName (filter: string, theClass:NamedNode, queryTarget: QueryParameters): Promise<Bindings> {
  const sparql = queryTarget.sparql
    .replace('$(name)', filter)
    .replace('$(limit)', '' + AUTOCOMPLETE_LIMIT)
    .replace('$(class)', theClass)
  console.log('Querying public data - sparql: ' + sparql)
  return queryPublicData(sparql, queryTarget)
}

export async function queryPublicData (sparql: string, queryTarget: QueryParameters): Promise<Bindings> {
  const myUrlWithParams = new URL(queryTarget.endpoint);
  myUrlWithParams.searchParams.append("query", sparql);
  const queryURI = myUrlWithParams.href
  console.log(' queryPublicData uri: ' + queryURI);

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
  const bindings = await queryPublicData(sparql, dbpediaParameters)
  bindings.forEach(binding => {
    const uri = binding.subject.value
    const name = binding.name.value
  })
}
