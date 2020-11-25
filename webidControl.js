// Render a control to record the webids we have for this agent
/* eslint-disable multiline-ternary */
import * as UI from 'solid-ui'

const $rdf = UI.rdf
const ns = UI.ns
// const buttons = UI.buttonsn  no
const widgets = UI.widgets
const utils = UI.utils
const kb = UI.store
const style = UI.style

const WEBID_NOUN = 'Solid ID'

const GREEN_PLUS = UI.icons.iconBase + 'noun_34653_green.svg'
const DOWN_ARROW = UI.icons.iconBase + 'noun_1369241.svg'
const UP_ARROW = UI.icons.iconBase + 'noun_1369237.svg'

const webidPanelBackgroundColor = '#ffe6ff'

// Logic
export async function addWebIDToContacts (person, webid, context) {
  if (!webid.startsWith('https:')) { /// @@ well we will have other protcols like DID
    throw new Error('Does not look like a webid, must start with https:')
  }
  console.log(`Adding to ${person} a ${WEBID_NOUN}: ${webid}.`)
  const kb = context.kb
  const vcardURLThing = kb.bnode()
  const insertables = [
    $rdf.st(person, ns.vcard('url'), vcardURLThing, person.doc()),
    $rdf.st(vcardURLThing, ns.rdf('type'), ns.vcard('WebID'), person.doc()),
    $rdf.st(vcardURLThing, ns.vcard('value'), webid, person.doc())
  ]
  await kb.updater.update([], insertables)
}

export async function removeWebIDFromContacts (person, webid, context) {
  const { kb } = context
  console.log(`Removing from ${person} their ${WEBID_NOUN}: ${webid}.`)
  const existing = kb.each(person, ns.vcard('url'), null, person.doc())
    .filter(urlObject => kb.holds(urlObject, ns.rdf('type'), ns.vcard('WebID'), person.doc()))
    .filter(urlObject => kb.holds(urlObject, ns.vcard('value'), webid, person.doc()))
  if (!existing.length) {
    throw new Error(`Person ${person} does not have ${WEBID_NOUN} ${webid}.`)
  }
  const vcardURLThing = existing[0]
  const deletables = [
    $rdf.st(person, ns.vcard('url'), vcardURLThing, person.doc()),
    $rdf.st(vcardURLThing, ns.rdf('type'), ns.vcard('WebID'), person.doc()),
    $rdf.st(vcardURLThing, ns.vcard('value'), webid, person.doc())
  ]
  await kb.updater.update(deletables, [])
}

