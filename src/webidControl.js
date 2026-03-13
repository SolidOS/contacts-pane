// Render a control to record the webids we have for this agent

import * as UI from 'solid-ui'
import { store } from 'solid-logic'
import { updateMany } from './contactLogic'
import * as $rdf from 'rdflib'
import './styles/webidControl.css'
import * as debug from './debug'

const ns = UI.ns
const widgets = UI.widgets
const utils = UI.utils
const kb = store

const wikidataClasses = widgets.publicData.wikidataClasses // @@ move to solid-logic
const wikidataParameters = widgets.publicData.wikidataParameters // @@ move to solid-logic

const WEBID_NOUN = 'WebID'
const PUBLICID_NOUN = 'WikiData link'
const DOWN_ARROW = UI.icons.iconBase + 'noun_1369241.svg'
const UP_ARROW = UI.icons.iconBase + 'noun_1369237.svg'

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

  // check this is a url
  try {
    // eslint-disable-next-line no-unused-vars
    const _url = new URL(webid)
  } catch (error) {
    throw new Error(`${WEBID_NOUN}: ${webid} is not a valid url.`)
  }

  // create a person's webID
  debug.log(`Adding to ${person} a ${WEBID_NOUN}: ${webid}.`)
  const vcardURLThing = kb.bnode()
  const insertables = [
    $rdf.st(person, ns.vcard('url'), vcardURLThing, person.doc()),
    $rdf.st(vcardURLThing, ns.rdf('type'), urlType, person.doc()),
    $rdf.st(vcardURLThing, ns.vcard('value'), webid, person.doc())
  ]
  // insert WebID in groups
  // replace person with WebID in vcard:hasMember (WebID may already exist)
  // insert owl:sameAs
  const groups = kb.each(null, ns.vcard('hasMember'), person)
  let deletables = []
  groups.forEach(group => {
    deletables = deletables.concat(kb.statementsMatching(group, ns.vcard('hasMember'), person, group.doc()))
    insertables.push($rdf.st(group, ns.vcard('hasMember'), kb.sym(webid), group.doc())) // May exist; do we need to check?
    insertables.push($rdf.st(kb.sym(webid), ns.owl('sameAs'), person, group.doc()))
  })
  try {
    await updateMany(deletables, insertables)
  } catch (err) { throw new Error(`Could not create webId ${WEBID_NOUN}: ${webid}.`) }
}

export async function removeWebIDFromContacts (person, webid, urlType, kb) {
  debug.log(`Removing from ${person} their ${WEBID_NOUN}: ${webid}.`)

  // remove webID from card
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

  // remove webIDs from groups
  const groups = kb.each(null, ns.vcard('hasMember'), kb.sym(webid))
  let removeFromGroups = []
  const insertInGroups = []
  groups.forEach(async group => {
    removeFromGroups = removeFromGroups.concat(kb.statementsMatching(kb.sym(webid), ns.owl('sameAs'), person, group.doc()))
    insertInGroups.push($rdf.st(group, ns.vcard('hasMember'), person, group.doc()))
    if (kb.statementsMatching(kb.sym(webid), ns.owl('sameAs'), null, group.doc()).length < 2) {
      removeFromGroups = removeFromGroups.concat(kb.statementsMatching(group, ns.vcard('hasMember'), kb.sym(webid), group.doc()))
    }
  })
  await updateMany(removeFromGroups, insertInGroups)
}

// Trace things the same as this - other IDs for same thing
// returns as array of node
function getSameAs (kb, thing, doc) { // Should this recurse?
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
        debug.log('        OWL sameAs found ' + next)
        agenda.add(next.uri)
      })
    kb.each(node, ns.schema('sameAs'), null, doc)
      .concat(kb.each(null, ns.schema('sameAs'), node, doc))
      .forEach(next => {
        debug.log('        Schema sameAs found ' + next)
        agenda.add(next.uri)
      })
  }
  found.delete(thing.uri) // don't want the one we knew about
  return Array.from(found).map(uri => kb.sym(uri)) // return as array of nodes
}

// find person webIDs
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
  d.classList.add('namedPane')
  return d
}

export async function renderWebIdControl (person, dataBrowserContext) {
  const options = {
    longPrompt: `Link to a ${WEBID_NOUN}?`,
    idNoun: WEBID_NOUN,
    urlType: ns.vcard('WebID')
  }
  return renderIdControl(person, dataBrowserContext, options)
}

