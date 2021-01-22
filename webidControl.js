// Render a control to record the webids we have for this agent
/* eslint-disable multiline-ternary */
import * as UI from 'solid-ui'
// import { renderAutoComplete } from './lib/autocompletePicker' // dbpediaParameters
import { renderAutocompleteControl } from './lib/autocompleteBar'
import { wikidataParameters, loadPublicDataThing, wikidataClasses } from './lib/publicData' // dbpediaParameters

const $rdf = UI.rdf
const ns = UI.ns
const widgets = UI.widgets
const utils = UI.utils
const kb = UI.store
const style = UI.style

const WEBID_NOUN = 'Solid ID'
const PUBLICID_NOUN = 'In public data'
const DOWN_ARROW = UI.icons.iconBase + 'noun_1369241.svg'
const UP_ARROW = UI.icons.iconBase + 'noun_1369237.svg'
const webidPanelBackgroundColor = '#ffe6ff'

/// ///////////////////////// Logic

export async function addWebIDToContacts (person, webid, urlType, kb) {
  /*
  if (!webid.startsWith('https:')) { /// @@ well we will have other protcols like DID
    if (webid.startsWith('http://') {
      webid = 'https:' + webid.slice(5) // @@ No, data won't match in store. Add the 's' on fetch()
    } else {
      throw new Error('Does not look like a webid, must start with https: ' + webid)
    }
  }
  */
  console.log(`Adding to ${person} a ${WEBID_NOUN}: ${webid}.`)
  const vcardURLThing = kb.bnode()
  const insertables = [
    $rdf.st(person, ns.vcard('url'), vcardURLThing, person.doc()),
    $rdf.st(vcardURLThing, ns.rdf('type'), urlType, person.doc()),
    $rdf.st(vcardURLThing, ns.vcard('value'), webid, person.doc())
  ]
  await kb.updater.update([], insertables)
}

export async function removeWebIDFromContacts (person, webid, urlType, kb) {
  console.log(`Removing from ${person} their ${WEBID_NOUN}: ${webid}.`)
  const existing = kb.each(person, ns.vcard('url'), null, person.doc())
    .filter(urlObject => kb.holds(urlObject, ns.rdf('type'), urlType, person.doc()))
    .filter(urlObject => kb.holds(urlObject, ns.vcard('value'), webid, person.doc()))
  if (!existing.length) {
    throw new Error(`Person ${person} does not have ${WEBID_NOUN} ${webid}.`)
  }
  const vcardURLThing = existing[0]
  const deletables = [
    $rdf.st(person, ns.vcard('url'), vcardURLThing, person.doc()),
    $rdf.st(vcardURLThing, ns.rdf('type'), urlType, person.doc()),
    $rdf.st(vcardURLThing, ns.vcard('value'), webid, person.doc())
  ]
  await kb.updater.update(deletables, [])
}

// Trace things the same as this - other IDs for same thing
// returns as array of node
export function getSameAs (kb, thing, doc) { // Should this recurse?
  const found = new Set()
  const agenda = new Set([thing.uri])

  while (agenda.size) {
    const uri = Array.from(agenda)[0] // clumsy
    agenda.delete(uri)
    if (found.has(uri)) continue
    found.add(uri)
    const node = kb.sym(uri)
    kb.each(node, ns.owl('sameAs'), null, doc)
      .concat(kb.each(null, ns.owl('sameAs'), node, doc))
      .forEach(next => {
        console.log('        OWL sameAs found ' + next)
        agenda.add(next.uri)
      })
    kb.each(node, ns.schema('sameAs'), null, doc)
      .concat(kb.each(null, ns.schema('sameAs'), node, doc))
      .forEach(next => {
        console.log('        Schema sameAs found ' + next)
        agenda.add(next.uri)
      })
  }
  found.delete(thing.uri) // don't want the one we knew about
  return Array.from(found).map(uri => kb.sym(uri)) // return as array of nodes
}

