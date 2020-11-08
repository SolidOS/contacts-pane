// Logic for solid contacts

import * as UI from 'solid-ui'

const ns = UI.ns
const $rdf = UI.rdf
const utils = UI.utils
const kb = UI.store
const updater = kb.updater

/** Perform updates on more than one document   @@ Move to rdflib!
*/
export async function updateMany (deletions, insertions) {
  const docs = deletions.concat(insertions).map(st => st.why)
  const uniqueDocs = Array.from(new Set(docs))
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
export async function saveNewContact (book, name, selectedGroups) {
  var nameEmailIndex = kb.any(book, ns.vcard('nameEmailIndex'))

  var uuid = utils.genUuid()
  var person = kb.sym(
    book.dir().uri + 'Person/' + uuid + '/index.ttl#this'
  )
  var doc = person.doc()

  // Set of statements to different files
  var agenda = [
    // Patch the main index to add the person
    $rdf.st(person, ns.vcard('inAddressBook'), book, nameEmailIndex), // The people index
    $rdf.st(person, ns.vcard('fn'), name, nameEmailIndex),
    // The new person file
    $rdf.st(person, ns.vcard('fn'), name, doc),
    $rdf.st(person, ns.rdf('type'), ns.vcard('Individual'), doc),

    $rdf.st(doc, ns.dct('created'), new Date(), doc) // Note when created - useful for triaging later
    // Note this is propert of the file -- not when the person was created!
  ]

  for (var gu in selectedGroups) {
    var g = kb.sym(gu)
    var gd = g.doc()
    agenda.push(
      $rdf.st(g, ns.vcard('hasMember'), person, gd),
      $rdf.st(person, ns.vcard('fn'), name, gd)
    )
  }

  try {
    await updateMany([], agenda) // @@ in future, updater.updateMany
  } catch (e) {
    console.log("Error: can't update " + person + ' as new contact:' + e)
    throw new Error('Updating new contact: ' + e)
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
  var gix = kb.any(book, ns.vcard('groupIndex'))

  const gname = sanitizeToAlpha(name)
  const group = kb.sym(book.dir().uri + 'Group/' + gname + '.ttl#this')
  const doc = group.doc()
  console.log(' New group will be: ' + group + '\n')
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
  var toBeFetched = [thing.doc(), group.doc()]
  try {
    await kb.fetcher.load(toBeFetched)
  } catch (e) {
    throw new Error('addPersonToGroup: ' + e)
  }

  const types = kb.findTypeURIs(thing)
  for (var ty in types) {
    console.log('    drop object type includes: ' + ty) // @@ Allow email addresses and phone numbers to be dropped?
  }
  if (!(ns.vcard('Individual').uri in types ||
     ns.vcard('Organization').uri in types)) {
    return alert(`Can't add ${thing} to a group: it has to be an individual or another group.`)
  }
  var pname = kb.any(thing, ns.vcard('fn'))
  var gname = kb.any(group, ns.vcard('fn'))
  if (!pname) { return alert('No vcard name known for ' + thing) }
  const already = kb.holds(group, ns.vcard('hasMember'), thing, group.doc())
  if (already) {
    return alert(
      'ALREADY added ' + pname + ' to group ' + gname
    )
  }
  var message = 'Add ' + pname + ' to group ' + gname + '?'
  if (!confirm(message)) return
  var ins = [
    $rdf.st(group, ns.vcard('hasMember'), thing, group.doc()),
    $rdf.st(thing, ns.vcard('fn'), pname, group.doc())
  ]
  try {
    await updater.update([], ins)
  } catch (e) {
    throw new Error(`Error adding ${pname} to group ${gname}:` + e)
  }
  return thing
}
