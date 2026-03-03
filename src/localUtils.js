import * as debug from './debug'
import * as UI from 'solid-ui'
import { store } from 'solid-logic'

const kb = store
const ns = UI.ns

export function complain(div, dom, message) {
    debug.log('contactsPane: ' + message)
    div.appendChild(UI.widgets.errorMessageBlock(dom, message, 'pink'))
}
export function complainIfBad(div, dom, ok, body) {
    if (!ok) {
        complain(div, dom, 'Error: ' + body)
    }
}

export function getSameAs(kb, item, doc) {
  return kb.each(item, ns.owl('sameAs'), null, doc).concat(
    kb.each(null, ns.owl('sameAs'), item, doc))
}
//  For deleting an addressbook sub-folder eg person - use with care!
// @@ move to solid-logic
export function deleteRecursive(kb, folder) {
    return new Promise(function (resolve) {
    kb.fetcher.load(folder).then(function () {
        const promises = kb.each(folder, ns.ldp('contains')).map(file => {
            if (kb.holds(file, ns.rdf('type'), ns.ldp('BasicContainer'))) {
                return deleteRecursive(kb, file)
            } else {
                debug.log('deleteRecursive file: ' + file)
                if (!confirm(' Really DELETE File ' + file)) {
                throw new Error('User aborted delete file')
                }
                return kb.fetcher.webOperation('DELETE', file.uri)
            }
        })
        debug.log('deleteRecirsive folder: ' + folder)
        if (!confirm(' Really DELETE folder ' + folder)) {
            throw new Error('User aborted delete file')
        }
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
export async function deleteThingAndDoc(x) {
    debug.log('deleteThingAndDoc: ' + x)
    const ds = kb.statementsMatching(x).concat(kb.statementsMatching(undefined, undefined, x))
    try {
        await kb.updater.updateMany(ds)
        debug.log('Deleting resoure ' + x.doc())
        await kb.fetcher.delete(x.doc())
        debug.log('Delete thing ' + x + ': complete.')
    } catch (err) {
        complain('Error deleting thing ' + x + ': ' + err)
    }
}

export function compareForSort(self, other) {
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
export function nameFor(x) {
    const name =
    kb.any(x, ns.vcard('fn')) ||
    kb.any(x, ns.foaf('name')) ||
    kb.any(x, ns.vcard('organization-name'))
    return name ? name.value : '???'
}