// The control rendered by this module
export async function renderWedidControl (person, dataBrowserContext) {
  // IDs which are as WebId in VCARD data
  // like  :me vcard:hasURL [ a vcard:WebId; vcard:value <https://...foo> ]
  //
  function vcardWebIDs (person) {
    return kb.each(person, ns.vcard('url'), null, person.doc())
      .filter(urlObject => kb.holds(urlObject, ns.rdf('type'), ns.vcard('WebID'), person.doc()))
      .map(urlObject => kb.any(urlObject, ns.vcard('value'), null, person.doc()))
      .filter(x => !!x) // remove nulls
  }

  function _getAliases (person) {
    return kb.allAliases(person) // All the terms linked by sameAs
      .filter(x => !x.sameTerm(person)) // Except this one
  }

  // Trace things the same as this - other IDs for same thing
  // returns as array of node
  function getSameAs (thing, doc) { // Should this recurse?
    const found = new Set()
    const agenda = new Set([thing.uri])

    while (agenda.size) {
      const uri = Array.from(agenda)[0] // clumsy
      agenda.delete(uri)
      if (found.has(uri)) continue
      found.add(uri)
      const node = kb.sym(uri)
      const left = kb.each(node, ns.owl('sameAs'), null, doc)
      const right = kb.each(null, ns.owl('sameAs'), node, doc)
      left.concat(right).forEach(next => {
        // if (found.has(next)) return
        console.log('        sameAs: found ' + next)
        agenda.add(next.uri)
      })
    }
    found.delete(thing.uri) // don't want the one we knew about
    return Array.from(found).map(uri => kb.sym(uri)) // return as array of nodes
  }

  function renderNewRow (webidObject) {
    const webid = new $rdf.Literal(webidObject.uri)
    async function deleteFunction () {
      try {
        await removeWebIDFromContacts(person, webid, { kb })
      } catch (err) {
        div.appendChild(widgets.errorMessageBlock(dom, err))
      }
      await refreshWebIDTable()
    }
    const delFunParam = editable ? deleteFunction : null
    const title = webidObject.uri.split('/')[2] // domain name
    const image = widgets.faviconOrDefault(dom, webidObject.site()) // image just for domain
    const options = { deleteFunction: delFunParam, draggable: true, title, image }

    const row = widgets.personTR(dom, UI.ns.foaf('knows'), webidObject, options)
    // const row = UI.widgets.personTR(dom, UI.ns.foaf('knows'), webidObject, options)
    row.children[1].textConent = title // @@ will be overwritten
    row.style.backgroundColor = webidPanelBackgroundColor
    row.style.padding = '0.2em'

    return row
  }
  function _renderNewRow2 (x) { // alternative
    const tr = table.appendChild(dom.createElement('tr'))
    tr.setAttribute('style', 'margin-top: 0.1em solid #ccc;')
    const nameTD = tr.appendChild(dom.createElement('td'))
    const formTD = tr.appendChild(dom.createElement('td'))
    nameTD.textContent = x.uri.split('/')[2] // domain part
    kb.fetcher // Load the profile
      .load(x.doc())
      .then(function (_xhr) {
        nameTD.textContent =
          x.uri.split('/')[2] +
          ' (' +
          kb.statementsMatching(
            undefined,
            undefined,
            undefined,
            x.doc()
          ).length +
          ')'
      })
      .catch(function (e) {
        formTD.appendChild(UI.widgets.errorMessageBlock(dom, e, 'pink'))
      })
    return tr
  }

  function renderPane (dom, subject, paneName) {
    const p = dataBrowserContext.session.paneRegistry.byName(paneName)
    const d = p.render(subject, dataBrowserContext) // @@@ change some bits of context!
    d.setAttribute(
      'style',
      'border: 0.1em solid #444; border-radius: 0.5em'
    )
    return d
  }

  function getPersonas () {
    const lits = vcardWebIDs(person).concat(getSameAs(person, person.doc()))
    const strings = new Set(lits.map(lit => lit.value)) // remove dups
    const personas = [...strings].map(uri => kb.sym(uri)) // The UI tables do better with Named Nodes than Literals
    personas.sort() // for repeatability
    personas.filter(x => !x.sameTerm(person))
    return personas
  }
  function renderPersona (persona) {
    function profileOpenHandler (_event) {
      profileIsVisible = !profileIsVisible
      main.style.visibility = profileIsVisible ? 'visible' : 'collapse'
      openButton.children[0].src = profileIsVisible ? UP_ARROW : DOWN_ARROW // @@ fragile
    }

    const div = dom.createElement('div')
    const nav = div.appendChild(dom.createElement('nav'))
    nav.style = 'width: 100%; height: 4em; background-color: #eee;'
    const title = persona.uri // .split('/')[2] // domain name
    let main

    const header = nav.appendChild(dom.createElement('span'))
    header.textContent = title
    let profileIsVisible = false

    const openButton = nav.appendChild(widgets.button(dom, DOWN_ARROW, 'View', profileOpenHandler))
    openButton.style.align = 'right'
    kb.fetcher.load(persona).then(_resp => {
      try {
        main = div.appendChild(renderPane(dom, persona, 'profile'))
        main.style.visibility = 'collapse'
      } catch (err) {
        main = widgets.errorMessageBlock(dom, `Error loading persona ${persona}: ${err}`)
      }
    }, err => {
      main = widgets.errorMessageBlock(dom, `Problem displaying persona ${persona}: ${err}`)
    })
    return div
  } // renderPersona

  async function refreshWebIDTable () {
    const personas = getPersonas()
    console.log('WebId personas: ' + person + ' -> ' + personas.map(p => p.uri).join(',\n  '))
    prompt.style.visibility = personas.length ? 'collapse' : 'visible'
    utils.syncTableToArrayReOrdered(table, personas, renderNewRow)
    utils.syncTableToArrayReOrdered(profileArea, personas, renderPersona)
  }
  async function greenButtonHandler (_event) {
    const webid = await UI.widgets.askName(dom, UI.store, div, UI.ns.vcard('url'), null, WEBID_NOUN)
    try {
      await addWebIDToContacts(person, webid, { kb: kb })
    } catch (err) {
      div.appendChild(widgets.errorMessageBlock(dom, err))
    }
    await refreshWebIDTable()
  }

  async function droppedURIHandler (uris) {
    for (const webid of uris) {
      try {
        await addWebIDToContacts(person, webid, { kb: kb })
      } catch (err) {
        div.appendChild(widgets.errorMessageBlock(dom, err))
      }
    }
    await refreshWebIDTable()
  }

  const { dom } = dataBrowserContext
  const editable = kb.updater.editable(person.doc().uri, kb)
  const div = dom.createElement('div')
  div.style = 'border-radius:0.3em; border: 0.1em solid #888; padding: 0.8em;'

  if (getPersonas().length === 0 && !editable) {
    div.style.visibility = 'collapse'
    return div // No point listing an empty list you can't change
  }

  const h4 = div.appendChild(dom.createElement('h4'))
  h4.textContent = WEBID_NOUN
  h4.style = style.formHeadingStyle
  h4.style.color = style.highlightColor

  const prompt = div.appendChild(dom.createElement('p'))
  prompt.style = style.commentStyle
  prompt.textContent = `If you know someone's ${WEBID_NOUN}, you can do more stuff with them.
  To record their ${WEBID_NOUN}, drag it onto the plus, or click the plus 
  to bring up a selector.`
  const table = div.appendChild(dom.createElement('table'))
  if (editable) {
    const plus = div.appendChild(widgets.button(dom, GREEN_PLUS, WEBID_NOUN, greenButtonHandler))
    UI.widgets.makeDropTarget(plus, droppedURIHandler, null)
  }
  const profileArea = div.appendChild(dom.createElement('div'))
  await refreshWebIDTable()

  return div
}
