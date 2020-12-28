/* Logic to access public data stores
*
* including filtering resut by natural language etc
*/
import { NamedNode, Store, st, Literal, parse } from 'rdflib'

import { icons, ns, style, widgets, store } from 'solid-ui'
import * as instituteDetailsQuery from '../lib/instituteDetailsQuery.js'

const kb = store

export const AUTOCOMPLETE_LIMIT = 100 // How many to get from server

const subjectRegexp = /\$\(subject\)/g

interface Term {
  type: string;
  value: string
}

interface Binding {
  subject: Term;
  name?: Term
  location?: Term
  coordinates?: Term
}

type Bindings = Binding[]

export type QueryParameters =
{ label: string;
  logo: string;
  searchByNameQuery?: string;
  insitituteDetailsQuery?: string;
  endpoint: string;
  class: object
}

export async function getPreferredLanguages () {
  return [ 'fr', 'en',  'de', 'it'] // @@ testing only -- code me later
}
export const dbpediaParameters:QueryParameters = {
  label: 'DBPedia',
  logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/DBpediaLogo.svg/263px-DBpediaLogo.svg.png',
  searchByNameQuery: `select distinct ?subject, ?name where {
    ?subject a $(class); rdfs:label ?name
    FILTER regex(?name, "$(name)", "i")
  } LIMIT $(limit)`,
  endpoint: 'https://dbpedia.org/sparql/',
    class: { AcademicInsitution: 'http://umbel.org/umbel/rc/EducationalOrganization'}
}

export const wikidataParameters = {
  label: 'WikiData',
  logo: 'https://www.wikimedia.org/static/images/project-logos/wikidatawiki.png',
  endpoint: 'https://query.wikidata.org/sparql',
  class: {  AcademicInsitution: 'http://www.wikidata.org/entity/Q4671277',
            Enterprise:        'http://www.wikidata.org/entity/Q6881511',
            Business:          'http://www.wikidata.org/entity/Q4830453',
            NGO:               'http://www.wikidata.org/entity/Q79913',
            CharitableOrganization: 'http://www.wikidata.org/entity/Q708676',
            Insitute: 'http://www.wikidata.org/entity/Q1664720',
  },
  searchByNameQuery: `SELECT ?subject ?name
          WHERE
          {
             ?klass wdt:P279* $(class) .
          ?subject wdt:P31 ?klass .
          ?subject wdt:P18 ?pic ; rdfs:label ?name.
          FILTER regex(?name, "$(name)", "i")

          # SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en" }
          } LIMIT $(limit) `, // was SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en" }

  insitituteDetailsQuery: `CONSTRUCT
{  wd:Q49108 schema:name ?itemLabel;
             schema:logo ?logo;
              schema:logo  ?sealImage;
             schema:subOrganization  ?subsidiary .
                 ?subsidiary schema:name ?subsidiaryLabel .
}
WHERE
{
   wd:Q49108 # rdfs:label ?itemLabel ;
             wdt:P154 ?logo;
              wdt:P158  ?sealImage ;
             wdt:P355  ?subsidiary .
          #  ?subsidiary rdfs:label ?subsidiaryLabel .

  SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE], fr". }
}`
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
    const bindings = uris[u]
    const sortMe  = bindings.map(binding => {
      return [ languagePrefs2.indexOf(binding.name['xml:lang']), binding]
    })
    sortMe.sort() // best at th ebottom
    sortMe.reverse() // best at the top
    slimmed.push(sortMe[0][1])
  } // map u
  return slimmed
}

export var wikidataClassMap = {
  'http://www.wikidata.org/entity/Q15936437': ns.schema('CollegeOrUniversity'), // research university
  'http://www.wikidata.org/entity/Q1664720': ns.schema('EducationalOrganization'), // insitute @@
  'http://www.wikidata.org/entity/Q43229': ns.schema('Organization'), // research university
  'http://www.wikidata.org/entity/Q3918': ns.schema('CollegeOrUniversity'), // university
  'http://www.wikidata.org/entity/Q170584': ns.schema('Project'), // university
  'http://www.wikidata.org/entity/Q327333': ns.schema('GovernmentOrganization'), // gobvt agency
  'http://www.wikidata.org/entity/Q2221906': ns.schema('Place'), // geographic location

}
export var predMap = { // allow other mappings top added in theory
  class: ns.rdf('type'),
  // logo: ns.schema('logo'),
  sealImage: ns.schema('logo'),
  //image: ns.schema('image'),   defaults to shema
  shortName:ns.foaf('nick'),
  subsidiary: ns.schema('subOrganization')
}