export function getPersonas (kb, person) {
  const lits = vcardWebIDs(kb, person).concat(getSameAs(kb, person, person.doc()))
  const strings = new Set(lits.map(lit => lit.value)) // remove dups
  const personas = [...strings].map(uri => kb.sym(uri)) // The UI tables do better with Named Nodes than Literals
  personas.sort() // for repeatability
  personas.filter(x => !x.sameTerm(person))
  return personas
}

export function vcardWebIDs (kb, person, urlType) {
  return kb.each(person, ns.vcard('url'), null, person.doc())
    .filter(urlObject => kb.holds(urlObject, ns.rdf('type'), urlType, person.doc()))
    .map(urlObject => kb.any(urlObject, ns.vcard('value'), null, person.doc()))
    .filter(x => !!x) // remove nulls
}

export function isOrganization (agent) {
  const doc = agent.doc()
  return kb.holds(agent, ns.rdf('type'), ns.vcard('Organization'), doc) ||
    kb.holds(agent, ns.rdf('type'), ns.schema('Organization'), doc)
}
/// ////////////////////////////////////////////////////////////// UI

// Utility function to render another different pane

export function renderNamedPane (dom, subject, paneName, dataBrowserContext) {
  const p = dataBrowserContext.session.paneRegistry.byName(paneName)
  const d = p.render(subject, dataBrowserContext) // @@@ change some bits of context!
  d.setAttribute(
    'style',
    'border: 0.1em solid #444; border-radius: 0.5em'
  )
  return d
}

export async function renderWebIdControl (person, dataBrowserContext) {
  const options = {
    longPrompt: `If you know someone's ${WEBID_NOUN}, you can do more stuff with them.
    To record their ${WEBID_NOUN}, drag it onto the plus, or click the plus
    to enter it by hand.`,
    idNoun: WEBID_NOUN,
    urlType: ns.vcard('WebID')
  }
  return renderIdControl(person, dataBrowserContext, options)
}

export async function renderPublicIdControl (person, dataBrowserContext) {
  let orgClass = kb.sym('http://www.wikidata.org/wiki/Q43229')
  let orgClassId = 'Organization'
  for (const classId in wikidataClasses) {
    if (kb.holds(person, ns.rdf('type'), ns.schema(classId), person.doc())) {
      orgClass = kb.sym(wikidataClasses[classId])
      orgClassId = classId
      console.log(`  renderPublicIdControl bingo: ${classId} -> ${orgClass}`)
    }
  }
  const options = {
    longPrompt: `If you know the ${PUBLICID_NOUN} of this ${orgClassId}, you can do more stuff with it.
    To record its ${PUBLICID_NOUN}, drag it onto the plus, or click the magnifyinng glass
    to search for it in WikiData.`,
    idNoun: PUBLICID_NOUN,
    urlType: ns.vcard('PublicId'),
    dbLookup: true,
    class: orgClass, // Organization
    queryParams: wikidataParameters
  }
  return renderIdControl(person, dataBrowserContext, options)
}

