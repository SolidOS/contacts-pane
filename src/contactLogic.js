import * as UI from 'solid-ui'
import * as $rdf from 'rdflib'
import { store } from 'solid-logic'
import { getPersonas } from './webidControl'
import * as debug from './debug'
import { getSameAs, confirmDialog, alertDialog } from './localUtils'

const ns = UI.ns
const utils = UI.utils
const kb = store
const updater = kb.updater

/** Perform updates on more than one document   @@ Move to rdflib!
*/
export async function updateMany (deletions, insertions = []) {
  const docs = deletions.concat(insertions).map(st => st.why)
  const uniqueDocs = []
  docs.forEach(doc => {
    if (!uniqueDocs.find(uniqueDoc => uniqueDoc.equals(doc))) uniqueDocs.push(doc)
  })
  const updates = uniqueDocs.map(doc =>
    kb.updater.update(deletions.filter(st => st.why.sameTerm(doc)),
      insertions.filter(st => st.why.sameTerm(doc))))
  return Promise.all(updates)
}

/** Add a new person to the web data
*
* adds them to the given groups as well.
* @returns {NamedNode} the person
*/
export async function saveNewContact (book, name, selectedGroups, klass) {
  await kb.fetcher.load(book.doc())
  const nameEmailIndex = kb.any(book, ns.vcard('nameEmailIndex'))

  const uuid = utils.genUuid()
  const person = kb.sym(
    book.dir().uri + 'Person/' + uuid + '/index.ttl#this'
  )
  const doc = person.doc()

  // Set of statements to different files
  const agenda = [
    // Patch the main index to add the person
    $rdf.st(person, ns.vcard('inAddressBook'), book, nameEmailIndex), // The people index
    $rdf.st(person, ns.vcard('fn'), name, nameEmailIndex),
    // The new person file
    $rdf.st(person, ns.vcard('fn'), name, doc),
    $rdf.st(person, ns.rdf('type'), klass, doc),

    $rdf.st(doc, ns.dct('created'), new Date(), doc) // Note when created - useful for triaging later
    // Note this is propert of the file -- not when the person was created!
  ]

  // `selectedGroups` may be an array (older callers) or an object map
  // (contactsPane.js tracks it as `{ uri: true }`).  Normalize and make sure
  // at least one group is selected before proceeding – otherwise we return
  // `undefined` and the caller must handle it.
  const groups = Array.isArray(selectedGroups)
    ? selectedGroups
    : Object.keys(selectedGroups || {})

  if (groups.length > 0) {
    for (const gu of groups) {
      const g = kb.sym(gu)
      const gd = g.doc()
      agenda.push(
        $rdf.st(g, ns.vcard('hasMember'), person, gd),
        $rdf.st(person, ns.vcard('fn'), name, gd)
      )
    }
  } else {
    alertDialog('Must be a member of at least one group. Please select or create a group.')
    return // caller should check for undefined result
  }

  try {
    await updater.updateMany([], agenda)
  } catch (e) {
    debug.error('Cannot add group membership for ' + person + '. Stack:' + e)
    throw new Error('Save new contact')
  }
  return person
}

export function sanitizeToAlpha (name) { // https://mathiasbynens.be/notes/es6-unicode-regex
  const n2 = name.replace(/\W/gu, '_') // Anything which is not a unicode word characeter
  return n2.replace(/_+/g, '_') // https://www.regular-expressions.info/shorthand.html
}

/** Write new group to web
 * Creates an empty new group file and adds it to the index
 * @returns group
*/
export async function saveNewGroup (book, name) {
  await kb.fetcher.load(book.doc())
  const gix = kb.any(book, ns.vcard('groupIndex'))

  const gname = sanitizeToAlpha(name)
  const group = kb.sym(book.dir().uri + 'Group/' + gname + '.ttl#this')
  const doc = group.doc()
  // debug.log(' New group will be: ' + group + '\n')
  try {
    await kb.fetcher.load(gix)
  } catch (err) {
    throw new Error('Error loading group index!' + gix.uri + ': ' + err)
  }
  if (kb.holds(book, ns.vcard('includesGroup'), group, gix)) {
    return group // Already exists
  }
  const insertTriples = [
    $rdf.st(book, ns.vcard('includesGroup'), group, gix),
    $rdf.st(group, ns.rdf('type'), ns.vcard('Group'), gix),
    $rdf.st(group, ns.vcard('fn'), name, gix)
  ]
  try {
    await updater.update([], insertTriples)
  } catch (e) {
    throw new Error('Could not update group index ' + e) // fail
  }

  const triples = [
    $rdf.st(book, ns.vcard('includesGroup'), group, doc), // Pointer back to book
    $rdf.st(group, ns.rdf('type'), ns.vcard('Group'), doc),
    $rdf.st(group, ns.vcard('fn'), name, doc)
  ]
  try {
    await updater.update([], triples)
  } catch (err) {
    throw new Error('Could not update group file: ' + err) // fail
  }
  return group
}

