import { DataBrowserContext, PaneRegistry } from 'pane-registry'
import { Statement, LiveStore } from 'rdflib'
import { ns, store } from 'solid-ui'
import { SolidLogic } from 'solid-logic'

// console.log('@@ store', store)
// console.log('@@ store.sym', store.sym)

export const subject = store.sym('https://janedoe.example/profile/card#me')
export const doc = subject.doc()

export const context = {
  dom: document,
  getOutliner: () => null,
  session: {
    paneRegistry: {
      byName: (name: string) => {
        return {
          render: () => {
            return document.createElement('div')
              .appendChild(
                document.createTextNode(`mock ${name} pane`)
              )
          }
        }
      }
    } as PaneRegistry,
    store,
    logic: {} as SolidLogic,
  },
} as unknown as DataBrowserContext

const prefs = Object.keys(ns).filter(x => x !== 'default') // default is bogus value
export const prefixes = prefs.map(prefix => `@prefix ${prefix}: ${ns[prefix]('')}.\n`).join('') // In turtle

export const web = {}
export const requests: any[] = []

export async function mockFetchFunction (req) {
  if (req.method !== 'GET') {
    requests.push(req)
    if (req.method === 'PUT') {
      const contents = await req.text()
      web[req.url] = contents // Update our dummy web
      console.log(`Tetst: Updated ${req.url} on PUT to <<<${web[req.url]}>>>`)
    }
    return { status: 200 }
  }
  const contents = web[req.url]
  if (contents !== undefined) { //
    return {
      body: prefixes + contents, // Add namespaces to anything
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
}

export function mockUpdate (store: LiveStore, del: Statement[], ins: Statement[]) {
  for (const st of del) {
    store.remove(st)
  }
  for (const st of ins) {
    store.addStatement(st)
  }
}
