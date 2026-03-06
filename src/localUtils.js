import * as debug from './debug'
import * as UI from 'solid-ui'
import { store } from 'solid-logic'

const kb = store
const ns = UI.ns
let dom

export function setDom (d) {
  dom = d
}

/**
 * Normalize group URIs to ensure consistent representation.
 * Groups should be referenced with fragment #this, e.g., ...Group/AnotherGroup.ttl#this
 * If a group URI ends with .ttl (without #this), add #this
 * @param {string} uri - The group URI to normalize
 * @returns {string} The normalized group URI
 */
export function normalizeGroupUri (uri) {
  if (uri && uri.endsWith('.ttl')) {
    return uri + '#this'
  }
  return uri
}

export function complain (div, d, message) {
  debug.log('contactsPane: ' + message)
  UI.widgets.errorMessageBlock(dom, message, 'pink')
}
export function complainIfBad (div, dom, ok, body) {
  if (!ok) {
    complain(div, dom, 'Error: ' + body)
  }
}

export function getSameAs (kb, item, doc) {
  return kb.each(item, ns.owl('sameAs'), null, doc).concat(
    kb.each(null, ns.owl('sameAs'), item, doc))
}
//  For deleting an addressbook sub-folder eg person - use with care!
// @@ move to solid-logic
export function deleteRecursive (kb, folder) {
  return new Promise(function (resolve) {
    kb.fetcher.load(folder).then(function () {
      const promises = kb.each(folder, ns.ldp('contains')).map(file => {
        if (kb.holds(file, ns.rdf('type'), ns.ldp('BasicContainer'))) {
          return deleteRecursive(kb, file)
        } else {
          debug.log('Recursie delete - we delete file ' + file.uri)
          return kb.fetcher.webOperation('DELETE', file.uri)
        }
      })
      debug.log('Recursie delete - we delete folder ' + folder.uri)
      promises.push(kb.fetcher.webOperation('DELETE', folder.uri))
      Promise.all(promises).then(_res => {
        resolve()
      })
    })
  })
}

// In a LDP work, deletes the whole document describing a thing
// plus patch out ALL mentiosn of it!    Use with care!
// beware of other data picked up from other places being smushed
// together and then deleted.
export async function deleteThingAndDoc (x) {
  const name = nameFor(x)
  if (!confirm('Really DELETE contact ' + name + '?')) {
    throw new Error('User cancelled contact deletion')
  }
  debug.log('deleteThingAndDoc - to be deleted ' + x)
  const ds = kb.statementsMatching(x).concat(kb.statementsMatching(undefined, undefined, x))
  try {
    await kb.updater.updateMany(ds)
    await kb.fetcher.delete(x.doc())
    debug.log('deleteThingAndDoc - deleted')
  } catch (err) {
    complain(div, dom, 'Error deleting ' + x + ': ' + err)
    throw err
  }
}

export function compareForSort (self, other) {
  let s = nameFor(self)
  let o = nameFor(other)
  if (s && o) {
    s = s.toLowerCase()
    o = o.toLowerCase()
    if (s > o) return 1
    if (s < o) return -1
  }
  if (self.uri > other.uri) return 1
  if (self.uri < other.uri) return -1
  return 0
}

// organization-name is a hack for Mac records with no FN which is mandatory.
export function nameFor (x) {
  const name =
    kb.any(x, ns.vcard('fn')) ||
    kb.any(x, ns.foaf('name')) ||
    kb.any(x, ns.vcard('organization-name'))
  return name ? name.value : '???'
}