export async function addPersonToGroup (thing, group) {
  const toBeFetched = [thing.doc(), group.doc()]
  try {
    await kb.fetcher.load(toBeFetched)
  } catch (e) {
    debug.error('Error adding ' + thing + ' to group ' + group + '. Stack: ' + e)
    throw new Error('Error adding person to group.')
  }

  const types = kb.findTypeURIs(thing)

  if (!(ns.vcard('Individual').uri in types ||
    ns.vcard('Organization').uri in types)) {
    debug.warn('Thing ' + thing + ' is not an Individual or Organization, but has types: ' + Object.keys(types))
    alertDialog('You are trying to add something else than an individual or organization.')
    return
  }
  let pname = kb.any(thing, ns.vcard('fn'))
  const gname = kb.any(group, ns.vcard('fn'))
  if (!pname) {
    debug.warn('Thing ' + thing + ' has no vcard:fn')
    alertDialog('What you are trying to add seems to have no full name.')
    return
  }
  const already = kb.holds(thing, ns.vcard('fn'), null, group.doc())
  if (already) {
    if (pname === '') pname = 'Contact'
    alertDialog(pname + ' already exists in group ' + gname + '.')
    return
  }
  const message = 'Add ' + pname + ' to group ' + gname + '?'
  if (!await confirmDialog(message)) return
  const ins = [
    $rdf.st(thing, ns.vcard('fn'), pname, group.doc())
  ]
  // find person webIDs and insert in vcard:hasMember
  const webIDs = getPersonas(kb, thing).map(webid => webid.value)
  if (webIDs.length) {
    webIDs.forEach(webid => {
      ins.push($rdf.st(kb.sym(webid), ns.owl('sameAs'), thing, group.doc()))
      ins.push($rdf.st(group, ns.vcard('hasMember'), kb.sym(webid), group.doc()))
    })
  } else {
    ins.push($rdf.st(group, ns.vcard('hasMember'), thing, group.doc()))
  }
  try {
    await updater.update([], ins)
    // to allow refresh of card groupList
    kb.fetcher.unload(group.doc())
    await kb.fetcher.load(group.doc())
  } catch (e) {
    debug.error('Error adding ' + thing + ' to group ' + group + '. Stack: ' + e)
    throw new Error('Error adding ' + pname + ' to group ' + gname + '.')
  }
  return thing
}

/**
 * Find persons member of a group
 */

export function groupMembers (kb, group) {
  const a = kb.each(group, ns.vcard('hasMember'), null, group.doc())
  let b = []
  a.forEach(item => {
    /* const contacts = kb.each(item, ns.owl('sameAs'), null, group.doc())
    if (contacts.length) {
      if (!kb.any(contacts[0], ns.vard('fn'))) b = b.concat(item) // this is the old data model
      else b = b.concat(contacts)
    } else { b = b.concat(item) }
    b = b.concat(item) */

    // to keep compatibility with old data model
    // check if item is a contact, else it is a WebID and parse 'sameAs' for contacts
    b = kb.any(item, ns.vcard('fn'), null, group.doc()) ? b.concat(item) : b.concat(kb.each(item, ns.owl('sameAs'), null, group.doc()))
  })
  const strings = new Set(b.map(contact => contact.uri)) // remove dups
  b = [...strings].map(uri => kb.sym(uri))
  return b
}

export function isLocal (group, item) {
  const tree = group.dir().dir().dir()
  const local = item.uri && item.uri.startsWith(tree.uri)
  // debug.log(`   isLocal ${local} for ${item.uri} in group ${group} tree ${tree.uri}`)
  return local
}

export async function getDataModelIssues (groups) {
  const del = []
  const ins = []
  groups.forEach(group => {
    const members = kb.each(group, ns.vcard('hasMember'), null, group.doc())
    members.forEach((member) => {
      const others = getSameAs(kb, member, group.doc())
      if (others.length && isLocal(group, member)) { // Problem: local ID used instead of webID
        for (const other of others) {
          if (!isLocal(group, other)) { // Let's use this one as the immediate member for CSS ACLs'
            // console.warn(`getDataModelIssues:  Need to swap ${member} to ${other}`)
            del.push($rdf.st(group, ns.vcard('hasMember'), member, group.doc()))
            ins.push($rdf.st(group, ns.vcard('hasMember'), other, group.doc()))
            break
          }
          // debug.log('getDataModelIssues: ??? expected id not to be local ' + other)
        } // other
      } // if
    }) // member
  }) // next group
  return { del, ins }
} // getDataModelIssues

// Ends
