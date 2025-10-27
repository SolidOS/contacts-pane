import { ns, store } from 'solid-ui'
const __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
  function adopt (value) { return value instanceof P ? value : new P(function (resolve) { resolve(value) }) }
  return new (P || (P = Promise))(function (resolve, reject) {
    function fulfilled (value) { try { step(generator.next(value)) } catch (e) { reject(e) } }
    function rejected (value) { try { step(generator['throw'](value)) } catch (e) { reject(e) } }
    function step (result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected) }
    step((generator = generator.apply(thisArg, _arguments || [])).next())
  })
}
export { ns, store, rdf } from 'solid-ui'
// console.log('@@ store', store)
// console.log('@@ store.sym', store.sym)
export const subject = store.sym('https://janedoe.example/profile/card#me')
export const doc = subject.doc()
export const context = {
  dom: document,
  getOutliner: () => null,
  session: {
    paneRegistry: {
      byName: (name) => {
        return {
          render: () => {
            return document.createElement('div')
              .appendChild(document.createTextNode(`mock ${name} pane`))
          }
        }
      }
    },
    store,
    logic: {},
  },
}
const prefs = Object.keys(ns).filter(x => x !== 'default') // default is bogus value
export const prefixes = prefs.map(prefix => `@prefix ${prefix}: ${ns[prefix]('')}.\n`).join('') // In turtle
export const web = {}
export const requests = []
export function mockFetchFunction (req) {
  return __awaiter(this, 0, 0, function * () {
    if (req.method !== 'GET') {
      requests.push(req)
      if (req.method === 'PUT') {
        const contents = yield req.text()
        web[req.url] = contents // Update our dummy web
        console.log(`Tetst: Updated ${req.url} on PUT to <<<${web[req.url]}>>>`)
      }
      return { status: 200 }
    }
    const contents = web[req.url]
    if (contents !== undefined) { //
      return {
        body: prefixes + contents,
        status: 200,
        headers: {
          'Content-Type': 'text/turtle',
          'WAC-Allow': 'user="write", public="read"',
          'Accept-Patch': 'application/sparql-update'
        }
      }
    } // if contents
    return {
      status: 404,
      body: 'Not Found'
    }
  })
}
export function mockUpdate (store, del, ins) {
  for (const st of del) {
    store.remove(st)
  }
  for (const st of ins) {
    store.addStatement(st)
  }
}
