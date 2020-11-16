// Render a control to record the webids we have for this agent
/* eslint-disable multiline-ternary */
import * as UI from 'solid-ui'

const $rdf = UI.rdf
const ns = UI.ns
const buttons = UI.buttons
const widgets = UI.widgets
const utils = UI.utils
const kb = UI.store

const WEBID_NOUN = 'Solid ID'

const GREEN_PLUS = UI.icons.iconBase + 'noun_34653_green.svg'

// Logic
export async function addWebIDToContacts (person, webid, context) {
  if (!webid.startsWith('https')) { /// @@ well we will have other protcols like DID
    throw new Error('Does not look like a webid, must start with https:')
  }
  const kb = { context }
  const vcardURLThing = kb.bnode()
  const insertables = [
    $rdf.st(person, ns.vcard('url'), vcardURLThing, person.doc()),
    $rdf.st(vcardURLThing, ns.rdf('type'), ns.vcard('WebID'), person.doc()),
    $rdf.st(vcardURLThing, ns.vcard('value'), webid, person.doc())
  ]
  await kb.udater.update([], insertables)
}

// UIs
export async function renderWedidControl (person, context) {
  const { dom } = context
  const div = dom.createElement('div')

  div.appendChild(dom.createElement('h4')).textContent = 'WebIDs'

  // IDs which are as WebId in VCARD data
  // like  :me vcard:hasURL [ a vcard:WebId; vcard:value <https://...foo> ]
  //
  function vcardWebIDs (person) {
    return kb.each(person, ns.vcard('url'), null, person.doc())
      .filter(urlObject => kb.holds(urlObject, ns.rdf('type'), ns.vcard('WebID'), person.doc()))
      .map(urlObject => kb.any(urlObject, ns.rdf('value'), null, person.doc()))
  }

  function getAliases (person) {
    return kb.allAliases(person) // All the terms linked by sameAs
      .filter(x => !x.sameTerm(person)) // Except this one
  }

  function renderNewRow (webid) {
    const row = UI.widgets.personTR(dom, UI.ns.foaf('knows'), webid, {}) // @@ add delete function
    row.style.backgroundColor = '#fed' // @@ just to trace
    return row
  }
  function _renderNewRow2 (x) { // alternative
    var tr = table.appendChild(dom.createElement('tr'))
    tr.setAttribute('style', 'margin-top: 0.1em solid #ccc;')
    var nameTD = tr.appendChild(dom.createElement('td'))
    var formTD = tr.appendChild(dom.createElement('td'))
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

  function refreshWebIDTable (person) {
    const ids = vcardWebIDs(person).concat(getAliases(person))
    ids.sort() // for repeatability
    prompt.textContent = ids.length ? WEBID_NOUN // multiline-ternary
      : `If you know someones ${WEBID_NOUN} then you can do more stuff with them.`
    utils.syncTableToArray(table, ids, renderNewRow)
    return ids
  }

  const prompt = div.appendChild(dom.createElement('p'))
  const table = div.appendChild(dom.createElement('table'))

  const _plus = div.appendChild(buttons.button(widgets.button(dom, GREEN_PLUS, WEBID_NOUN), async _event => {
    const webid = await UI.widgets.askName(dom, UI.store, div, UI.ns.vcard('url'), null, WEBID_NOUN)
    try {
      await addWebIDToContacts(person, webid, { kb })
    } catch (err) {
      div.appendChild(widgets.errorMessageBlock(dom, err))
    }
  }))
  const _ids = refreshWebIDTable()

  return div
}