// The main control rendered by this module
export async function renderIdControl (person, dataBrowserContext, options) {
  // IDs which are as WebId in VCARD data
  // like  :me vcard:hasURL [ a vcard:WebId; vcard:value <https://...foo> ]
  //
  // Display the data about x specifically stored at x.doc()
  // in a fold-away thing
  //
  function renderPersona (dom, persona, kb) {
    function profileOpenHandler (_event) {
      profileIsVisible = !profileIsVisible
      main.style.visibility = profileIsVisible ? 'visible' : 'collapse'
      openButton.children[0].src = profileIsVisible ? UP_ARROW : DOWN_ARROW // @@ fragile
    }
    function renderNewRow (webidObject) {
      const webid = new $rdf.Literal(webidObject.uri)
      async function deleteFunction () {
        try {
          await removeWebIDFromContacts(person, webid, options.urlType, kb)
        } catch (err) {
          div.appendChild(widgets.errorMessageBlock(dom, `Error removing Id ${webid} from ${person}: ${err}`))
        }
        await refreshWebIDTable()
      }
      const isWebId = options.urlType.sameTerm(ns.vcard('WebID'))
      const delFunParam = options.editable ? deleteFunction : null
      const opts = { deleteFunction: delFunParam, draggable: true }
      if (isWebId) {
        opts.title = webidObject.uri.split('/')[2]
        opts.image = widgets.faviconOrDefault(dom, webidObject.site()) // just for domain
      }
      const row = widgets.personTR(dom, UI.ns.foaf('knows'), webidObject, opts)
      if (isWebId) {
        row.children[1].textConent = opts.title // @@ will be overwritten
        row.style.backgroundColor = webidPanelBackgroundColor
      }
      row.style.padding = '0.2em'
      return row
    }

    const div = dom.createElement('div')
    div.style.width = '100%'
    const personaTable = div.appendChild(dom.createElement('table'))
    personaTable.style.width = '100%'
    const nav = personaTable.appendChild(renderNewRow(persona))
    nav.style.width = '100%'
    const mainRow = personaTable.appendChild(dom.createElement('tr'))
    const mainCell = mainRow.appendChild(dom.createElement('td'))
    mainCell.setAttribute('colspan', 3)
    let main

    var profileIsVisible = true

    const rhs = nav.children[2]
    const openButton = rhs.appendChild(widgets.button(dom, DOWN_ARROW, 'View', profileOpenHandler))
    openButton.style.float = 'right'
    delete openButton.style.backgroundColor
    delete openButton.style.border
    const paneName = isOrganization(person) || isOrganization(persona) ? 'default' : 'profile'

    loadPublicDataThing(kb, person, persona).then(_resp => {
      try {
        main = renderNamedPane(dom, persona, paneName, dataBrowserContext)
        console.log('main: ', main)
        main.style.width = '100%'
        console.log('renderIdControl: main element: ', main)
        // main.style.visibility = 'collapse'
        mainCell.appendChild(main)
      } catch (err) {
        main = widgets.errorMessageBlock(dom, `Problem displaying persona ${persona}: ${err}`)
        mainCell.appendChild(main)
      }
    }, err => {
      main = widgets.errorMessageBlock(dom, `Error loading persona ${persona}: ${err}`)
      mainCell.appendChild(main)
    })
    return div
  } // renderPersona

  async function refreshWebIDTable () {
    const personas = getPersonas(kb, person)
    console.log('WebId personas: ' + person + ' -> ' + personas.map(p => p.uri).join(',\n  '))
    prompt.style.display = personas.length ? 'none' : ''
    utils.syncTableToArrayReOrdered(profileArea, personas, persona => renderPersona(dom, persona, kb))
  }
  async function addOneIdAndRefresh (person, webid) {
    try {
      await addWebIDToContacts(person, webid, options.urlType, kb)
    } catch (err) {
      div.appendChild(widgets.errorMessageBlock(dom, `Error adding Id ${webid} to ${person}: ${err}`))
    }
    await refreshWebIDTable()
  }

  const { dom } = dataBrowserContext
  options = options || {}
  options.editable = kb.updater.editable(person.doc().uri, kb)
  const div = dom.createElement('div')
  div.style = 'border-radius:0.3em; border: 0.1em solid #888;' // padding: 0.8em;

  if (getPersonas(kb, person).length === 0 && !options.editable) {
    div.style.display = 'none'
    return div // No point listing an empty list you can't change
  }

  const h4 = div.appendChild(dom.createElement('h4'))
  h4.textContent = options.idNoun
  h4.style = style.formHeadingStyle
  h4.style.color = style.highlightColor

  const prompt = div.appendChild(dom.createElement('p'))
  prompt.style = style.commentStyle
  prompt.textContent = options.longPrompt
  const table = div.appendChild(dom.createElement('table'))
  table.style.width = '100%'

  if (options.editable) { // test
    options.queryParams = options.queryParams || wikidataParameters
    div.appendChild(await renderAutocompleteControl(dom, person, options, addOneIdAndRefresh))
  }
  const profileArea = div.appendChild(dom.createElement('div'))
  await refreshWebIDTable()

  return div
}
