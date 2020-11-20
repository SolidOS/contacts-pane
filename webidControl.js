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
const webidPanelBackgroundColor = '#ffe6ff'

/// //////  TEMPOARY local version - test and move to buttons.ts

/**
 * A TR to represent a draggable person, etc in a list
 *
 * pred is unused param at the moment
 */
// export function personTR (dom: HTMLDocument, pred: NamedNode, obj: NamedNode, options: any): HTMLTableRowElement {
const { faviconOrDefault, setName, deleteButtonWithCheck, linkIcon } = widgets
function personTR (dom, pred, obj, options) {
  const tr = dom.createElement('tr')
  options = options || {}
  // tr.predObj = [pred.uri, obj.uri]   moved to acl-control
  const td1 = tr.appendChild(dom.createElement('td'))
  const td2 = tr.appendChild(dom.createElement('td'))
  const td3 = tr.appendChild(dom.createElement('td'))

  td1.setAttribute('style', 'vertical-align: middle; width:2.5em; padding:0.5em; height: 2.5em;')
  td2.setAttribute('style', 'vertical-align: middle; text-align:left;')
  td3.setAttribute('style', 'vertical-align: middle; width:2em; padding:0.5em; height: 4em;')

  const image = options.image || faviconOrDefault(dom, obj)
  td1.appendChild(image)

  if (options.title) {
    td2.textContent = options.title
  } else {
    setName(td2, obj)
  }

  if (options.deleteFunction) {
    deleteButtonWithCheck(dom, td3, options.noun || 'one', options.deleteFunction)
  }
  if (obj.uri) {
    // blank nodes need not apply
    if (options.link !== false) {
      const anchor = td3.appendChild(linkIcon(dom, obj))
      anchor.classList.add('HoverControlHide')
      td3.appendChild(dom.createElement('br'))
    }
    if (options.draggable !== false) {
      // default is on
      image.setAttribute('draggable', 'false') // Stop the image being dragged instead - just the TR
      UI.dragAndDrop.makeDraggable(tr, obj)
    }
  }
  tr.subject = obj
  return tr
}

/// //////////////////////////////////////////////////////////

// Logic
export async function addWebIDToContacts (person, webid, context) {
  if (!webid.startsWith('https:')) { /// @@ well we will have other protcols like DID
    throw new Error('Does not look like a webid, must start with https:')
  }
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

  function getAliases (person) {
    return kb.allAliases(person) // All the terms linked by sameAs
      .filter(x => !x.sameTerm(person)) // Except this one
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
    const title = webidObject.uri.split['/'][2] // domain name
    const image = widgets.faviconOrDefault(dom, webidObject.origin()) // image just for domain
    const options = { deleteFunction: delFunParam, draggable: true, title, image }

    const row = personTR(dom, UI.ns.foaf('knows'), webidObject, options)
    // const row = UI.widgets.personTR(dom, UI.ns.foaf('knows'), webidObject, options)
    row.childrem[1].textConent = title // @@ will be overwritten
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
    const lits = vcardWebIDs(person).concat(getAliases(person))
    const personas = lits.map(lit => kb.sym(lit.value)) // The UI tables do better with Named Nodes than Literals
    personas.sort() // for repeatability
    return personas
  }
  async function refreshWebIDTable () {
    const personas = getPersonas()
    prompt.textContent = personas.length ? '' // multiline-ternary
      : `If you know someones ${WEBID_NOUN} then you can do more stuff with them.`
    utils.syncTableToArrayReOrdered(table, personas, renderNewRow)
    if (personas.length === 0) {
      profileArea.innerHTML = ''
    } else {
      if (profileArea.children.length === 0) {
        for (const persona of personas) {
          try {
            await kb.fetcher.load(persona)
          } catch (err) {
            profileArea.appendChild(widgets.errorMessageBlock(dom, `Error loading profile ${persona}: ${err}`))
            return
          }
          profileArea.appendChild(renderPane(dom, persona, 'profile'))
        }
      } // else assume already there
    }
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

  const { dom } = dataBrowserContext
  const editable = kb.updater.editable(person.doc().uri, kb)
  const div = dom.createElement('div')
  div.style = 'border-radius:0.3em; border: 0.1em solid #888; padding: 0.8em;'

  if (getPersonas().legth === 0 && !editable) {
    return div // No point listing an empty headding
  }

  const h4 = div.appendChild(dom.createElement('h4'))
  h4.textContent = WEBID_NOUN
  h4.style = style.formHeadingStyle
  h4.style.color = style.highlightColor

  const prompt = div.appendChild(dom.createElement('p'))
  prompt.style = style.commentStyle
  const table = div.appendChild(dom.createElement('table'))
  if (editable) {
    const _plus = div.appendChild(widgets.button(dom, GREEN_PLUS, WEBID_NOUN, greenButtonHandler))
  }
  const profileArea = div.appendChild(dom.createElement('div'))
  await refreshWebIDTable()

  return div
}