export function loadFromBindings (kb, solidSubject:NamedNode, bindings, doc) {
  var results = {}
  console.log(`loadFromBindings:  subject: ${solidSubject}`)
  console.log(`                       doc: ${doc}`)
  bindings.forEach(binding => {
    for (const key in binding) {
      const result = binding[key]
      const combined = JSON.stringify(result) // ( result.type, result.value )
      results[key] = results[key] || new Set()
      results[key].add(combined) // remove duplicates
    }
  })
  for (const key in results) {
    const values = results[key]
    console.log(`    results ${key} -> ${values}`)
    values.forEach(combined => {
      const result = JSON.parse(combined)
      const { type, value } = result
      var obj
      if (type === 'uri') {
        obj = kb.sym(value)
      } else if (type === 'literal') {
        obj = new Literal(value, result.language, result.datatype)
      } else {
        throw new Error(`loadFromBindings:  unexpected type: ${type}`)
      }
      if (key == 'type') {
        if (wikidataClassMap[value]) {
          obj = wikidataClassMap[value]
        } else {
          console.warn('Unmapped Wikidata Class: ' + value)
        }
      } else if (key === 'coordinates') {
        // const latlong = value // Like 'Point(-71.106111111 42.375)'
        console.log('         @@@ hey a point: ' + value)
        const regexp =/.*\(([-0-9\.-]*) ([-0-9\.-]*)\)/
        const match = regexp.exec(value)
        const float = ns.xsd('float')
        const latitude = new Literal(match[1], null, float)
        const longitude = new Literal(match[2], null, float)
        kb.add(solidSubject, ns.schema('longitude'), longitude, doc)
        kb.add(solidSubject, ns.schema('latitude'), latitude, doc)
      } else if (predMap[key]) {
        const pred = predMap[key] || ns.schema(key) // fallback to just using schema.org
        kb.add(solidSubject, pred, obj, doc) // @@ deal with non-string and objects
        console.log(`  public data ${pred} ${obj}.`)
      }
    })
  }
}
/*  Query all entities of given class and partially matching name
*/
export async function queryPublicDataByName (filter: string, theClass:NamedNode, queryTarget: QueryParameters): Promise<Bindings> {
  const sparql = queryTarget.searchByNameQuery
    .replace('$(name)', filter)
    .replace('$(limit)', '' + AUTOCOMPLETE_LIMIT)
    .replace('$(class)', theClass)
  console.log('Querying public data - sparql: ' + sparql)
  return queryPublicDataSelect(sparql, queryTarget)
}

export async function queryPublicDataSelect (sparql: string, queryTarget: QueryParameters): Promise<Bindings> {
  const myUrlWithParams = new URL(queryTarget.endpoint);
  myUrlWithParams.searchParams.append("query", sparql);
  const queryURI = myUrlWithParams.href
  console.log(' queryPublicDataSelect uri: ' + queryURI);

  const options = { credentials: 'omit',
    headers: { 'Accept': 'application/json'}
  } // CORS
  var response
  response = await kb.fetcher.webOperation('GET', queryURI, options)
  //complain('Error querying db of organizations: ' + err)
  const text = response.responseText
  console.log('    Query result  text' + text.slice(0,500) + '...')
  if (text.length === 0) throw new Error('Wot no text back from query ' + queryURI)
  const json = JSON.parse(text)
  console.log('    Query result JSON' + JSON.stringify(json, null, 4).slice(0,500) + '...')
  const bindings = json.results.bindings
  return bindings
}

export async function queryPublicDataConstruct (sparql: string, pubicId: NamedNode, queryTarget: QueryParameters): Promise<Bindings> {
  console.log('queryPublicDataConstruct: sparql:', sparql)
  const myUrlWithParams = new URL(queryTarget.endpoint);
  myUrlWithParams.searchParams.append("query", sparql);
  const queryURI = myUrlWithParams.href
  console.log(' queryPublicDataConstruct uri: ' + queryURI);
  const options = { credentials: 'omit', // CORS
    headers: { 'Accept': 'text/turtle'}
  }
  const response = await kb.fetcher.webOperation('GET', queryURI, options)
  const text = response.responseText
  const report = text.lenth > 500 ? text.slice(0,200) + ' ... ' + text.slice(-200) : text
  console.log('    queryPublicDataConstruct result text:' + report)
  if (text.length === 0) throw new Error('queryPublicDataConstruct: No text back from construct query:' + queryURI)
  parse(text, kb, pubicId.uri, 'text/turtle')
  return
}