export async function renderPublicIdControl (person, dataBrowserContext) {
  let orgClass = kb.sym('http://www.wikidata.org/wiki/Q43229')
  for (const classId in wikidataClasses) {
    if (kb.holds(person, ns.rdf('type'), ns.schema(classId), person.doc())) {
      orgClass = kb.sym(wikidataClasses[classId])
      debug.log(`  renderPublicIdControl bingo: ${classId} -> ${orgClass}`)
    }
  }
  const options = {
    longPrompt: `Add a ${PUBLICID_NOUN}?`,
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
      main.classList.toggle('collapsed', !profileIsVisible)
      openButton.children[0].src = profileIsVisible ? UP_ARROW : DOWN_ARROW // @@ fragile
      openButton.setAttribute('aria-expanded', profileIsVisible ? 'true' : 'false')
      openButton.setAttribute('aria-label', profileIsVisible ? 'Collapse profile' : 'Expand profile')
    }
    function renderNewRow (webidObject) {
      const webid = new $rdf.Literal(webidObject.uri)
      async function deleteFunction () {
        try {
          await removeWebIDFromContacts(person, webid, options.urlType, kb)
        } catch (err) {
          debug.error(`Error removing Id ${webid} from ${person}: ${err}`)
          div.appendChild(widgets.errorMessageBlock(dom, 'Error removing WebId from profile. If it persists, contact admin.'))
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
        row.classList.add('personaRow--webid')
      }
      row.classList.add('personaRow')
      return row
    }

    const div = dom.createElement('div')
    div.classList.add('fullWidth')
    const personaTable = div.appendChild(dom.createElement('table'))
    personaTable.classList.add('fullWidth')
    const nav = personaTable.appendChild(renderNewRow(persona))
    nav.classList.add('fullWidth')
    const mainRow = personaTable.appendChild(dom.createElement('tr'))
    const mainCell = mainRow.appendChild(dom.createElement('td'))
    mainCell.setAttribute('colspan', 3)
    let main

    let profileIsVisible = true

    const rhs = nav.children[2]
    const openButton = rhs.appendChild(widgets.button(dom, DOWN_ARROW, 'View', profileOpenHandler))
    openButton.classList.add('personaOpenButton')
    openButton.setAttribute('aria-expanded', 'true')
    openButton.setAttribute('aria-label', 'Collapse profile')
    const paneName = isOrganization(person) || isOrganization(persona) ? 'profile' : 'profile' // was default for org

    widgets.publicData.loadPublicDataThing(kb, person, persona).then(_resp => {
    // loadPublicDataThing(kb, person, persona).then(_resp => {
      try {
        main = renderNamedPane(dom, persona, paneName, dataBrowserContext)
        main.classList.add('fullWidth')
        // main.style.visibility = 'collapse'
        mainCell.appendChild(main)
      } catch (err) {
        debug.error('Error displaying persona ' + persona + '. Stack: ' + err)
        main = widgets.errorMessageBlock(dom, 'Error displaying profile. If it persists, contact admin.')
        mainCell.appendChild(main)
      }
    }, err => {
      debug.error('Error loading persona ' + persona + '. Stack: ' + err)
      main = widgets.errorMessageBlock(dom, 'Error loading profile. If it persists, contact admin.')
      mainCell.appendChild(main)
    })
    return div
  } // renderPersona

  async function refreshWebIDTable () {
    const personas = getPersonas(kb, person)
    prompt.classList.toggle('hidden', personas.length > 0)
    utils.syncTableToArrayReOrdered(profileArea, personas, persona => renderPersona(dom, persona, kb))
  }
  async function addOneIdAndRefresh (person, webid) {
    try {
      await addWebIDToContacts(person, webid, options.urlType, kb)
    } catch (err) {
      debug.error('Error adding webId ' + webid + ' to ' + person + '. Stack: ' + err)
      div.appendChild(widgets.errorMessageBlock(dom, 'Error adding WebID to profile. If it persists, contact admin.'))
    }
    await refreshWebIDTable()
  }

  const { dom } = dataBrowserContext
  options = options || {}
  options.editable = kb.updater.editable(person.doc().uri, kb)
  const div = dom.createElement('div')
  div.classList.add('webidControl')

  if (getPersonas(kb, person).length === 0 && !options.editable) {
    div.classList.add('hidden')
    return div // No point listing an empty list you can't change
  }

  const h3 = div.appendChild(dom.createElement('h3'))
  h3.textContent = options.idNoun
  h3.classList.add('webidHeading')

  const prompt = div.appendChild(dom.createElement('p'))
  prompt.classList.add('webidPrompt')
  prompt.textContent = options.longPrompt
  const table = div.appendChild(dom.createElement('table'))
  table.classList.add('fullWidth')

  if (options.editable) { // test
    const barOptions = {
      editable: options.editable,
      manualURIEntry: true, // introduced in solid-ui 2.4.2
      idNoun: options.idNoun,
      dbLookup: options.dbLookup
    }
    const acOptions = {
      queryParams: options.queryParams || wikidataParameters,
      targetClass: options.class
    }
    try {
      div.appendChild(await widgets.renderAutocompleteControl(dom, person, barOptions, acOptions, addOneIdAndRefresh))
    } catch (err) {
      debug.error('Render Autocomplete Control failed. Stack:', err)
      div.appendChild(widgets.errorMessageBlock(dom, 'Error rendering autocomplete. If it persists, contact admin.'))
    }
  }
  const profileArea = div.appendChild(dom.createElement('div'))
  await refreshWebIDTable()

  return div
}