export async function loadPublicDataThing (kb, subject: NamedNode, publicDataID: NamedNode) {

  if (publicDataID.uri.startsWith('https://dbpedia.org/resource/')) {
    return getDbpediaDetails(kb, subject, publicDataID)
  } else if (publicDataID.uri.startsWith('http://www.wikidata.org/entity/')) {
    const QId = publicDataID.uri.split('/')[4]
    const dataURI = `http://www.wikidata.org/wiki/Special:EntityData/${QId}.ttl`
    // In fact loading the data URI gives much to much irrelevant data, from wikidata.
    await getWikidataDetails(kb, subject, publicDataID)
    await getWikidataLocation(kb, subject, publicDataID)
  } else {
    const iDToFetch = publicDataID.uri.startsWith('http:') ? kb.sym('https:' + publicDataID.uri.slice(5))
     : publicDataID
    return kb.fetcher.load(iDToFetch, { credentials: 'omit',
        headers: { 'Accept': 'text/turtle'}
    })
  }
}

export async function getWikidataDetails (kb, solidSubject:NamedNode, publicDataID:NamedNode) {
  const subjRegexp = /wd:Q49108/g
  const sparql = instituteDetailsQuery.replace(subjRegexp, publicDataID)
  await queryPublicDataConstruct(sparql, publicDataID, wikidataParameters)
  console.log('getWikidataDetails: loaded.', publicDataID)
}

export async function getWikidataDetailsOld (kb, solidSubject:NamedNode, publicDataID:NamedNode) {
  const sparql = `select distinct *  where {
  optional { $(subject)  wdt:P31  ?class } # instance of
  optional { $(subject)  wdt:P154  ?logo }
  optional { $(subject)  wdt:P158  ?sealImage }
# optional { $(subject)  wdt:P159  ?headquartersLocation }

optional { $(subject)  wdt:P17  ?country }
optional { $(subject)  wdt:P18  ?image }
optional { $(subject)  wdt:P1813  ?shortName }

optional { $(subject)  wdt:P355  ?subsidiary }
# SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en,de,it" }
}`
  .replace(subjectRegexp, publicDataID)
  const bindings = await queryPublicDataSelect(sparql, wikidataParameters)
  loadFromBindings (kb, publicDataID, bindings, publicDataID.doc()) //arg2 was solidSubject
}

export async function getWikidataLocation (kb, solidSubject:NamedNode, publicDataID:NamedNode) {
  const sparql = `select distinct *  where {

  $(subject) wdt:P276 ?location .

  optional { ?location  wdt:P2044  ?elevation }
  optional { ?location  wdt:P131  ?region }
  optional { ?location wdt:P625 ?coordinates }
optional {  ?location  wdt:P17  ?country }

# SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en,de,it" }
}`.replace(subjectRegexp, publicDataID)
  console.log( ' location query sparql:'  + sparql)
  const bindings = await queryPublicDataSelect(sparql, wikidataParameters)
  console.log(' location query bindings:', bindings)
  loadFromBindings (kb, publicDataID, bindings, publicDataID.doc()) // was solidSubject
}


export async function getDbpediaDetails (kb, solidSubject:NamedNode, publicDataID:NamedNode) {
// Note below the string form of the named node with <> works in SPARQL
  const sparql = `select distinct ?city, ?state, ?country, ?homepage, ?logo, ?lat, ?long,  WHERE {
    OPTIONAL { <${publicDataID}> <http://dbpedia.org/ontology/city> ?city }
    OPTIONAL { ${publicDataID} <http://dbpedia.org/ontology/state> ?state }
    OPTIONAL { ${publicDataID} <http://dbpedia.org/ontology/country> ?country }
    OPTIONAL { ${publicDataID} foaf:homepage ?homepage }
    OPTIONAL { ${publicDataID} foaf:lat ?lat; foaf:long ?long }
    OPTIONAL { ${publicDataID} <http://dbpedia.org/ontology/country> ?country }
   }`
   const predMap = {
     city: ns.vcard('locality'),
     state: ns.vcard('region'),
     country: ns.vcard('country-name'),
     homepage: ns.foaf('homepage'),
     lat: ns.geo('latitude'),
     long: ns.geo('longitude'),
   }
  const bindings = await queryPublicDataSelect(sparql, dbpediaParameters)
  bindings.forEach(binding => {
    const uri = binding.subject.value // @@ To be written
    const name = binding.name.value
  })
}
