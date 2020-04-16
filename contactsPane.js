/*   Contact AddressBook Pane
**
**  This outline pane allows a user to interact with an contact,
to change its state according to an ontology, comment on it, etc.
**
** See also things like
**  http://www.w3.org/TR/vcard-rdf/
**  http://tools.ietf.org/html/rfc6350
**  http://www.iana.org/assignments/vcard-elements/vcard-elements.xhtml
**
** Feross "Standard" style note:  Callback functions should not be called "callback"
** or the "standard"  linter will complain if the first param is not a node.js error code. (2018-01)
** Hence "callbackFunction"
*/
/* global alert, confirm, FileReader */

const UI = require('solid-ui')

var mime = require('mime-types')
var toolsPane0 = require('./toolsPane')
var toolsPane = toolsPane0.toolsPane

const $rdf = UI.rdf
const ns = UI.ns

module.exports = {
  icon: UI.icons.iconBase + 'noun_99101.svg', // changed from embedded icon 2016-05-01

  name: 'contact',

  // Does the subject deserve an contact pane?
  label: function (subject, context) {
    var t = context.session.store.findTypeURIs(subject)
    if (t[ns.vcard('Individual').uri]) return 'Contact'
    if (t[ns.vcard('Organization').uri]) return 'contact'
    if (t[ns.foaf('Person').uri]) return 'Person'
    if (t[ns.schema('Person').uri]) return 'Person'
    if (t[ns.vcard('Group').uri]) return 'Group'
    if (t[ns.vcard('AddressBook').uri]) return 'Address book'
    return null // No under other circumstances
  },

  mintClass: UI.ns.vcard('AddressBook'),

  mintNew: function mintNew (dataBrowserContext, context) {
    return new Promise(function (resolve, reject) {
      UI.authn.logInLoadProfile(context).then(
        context => {
          // 20180713
          console.log('Logged in as ' + context.me)
          var me = context.me

          var dom = context.dom
          var div = context.div
          var kb = dataBrowserContext.session.store
          var ns = UI.ns
          var newBase = context.newBase || context.newInstance.dir().uri
          var instanceClass = context.instanceClass || ns.vcard('AddressBook')

          if (instanceClass.sameTerm(ns.vcard('Group'))) {
            // Make a group not an address book
            var g =
              context.newInstance || kb.sym(context.newBase + 'index.ttl#this')
            var doc = g.doc()
            kb.add(g, ns.rdf('type'), ns.vcard('Group'), doc)
            kb.add(
              g,
              ns.vcard('fn'),
              context.instanceName || 'untitled group',
              doc
            ) // @@ write doc back
            kb.fetcher
              .putBack(doc, { contentType: 'text/turtle' })
              .then(function (_xhr) {
                resolve(context)
              })
              .catch(function (err) {
                reject(
                  new Error('Error creating document for new group ' + err)
                )
              })
            return
          }
          var appInstanceNoun = 'address book'

          function complain (message) {
            div.appendChild(UI.widgets.errorMessageBlock(dom, message, 'pink'))
          }

          var bookContents = `@prefix vcard: <http://www.w3.org/2006/vcard/ns#>.
    @prefix ab: <http://www.w3.org/ns/pim/ab#>.
    @prefix dc: <http://purl.org/dc/elements/1.1/>.
    @prefix xsd: <http://www.w3.org/2001/XMLSchema#>.

    <#this> a vcard:AddressBook;
        dc:title "New address Book";
        vcard:nameEmailIndex <people.ttl>;
        vcard:groupIndex <groups.ttl>.
  `

          bookContents +=
            '<#this> <http://www.w3.org/ns/auth/acl#owner> <' +
            me.uri +
            '>.\n\n'

          const newAppInstance = kb.sym(newBase + 'index.ttl#this')

          var toBeWritten = [
            {
              to: 'index.ttl',
              content: bookContents,
              contentType: 'text/turtle'
            },
            { to: 'groups.ttl', content: '', contentType: 'text/turtle' },
            { to: 'people.ttl', content: '', contentType: 'text/turtle' },
            { to: '', existing: true, aclOptions: { defaultForNew: true } }
          ]

          // @@ Ask user abut ACLs?

          //
          //   @@ Add header to PUT     If-None-Match: *       to prevent overwrite
          //

          function claimSuccess (newAppInstance, appInstanceNoun) {
            // @@ delete or grey other stuff
            console.log(`New ${appInstanceNoun} created at ${newAppInstance}`)
            var p = div.appendChild(dom.createElement('p'))
            p.setAttribute('style', 'font-size: 140%;')
            p.innerHTML =
              "Your <a href='" +
              newAppInstance.uri +
              "'><b>new " +
              appInstanceNoun +
              '</b></a> is ready. ' +
              "<br/><br/><a href='" +
              newAppInstance.uri +
              "'>Go to new " +
              appInstanceNoun +
              '</a>'
            var newContext = Object.assign(
              { newInstance: newAppInstance },
              context
            )
            resolve(newContext)
          }

          function doNextTask () {
            function checkOKSetACL (uri, ok) {
              if (!ok) {
                complain('Error writing new file ' + task.to)
                return reject(new Error('Error writing new file ' + task.to))
              }

              UI.authn
                .setACLUserPublic(dest, me, aclOptions)
                .then(() => doNextTask())
                .catch(err => {
                  const message =
                    'Error setting access permissions for ' +
                    task.to +
                    ' : ' +
                    err.message
                  complain(message)
                  return reject(new Error(message))
                })
            }

            if (toBeWritten.length === 0) {
              claimSuccess(newAppInstance, appInstanceNoun)
            } else {
              var task = toBeWritten.shift()
              console.log('Creating new file ' + task.to + ' in new instance ')
              var dest = $rdf.uri.join(task.to, newBase) //
              var aclOptions = task.aclOptions || {}

              if ('content' in task) {
                kb.fetcher
                  .webOperation('PUT', dest, {
                    data: task.content,
                    saveMetadata: true,
                    contentType: task.contentType
                  })
                  .then(() => checkOKSetACL(dest, true))
              } else if ('existing' in task) {
                checkOKSetACL(dest, true)
              } else {
                reject(new Error('copy not expected buiding new app!!'))
                // var from = task.from || task.to // default source to be same as dest
                // UI.widgets.webCopy(base + from, dest, task.contentType, checkOKSetACL)
              }
            }
          }
          doNextTask()
        },
        err => {
          // log in then
          context.div.appendChild(UI.widgets.errorMessageBlock(err))
        }
      )
    })
  },

  //  Render the pane
  render: function (subject, dataBrowserContext, paneOptions = {}) {
    const dom = dataBrowserContext.dom
    const kb = dataBrowserContext.session.store
    var div = dom.createElement('div')
    var cardDoc = subject.doc()

    UI.aclControl.preventBrowserDropEvents(dom) // protect drag and drop

    div.setAttribute('class', 'contactPane')

    function complain (message) {
      console.log(message)
      div.appendChild(UI.widgets.errorMessageBlock(dom, message, 'pink'))
    }
    function complainIfBad (ok, body) {
      if (!ok) {
        complain('Error: ' + body)
      }
    }

    var thisPane = this

    //  Reproduction: Spawn a new instance of this app
    function newAddressBookButton (thisAddressBook) {
      return UI.authn.newAppInstance(
        dom,
        { noun: 'address book', appPathSegment: 'contactorator.timbl.com' },
        function (ws, newBase) {
          thisPane.clone(thisAddressBook, newBase, { // @@ clone is not a thing - use mintNew
            me: me,
            div: div,
            dom: dom
          })
        }
      )
    } // newAddressBookButton

    var updater = kb.updater
    UI.aclControl.preventBrowserDropEvents(dom)

    var t = kb.findTypeURIs(subject)

    var me = UI.authn.currentUser()

    var context = {
      target: subject,
      me: me,
      noun: 'address book',
      div: div,
      dom: dom
    } // missing: statusRegion

    //  Render a 3-column browser for an address book or a group
    function renderThreeColumnBrowser (books, context, options) {
      kb.fetcher
        .load(books)
        .then(function (_xhr) {
          renderThreeColumnBrowser2(books, context, options)
        })
        .catch(function (err) {
          complain(err)
        })
    }
    var renderThreeColumnBrowser2 = function (books, context, options) {
      var classLabel = UI.utils.label(ns.vcard('AddressBook'))
      // var IndividualClassLabel = UI.utils.label(ns.vcard('Individual'))

      var book = books[0] // for now
      var groupIndex = kb.any(book, ns.vcard('groupIndex'))
      var selectedGroups = {}
      var selectedPeople = {} // Actually prob max 1

      var target = options.foreignGroup || book

      var title =
        kb.any(target, ns.dc('title')) || kb.any(target, ns.vcard('fn'))
      if (paneOptions.solo && title && typeof document !== 'undefined') {
        document.title = title.value // @@ only when the outermmost pane
      }
      title = title ? title.value : classLabel

      // The book could be the main subject, or linked from a group we are dealing with
      function findBookFromGroups (book) {
        if (book) {
          return book
        }
        var g
        for (const gu in selectedGroups) {
          g = kb.sym(gu)
          const b = kb.any(undefined, ns.vcard('includesGroup'), g)
          if (b) return b
        }
        throw new Error(
          'findBookFromGroups: Cant find address book which this group is part of'
        )
      }

      //  Write a new contact to the web
      function createNewContact (
        book,
        name,
        selectedGroups,
        callbackFunction
      ) {
        book = findBookFromGroups(book)
        var nameEmailIndex = kb.any(book, ns.vcard('nameEmailIndex'))

        var uuid = UI.utils.genUuid()
        var person = kb.sym(
          book.dir().uri + 'Person/' + uuid + '/index.ttl#this'
        )
        var doc = person.doc()

        // Sets of statements to different files
        var agenda = [
          // Patch the main index to add the person
          [
            $rdf.st(person, ns.vcard('inAddressBook'), book, nameEmailIndex), // The people index
            $rdf.st(person, ns.vcard('fn'), name, nameEmailIndex)
          ]
        ]

        // @@ May be missing email - sync that differently

        // sts.push(new $rdf.Statement(person, DCT('created'), new Date(), doc));  ??? include this?
        for (var gu in selectedGroups) {
          var g = kb.sym(gu)
          var gd = g.doc()
          agenda.push([
            $rdf.st(g, ns.vcard('hasMember'), person, gd),
            $rdf.st(person, ns.vcard('fn'), name, gd)
          ])
        }

        function updateCallback (uri, success, body) {
          if (!success) {
            console.log(
              "Error: can't update " + uri + ' for new contact:' + body + '\n'
            )
            callbackFunction(
              false,
              "Error: can't update " + uri + ' for new contact:' + body
            )
          } else {
            if (agenda.length > 0) {
              console.log('Patching ' + agenda[0] + '\n')
              updater.update([], agenda.shift(), updateCallback)
            } else {
              // done!
              console.log('Done patching. Now reading back in.\n')
              kb.fetcher.nowOrWhenFetched(doc, undefined, function (ok, body) {
                if (ok) {
                  console.log('Read back in OK.\n')
                  callbackFunction(true, person)
                } else {
                  console.log('Read back in FAILED: ' + body + '\n')
                  callbackFunction(false, body)
                }
              })
            }
          }
        }

        kb.fetcher.nowOrWhenFetched(nameEmailIndex, undefined, function (
          ok,
          message
        ) {
          if (ok) {
            console.log(' People index must be loaded\n')
            updater.put(
              doc,
              [
                $rdf.st(person, ns.vcard('fn'), name, doc),
                $rdf.st(person, ns.rdf('type'), ns.vcard('Individual'), doc)
              ],
              'text/turtle',
              updateCallback
            )
          } else {
            console.log(
              'Error loading people index!' +
                nameEmailIndex.uri +
                ': ' +
                message
            )
            callbackFunction(
              false,
              'Error loading people index!' +
                nameEmailIndex.uri +
                ': ' +
                message +
                '\n'
            )
          }
        })
      }

      // Write new group to web
      // Creates an empty new group file and adds it to the index
      //
      function saveNewGroup (book, name, callbackFunction) {
        var gix = kb.any(book, ns.vcard('groupIndex'))

        var x = book.uri.split('#')[0]
        // @@ Should also remove any non-alphanumeric and any double undersscore
        var gname = name.replace(' ', '_')
        var doc = kb.sym(
          x.slice(0, x.lastIndexOf('/') + 1) + 'Group/' + gname + '.ttl'
        )
        var group = kb.sym(doc.uri + '#this')
        console.log(' New group will be: ' + group + '\n')

        kb.fetcher.nowOrWhenFetched(gix, function (ok, message) {
          if (ok) {
            console.log(' Group index must be loaded\n')

            var insertTriples = [
              $rdf.st(book, ns.vcard('includesGroup'), group, gix),
              $rdf.st(group, ns.rdf('type'), ns.vcard('Group'), gix),
              $rdf.st(group, ns.vcard('fn'), name, gix)
            ]
            updater.update([], insertTriples, function (uri, success, body) {
              if (ok) {
                var triples = [
                  $rdf.st(book, ns.vcard('includesGroup'), group, gix), // Pointer back to book
                  $rdf.st(group, ns.rdf('type'), ns.vcard('Group'), doc),
                  $rdf.st(group, ns.vcard('fn'), name, doc)
                ]
                updater.put(doc, triples, 'text/turtle', function (
                  uri,
                  ok,
                  body
                ) {
                  callbackFunction(
                    ok,
                    ok ? group : "Can't save new group file " + doc + body
                  )
                })
              } else {
                callbackFunction(ok, 'Could not update group index ' + body) // fail
              }
            })
          } else {
            console.log(
              'Error loading people index!' + gix.uri + ': ' + message
            )
            callbackFunction(
              false,
              'Error loading people index!' + gix.uri + ': ' + message + '\n'
            )
          }
        })
      }

      // organization-name is a hack for Mac records with no FN which is mandatory.
      function nameFor (x) {
        var name =
          kb.any(x, ns.vcard('fn')) ||
          kb.any(x, ns.foaf('name')) ||
          kb.any(x, ns.vcard('organization-name'))
        return name ? name.value : '???'
      }

      function filterName (name) {
        var filter = searchInput.value.trim().toLowerCase()
        if (filter.length === 0) return true
        var parts = filter.split(' ') // Each name part must be somewhere
        for (var j = 0; j < parts.length; j++) {
          var word = parts[j]
          if (name.toLowerCase().indexOf(word) < 0) return false
        }
        return true
      }

      function selectPerson (person) {
        cardMain.innerHTML = 'loading...'
        selectedPeople = {}
        selectedPeople[person.uri] = true
        refreshFilteredPeople() // Color to remember which one you picked
        var local = book ? localNode(person) : person
        kb.fetcher.nowOrWhenFetched(local.doc(), undefined, function (
          ok,
          message
        ) {
          cardMain.innerHTML = ''
          if (!ok) {
            return complainIfBad(
              ok,
              "Can't load card: " + local + ': ' + message
            )
          }
          // console.log("Loaded card " + local + '\n')
          cardMain.appendChild(cardPane(dom, local, 'contact'))
          cardMain.appendChild(dom.createElement('br'))

          cardMain.appendChild(UI.widgets.linkIcon(dom, local)) // hoverHide

          // Add in a delete button to delete from AB
          var deleteButton = UI.widgets.deleteButtonWithCheck(
            dom,
            cardMain,
            'contact',
            function () {
              const container = person.dir() // ASSUMPTION THAT CARD IS IN ITS OWN DIRECTORY
              // function warn (message) { return UI.widgets.errorMessageBlock(dom, message, 'straw') }
              alert('Conatiner to delete is ' + container)
              const pname = kb.any(person, ns.vcard('fn'))

              if (
                confirm(
                  'Delete contact ' + pname + ' completely?? ' + container
                )
              ) {
                console.log('Deleting a contact ' + pname)
                deleteThing(person)
                //  - delete the references to it in group files and save them background
                //   - delete the reference in people.ttl and save it back
                deleteRecursive(kb, container).then(_res => {
                  refreshNames() // Doesn't work
                  cardMain.innerHTML = 'Contact Data Deleted.'
                })
              }
            }
          )
          deleteButton.style = 'height: 2em;'
        })
      }

      function refreshFilteredPeople (active) {
        var count = 0
        var lastRow = null
        for (var i = 0; i < peopleMainTable.children.length; i++) {
          var row = peopleMainTable.children[i]
          const matches = filterName(nameFor(row.subject))
          if (matches) {
            count++
            lastRow = row
          }
          row.setAttribute(
            'style',
            matches
              ? selectedPeople[row.subject.uri]
                ? 'background-color: #cce;'
                : ''
              : 'display: none;'
          )
        }
        if (count === 1 && active) {
          const unique = lastRow.subject
          // selectedPeople = { }
          // selectedPeople[unique.uri] = true
          // lastRow.setAttribute('style', 'background-color: #cce;')
          selectPerson(unique)
        }
      }

      function selectAllGroups (
        selectedGroups,
        groupsMainTable,
        callbackFunction
      ) {
        function fetchGroupAndSelct (group, groupRow) {
          groupRow.setAttribute('style', 'background-color: #ffe;')
          kb.fetcher.nowOrWhenFetched(group.doc(), undefined, function (
            ok,
            message
          ) {
            if (!ok) {
              var msg = "Can't load group file: " + group + ': ' + message
              badness.push(msg)
              return complainIfBad(ok, msg)
            }
            groupRow.setAttribute('style', 'background-color: #cce;')
            selectedGroups[group.uri] = true
            refreshGroupsSelected()
            refreshNames() // @@ every time??
            todo -= 1
            if (!todo) {
              if (callbackFunction) { callbackFunction(badness.length === 0, badness) }
            }
          })
        }
        var todo = groupsMainTable.children.length
        var badness = []
        for (var k = 0; k < groupsMainTable.children.length; k++) {
          var groupRow = groupsMainTable.children[k]
          var group = groupRow.subject
          fetchGroupAndSelct(group, groupRow)
        } // for each row
      }

      function sortGroups () {
        groups = []
        if (options.foreignGroup) {
          groups.push([
            '',
            kb.any(options.foreignGroup, ns.vcard('fn')),
            options.foreignGroup
          ])
        }
        if (book) {
          books.map(function (book) {
            var gs = book ? kb.each(book, ns.vcard('includesGroup')) : []
            var gs2 = gs.map(function (g) {
              return [book, kb.any(g, ns.vcard('fn')), g]
            })
            groups = groups.concat(gs2)
          })
          groups.sort()
        }
      }

      function cardPane (dom, subject, paneName) {
        var p = dataBrowserContext.session.paneRegistry.byName(paneName)
        var d = p.render(subject, dataBrowserContext)
        d.setAttribute(
          'style',
          'border: 0.1em solid #444; border-radius: 0.5em'
        )
        return d
      }

      function compareForSort (self, other) {
        var s = nameFor(self)
        var o = nameFor(other)
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

      // In a LDP work, deletes the whole document describing a thing
      // plus patch out ALL mentiosn of it!    Use with care!
      // beware of other dta picked up from other places being smushed
      // together and then deleted.

      function deleteThing (x) {
        console.log('deleteThing: ' + x)
        var ds = kb
          .statementsMatching(x)
          .concat(kb.statementsMatching(undefined, undefined, x))
        var targets = {}
        ds.map(function (st) {
          targets[st.why.uri] = st
        })
        var agenda = [] // sets of statements of same dcoument to delete
        for (var target in targets) {
          agenda.push(
            ds.filter(function (st) {
              return st.why.uri === target
            })
          )
          console.log(
            '   Deleting ' +
              agenda[agenda.length - 1].length +
              ' triples from ' +
              target
          )
        }
        function nextOne () {
          if (agenda.length > 0) {
            updater.update(agenda.shift(), [], function (uri, ok, body) {
              if (!ok) {
                complain('Error deleting all trace of: ' + x + ': ' + body)
                return
              }
              nextOne()
            })
          } else {
            console.log('Deleting resoure ' + x.doc())
            kb.fetcher
              .delete(x.doc())
              .then(function () {
                console.log('Delete thing ' + x + ': complete.')
              })
              .catch(function (e) {
                complain('Error deleting thing ' + x + ': ' + e)
              })
          }
        }
        nextOne()
      }

      //  For deleting an addressbook sub-folder eg person - use with care!

      function deleteRecursive (kb, folder) {
        return new Promise(function (resolve) {
          kb.fetcher.load(folder).then(function () {
            const promises = kb.each(folder, ns.ldp('contains')).map(file => {
              if (kb.holds(file, ns.rdf('type'), ns.ldp('BasicContainer'))) {
                return deleteRecursive(kb, file)
              } else {
                console.log('deleteRecirsive file: ' + file)
                if (!confirm(' Really DELETE File ' + file)) {
                  throw new Error('User aborted delete file')
                }
                return kb.fetcher.webOperation('DELETE', file.uri)
              }
            })
            console.log('deleteRecirsive folder: ' + folder)
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

      function localNode (person, _div) {
        var aliases = kb.allAliases(person)
        var prefix = book.dir().uri
        for (var i = 0; i < aliases.length; i++) {
          if (aliases[i].uri.slice(0, prefix.length) === prefix) {
            return aliases[i]
          }
        }
        throw new Error('No local URI for ' + person)
      }

      function refreshNames () {
        function setPersonListener (personRow, person) {
          /*  No delete button on person in list: ambiguous: group or total? Do in card itself
          UI.widgets.deleteButtonWithCheck(dom, personRight, 'contact', function () {
            deleteThing(person) /// Just remove from group
            refreshNames()
            cardMain.innerHTML = ''
          })
          */
          personRow.addEventListener('click', function (event) { // @@ was personRow
            event.preventDefault()
            selectPerson(person)
          })
        }

        var cards = []
        for (var u in selectedGroups) {
          if (selectedGroups[u]) {
            var a = kb.each(kb.sym(u), ns.vcard('hasMember'))
            // console.log('Adding '+ a.length + ' people from ' + u + '\n')
            cards = cards.concat(a)
          }
        }
        cards.sort(compareForSort) // @@ sort by name not UID later
        for (var k = 0; k < cards.length - 1;) {
          if (cards[k].uri === cards[k + 1].uri) {
            cards.splice(k, 1)
          } else {
            k++
          }
        }

        peopleHeader.textContent =
          cards.length > 5 ? '' + cards.length + ' contacts' : 'contact'

        function renderNameInGroupList (person) {
          var personRow = dom.createElement('tr')
          var personLeft = personRow.appendChild(dom.createElement('td'))
          // var personRight = personRow.appendChild(dom.createElement('td'))
          personLeft.setAttribute('style', dataCellStyle)
          personRow.subject = person
          var name = nameFor(person)
          personLeft.textContent = name
          personRow.subject = person
          UI.widgets.makeDraggable(personRow, person)

          setPersonListener(personRow, person)
          return personRow
        }

        peopleMainTable.innerHTML = '' // clear
        for (var j = 0; j < cards.length; j++) {
          peopleMainTable.appendChild(renderNameInGroupList(cards[j]))
        }
        refreshFilteredPeople()
      }

      function refreshThingsSelected (table, selectionArray) {
        for (var i = 0; i < table.children.length; i++) {
          var row = table.children[i]
          if (row.subject) {
            row.setAttribute(
              'style',
              selectionArray[row.subject.uri] ? 'background-color: #cce;' : ''
            )
          }
        }
      }

      function refreshGroupsSelected () {
        return refreshThingsSelected(groupsMainTable, selectedGroups)
      }

      // Check every group is in the list and add it if not.

      function syncGroupTable () {
        function renderGroupRow (group) {
          // Is something is dropped on a group, add people to group
          function handleURIsDroppedOnGroup (uris) {
            uris.forEach(function (u) {
              console.log('Dropped on group: ' + u)
              var thing = kb.sym(u)
              var toBeFetched = [thing.doc(), group.doc()]

              kb.fetcher
                .load(toBeFetched)
                .then(function (_xhrs) {
                  var types = kb.findTypeURIs(thing)
                  for (var ty in types) {
                    console.log('    drop object type includes: ' + ty) // @@ Allow email addresses and phone numbers to be dropped?
                  }
                  if (
                    ns.vcard('Individual').uri in types ||
                    ns.vcard('Organization').uri in types
                  ) {
                    var pname = kb.any(thing, ns.vcard('fn'))
                    if (!pname) { return alert('No vcard name known for ' + thing) }
                    var already = kb.holds(
                      group,
                      ns.vcard('hasMember'),
                      thing,
                      group.doc()
                    )
                    if (already) {
                      return alert(
                        'ALREADY added ' + pname + ' to group ' + name
                      )
                    }
                    var message = 'Add ' + pname + ' to group ' + name + '?'
                    if (confirm(message)) {
                      var ins = [
                        $rdf.st(
                          group,
                          ns.vcard('hasMember'),
                          thing,
                          group.doc()
                        ),
                        $rdf.st(thing, ns.vcard('fn'), pname, group.doc())
                      ]
                      kb.updater.update([], ins, function (uri, ok, err) {
                        if (!ok) {
                          return complain(
                            'Error adding member to group ' +
                              group +
                              ': ' +
                              err
                          )
                        }
                        console.log('Added ' + pname + ' to group ' + name)
                        // @@ refresh UI
                      })
                    }
                  }
                })
                .catch(function (e) {
                  complain(
                    'Error looking up dropped thing ' +
                      thing +
                      ' and group: ' +
                      e
                  )
                })
            })
          }
          function groupRowClickListener (event) {
            event.preventDefault()
            var groupList = kb.sym(group.uri.split('#')[0])
            if (!event.metaKey) {
              selectedGroups = {} // If Command key pressed, accumulate multiple
            }
            selectedGroups[group.uri] = !selectedGroups[group.uri]
            refreshGroupsSelected()
            peopleMainTable.innerHTML = '' // clear in case refreshNames doesn't work for unknown reason

            kb.fetcher.nowOrWhenFetched(
              groupList.uri,
              undefined,
              function (ok, message) {
                if (!ok) {
                  return complainIfBad(
                    ok,
                    "Can't load group file: " + groupList + ': ' + message
                  )
                }
                refreshNames()

                if (!event.metaKey) {
                  // If only one group has beeen selected show ACL
                  cardMain.innerHTML = ''
                  var visible = false
                  var aclControl = UI.aclControl.ACLControlBox5(
                    group,
                    dataBrowserContext,
                    'group',
                    kb,
                    function (ok, body) {
                      if (!ok) cardMain.innerHTML = 'Failed: ' + body
                    }
                  )
                  var sharingButton = cardMain.appendChild(
                    dom.createElement('button')
                  )
                  sharingButton.style.cssText =
                    'padding: 1em; margin: 1em'
                  var img = sharingButton.appendChild(
                    dom.createElement('img')
                  )
                  img.style.cssText = 'width: 1.5em; height: 1.5em'
                  img.setAttribute(
                    'src',
                    UI.icons.iconBase + 'noun_123691.svg'
                  )
                  sharingButton.addEventListener('click', function () {
                    visible = !visible
                    if (visible) {
                      cardMain.appendChild(aclControl)
                    } else {
                      cardMain.removeChild(aclControl)
                    }
                  })
                }
              }
            )
          }

          // Body of renderGroupRow
          const name = kb.any(options.foreignGroup, ns.vcard('fn'))
          const groupRow = dom.createElement('tr')
          groupRow.subject = group
          UI.widgets.makeDraggable(groupRow, group)

          groupRow.setAttribute('style', dataCellStyle)
          groupRow.textContent = name

          UI.widgets.makeDropTarget(groupRow, handleURIsDroppedOnGroup)
          UI.widgets.deleteButtonWithCheck(
            dom,
            groupRow,
            'group ' + name,
            function () {
              deleteThing(group)
              syncGroupTable()
            }
          )
          groupRow.addEventListener('click', groupRowClickListener, true)
          return groupRow
        } // renderGroupRow

        var foundOne
        sortGroups()

        var i
        for (i = 0; i < groupsMainTable.children.length; i++) {
          var row = groupsMainTable.children[i]
          row.trashMe = true
        }

        for (var g = 0; g < groups.length; g++) {
          // var book = groups[g][0]
          var name = groups[g][1]
          var group = groups[g][2]

          // selectedGroups[group.uri] = false
          foundOne = false

          for (i = 0; i < groupsMainTable.children.length; i++) {
            const row = groupsMainTable.children[i]
            if (row.subject && row.subject.sameTerm(group)) {
              row.trashMe = false
              foundOne = true
              break
            }
          }
          if (!foundOne) {
            groupsMainTable.appendChild(renderGroupRow(group, name))
          }
        } // loop g

        for (i = 0; i < groupsMainTable.children.length; i++) {
          const r = groupsMainTable.children[i]
          if (r.trashMe) {
            groupsMainTable.removeChild(r)
          }
        }
        refreshGroupsSelected()
      } // syncGroupTable

      // //////////////////////////// Three-column Contact Browser  - Body

      // UI.store.fetcher.nowOrWhenFetched(groupIndex.uri, book, function (ok, body) {
      //   if (!ok) return console.log('Cannot load group index: ' + body)

      // //////////////////   Body of 3-column browser

      var bookTable = dom.createElement('table')
      bookTable.setAttribute(
        'style',
        'border-collapse: collapse; margin-right: 0; max-height: 9in;'
      )
      div.appendChild(bookTable)
      var bookHeader = bookTable.appendChild(dom.createElement('tr'))
      var bookMain = bookTable.appendChild(dom.createElement('tr'))
      var bookFooter = bookTable.appendChild(dom.createElement('tr'))
      var groupsHeader = bookHeader.appendChild(dom.createElement('td'))
      var peopleHeader = bookHeader.appendChild(dom.createElement('td'))
      var cardHeader = bookHeader.appendChild(dom.createElement('td'))
      var groupsMain = bookMain.appendChild(dom.createElement('td'))
      var groupsMainTable = groupsMain.appendChild(dom.createElement('table'))
      var peopleMain = bookMain.appendChild(dom.createElement('td'))
      var peopleMainTable = peopleMain.appendChild(dom.createElement('table'))

      var groupsFooter = bookFooter.appendChild(dom.createElement('td'))
      var peopleFooter = bookFooter.appendChild(dom.createElement('td'))
      var cardFooter = bookFooter.appendChild(dom.createElement('td'))

      cardHeader.appendChild(dom.createElement('div')) // searchDiv
      // searchDiv.setAttribute('style', 'border: 0.1em solid #888; border-radius: 0.5em')
      var searchInput = cardHeader.appendChild(dom.createElement('input'))
      searchInput.setAttribute('type', 'text')
      searchInput.setAttribute(
        'style',
        'border: 0.1em solid #444; border-radius: 0.5em; width: 100%; font-size: 100%; padding: 0.1em 0.6em'
      )

      searchInput.addEventListener('input', function (_event) {
        refreshFilteredPeople(true) // Active: select person if justone left
      })

      var cardMain = bookMain.appendChild(dom.createElement('td'))
      cardMain.setAttribute('style', 'margin: 0;') // fill space available
      var dataCellStyle = 'padding: 0.1em;'

      groupsHeader.textContent = 'groups'
      groupsHeader.setAttribute(
        'style',
        'min-width: 10em; padding-bottom 0.2em;'
      )

      function setGroupListVisibility (visible) {
        var vis = visible ? '' : 'display: none;'
        groupsHeader.setAttribute(
          'style',
          'min-width: 10em; padding-bottom 0.2em;' + vis
        )
        var hfstyle = 'padding: 0.1em;'
        groupsMain.setAttribute('style', hfstyle + vis)
        groupsFooter.setAttribute('style', hfstyle + vis)
      }
      setGroupListVisibility(true)

      var groups
      if (options.foreignGroup) {
        selectedGroups[options.foreignGroup.uri] = true
      }
      if (book) {
        var allGroups = groupsHeader.appendChild(dom.createElement('button'))
        allGroups.textContent = 'All'
        var style = 'margin-left: 1em; font-size: 100%;'
        allGroups.setAttribute('style', style)
        allGroups.addEventListener('click', function (_event) {
          allGroups.state = allGroups.state ? 0 : 1
          peopleMainTable.innerHTML = '' // clear in case refreshNames doesn't work for unknown reason
          if (allGroups.state) {
            allGroups.setAttribute('style', style + 'background-color: #ff8;')
            selectAllGroups(selectedGroups, groupsMainTable, function (
              ok,
              message
            ) {
              if (!ok) return complain(message)
              allGroups.setAttribute(
                'style',
                style + 'background-color: black; color: white'
              )
              refreshGroupsSelected()
            })
          } else {
            allGroups.setAttribute('style', style + 'background-color: #cfc;') // pale green hint groups loaded
            selectedGroups = {}
            refreshGroupsSelected()
          }
        }) // on button click
        kb.fetcher.nowOrWhenFetched(groupIndex.uri, book, function (ok, body) {
          if (!ok) return console.log('Cannot load group index: ' + body)
          syncGroupTable()
          refreshNames()
        })
      } else {
        syncGroupTable()
        refreshNames()
        console.log('No book, only one group -> hide list of groups')
        setGroupListVisibility(false) // If no books involved, hide group list
      } // if not book

      peopleHeader.textContent = 'name'
      peopleHeader.setAttribute('style', 'min-width: 18em;')
      peopleMain.setAttribute('style', 'overflow:scroll;')

      // New Contact button
      var newContactButton = dom.createElement('button')
      var container = dom.createElement('div')
      newContactButton.setAttribute('type', 'button')

      if (!me) newContactButton.setAttribute('disabled', 'true')

      UI.authn.checkUser().then(webId => {
        if (webId) {
          me = webId
          newContactButton.removeAttribute('disabled')
        }
      })

      container.appendChild(newContactButton)
      newContactButton.innerHTML = 'New Contact' // + IndividualClassLabel
      peopleFooter.appendChild(container)

      newContactButton.addEventListener(
        'click',
        function (_event) {
          // b.setAttribute('disabled', 'true');  (do we need o do this?)
          cardMain.innerHTML = ''

          var ourBook = findBookFromGroups(book)
          kb.fetcher
            .load(ourBook)
            .then(function (response) {
              if (!response.ok) throw new Error("Book won't load:" + ourBook)
              var nameEmailIndex = kb.any(ourBook, ns.vcard('nameEmailIndex'))
              if (!nameEmailIndex) throw new Error('Wot no nameEmailIndex?')
              return kb.fetcher.load(nameEmailIndex)
            })
            .then(function (response) {
              console.log('Name index loaded async' + response.url)
            })

          UI.widgets
            .askName(
              dom,
              kb,
              cardMain,
              UI.ns.foaf('name'),
              ns.vcard('Individual'),
              'person'
            )
            .then(function (name) {
              if (!name) return // cancelled by user
              cardMain.innerHTML = 'indexing...'
              createNewContact(book, name, selectedGroups, function (
                success,
                body
              ) {
                if (!success) {
                  console.log("Error: can't save new contact: " + body)
                } else {
                  const person = body
                  selectedPeople = {}
                  selectedPeople[person.uri] = true
                  refreshNames() // Add name to list of group
                  cardMain.innerHTML = '' // Clear 'indexing'
                  cardMain.appendChild(cardPane(dom, person, 'contact'))
                }
              })
            })
        },
        false
      )

      // New Group button
      if (book) {
        var newGroupButton = groupsFooter.appendChild(
          dom.createElement('button')
        )
        newGroupButton.setAttribute('type', 'button')
        newGroupButton.innerHTML = 'New Group' // + IndividualClassLabel
        newGroupButton.addEventListener(
          'click',
          function (_event) {
            // b.setAttribute('disabled', 'true');  (do we need o do this?)
            cardMain.innerHTML = ''
            var groupIndex = kb.any(book, ns.vcard('groupIndex'))
            kb.fetcher.nowOrWhenFetched(groupIndex, undefined, function (
              ok,
              message
            ) {
              if (ok) {
                console.log(' Group index has been loaded\n')
              } else {
                console.log(
                  'Error: Group index has NOT been loaded' + message + '\n'
                )
              }
            })

            UI.widgets
              .askName(
                dom,
                kb,
                cardMain,
                UI.ns.foaf('name'),
                ns.vcard('Group'),
                'group'
              )
              .then(function (name) {
                if (!name) return // cancelled by user
                saveNewGroup(book, name, function (success, body) {
                  if (!success) {
                    console.log("Error: can't save new group:" + body)
                    cardMain.innerHTML = 'Failed to save group' + body
                  } else {
                    selectedGroups = {}
                    selectedGroups[body.uri] = true
                    syncGroupTable() // Refresh list of groups

                    cardMain.innerHTML = ''
                    cardMain.appendChild(
                      UI.aclControl.ACLControlBox5(
                        body,
                        dataBrowserContext,
                        'group',
                        kb,
                        function (ok, body) {
                          if (!ok) {
                            cardMain.innerHTML =
                              'Group sharing setup failed: ' + body
                          }
                        }
                      )
                    )
                  }
                })
              })
          },
          false
        )

        // Tools button
        var toolsButton = cardFooter.appendChild(dom.createElement('button'))
        toolsButton.setAttribute('type', 'button')
        toolsButton.innerHTML = 'Tools'
        toolsButton.addEventListener('click', function (_event) {
          cardMain.innerHTML = ''
          cardMain.appendChild(
            toolsPane(
              selectAllGroups,
              selectedGroups,
              groupsMainTable,
              book,
              dataBrowserContext,
              me
            )
          )
        })
      } // if book

      cardFooter.appendChild(newAddressBookButton(book))

      // })

      div.appendChild(dom.createElement('hr'))
      //  div.appendChild(newAddressBookButton(book))       // later
      // end of AddressBook instance
    } // renderThreeColumnBrowser

    // ///////////////////////////////////////////////////////////////////////////////////

    // Render Individual card

    function renderIndividual (subject) {
      var mugshotDiv
      // ////////////////////  DRAG and Drop for mugshot image
      var card = subject

      function handleDroppedThing (thing) {
        kb.fetcher.nowOrWhenFetched(thing.doc(), function (ok, mess) {
          if (!ok) {
            console.log('Error looking up dropped thing ' + thing + ': ' + mess)
          } else {
            var types = kb.findTypeURIs(thing)
            for (var ty in types) {
              console.log('    drop object type includes: ' + ty) // @@ Allow email addresses and phone numbers to be dropped?
            }
            console.log('Default: assume web page  ' + thing) // icon was: UI.icons.iconBase + 'noun_25830.svg'
            kb.add(card, ns.wf('attachment'), thing, card.doc())
            // @@ refresh UI
          }
        })
      }

      async function linkToPicture (subject, pic, remove) {
        const link = [
          $rdf.st(subject, ns.vcard('hasPhoto'), pic, subject.doc())
        ]
        try {
          if (remove) {
            await kb.updater.update(link, [])
          } else {
            await kb.updater.update([], link)
          }
        } catch (err) {
          const msg = ' Write back image link FAIL ' + pic + ', Error: ' + err
          console.log(msg)
          alert(msg)
        }
      }

      function uploadFileToContact (filename, contentType, data) {
        // var fileExtension = filename.split('.').pop() // .toLowerCase()
        var extension = mime.extension(contentType)
        if (contentType !== mime.lookup(filename)) {
          filename += '_.' + extension
          console.log('MIME TYPE MISMATCH -- adding extension: ' + filename)
        }
        let prefix, predicate
        const isImage = contentType.startsWith('image')
        if (isImage) {
          prefix = 'image_'
          predicate = ns.vcard('hasPhoto')
        } else {
          prefix = 'attachment_'
          predicate = ns.wf('attachment')
        }

        var n, pic
        for (n = 0; ; n++) {
          // Check filename is not used or invent new one
          pic = kb.sym(card.dir().uri + filename)
          if (!kb.holds(subject, ns.vcard('hasPhoto'), pic)) {
            break
          }
          filename = prefix + n + '.' + extension
        }
        console.log(
          'Putting ' +
            data.byteLength +
            ' bytes of ' +
            contentType +
            ' to ' +
            pic
        )
        kb.fetcher
          .webOperation('PUT', pic.uri, {
            data: data,
            contentType: contentType
          })
          .then(function (response) {
            if (!response.ok) {
              complain('Error uploading ' + pic + ':' + response.status)
              return
            }
            console.log(' Upload: put OK: ' + pic)
            kb.add(subject, predicate, pic, subject.doc())
            kb.fetcher
              .putBack(subject.doc(), { contentType: 'text/turtle' })
              .then(
                function (_response) {
                  if (isImage) {
                    mugshotDiv.refresh()
                  }
                },
                function (err) {
                  console.log(
                    ' Write back image link FAIL ' + pic + ', Error: ' + err
                  )
                }
              )
          })
      }

      // When a set of URIs are dropped on
      function handleURIsDroppedOnMugshot (uris) {
        uris.map(function (u) {
          var thing = $rdf.sym(u) // Attachment needs text label to disinguish I think not icon.
          console.log('Dropped on mugshot thing ' + thing) // icon was: UI.icons.iconBase + 'noun_25830.svg'
          if (u.startsWith('http') && u.indexOf('#') < 0) {
            // Plain document
            // Take a copy of a photo on the web:
            const options = { withCredentials: false, credentials: 'omit' }
            kb.fetcher.webOperation('GET', thing.uri, options).then(
              result => {
                const contentType = result.headers.get('Content-Type')
                // let data = result.responseText
                let pathEnd = thing.uri.split('/').slice(-1)[0] // last segment as putative filename
                pathEnd = pathEnd.split('?')[0] // chop off any query params
                result.arrayBuffer().then(function (data) {
                  // read text stream
                  if (!result.ok) {
                    complain('Error downloading ' + thing + ':' + result.status)
                    return
                  }
                  uploadFileToContact(pathEnd, contentType, data)
                })
              },
              err => {
                complain(
                  `WebOp (fetch) error trying to read picture ${thing} on web: ${err}`
                )
              }
            )
            return
          } else {
            console.log(
              'Not a web document URI, cannot copy as picture: ' + thing
            )
          }
          handleDroppedThing(thing)
        })
      }

      // Drop an image file to set up the mugshot
      function droppedFileHandler (files) {
        for (var i = 0; i < files.length; i++) {
          const f = files[i]
          console.log(
            ' contacts: Filename: ' +
              f.name +
              ', type: ' +
              (f.type || 'n/a') +
              ' size: ' +
              f.size +
              ' bytes, last modified: ' +
              (f.lastModifiedDate
                ? f.lastModifiedDate.toLocaleDateString()
                : 'n/a')
          ) // See e.g. https://www.html5rocks.com/en/tutorials/file/dndfiles/

          // @@ Add: progress bar(s)
          var reader = new FileReader()
          reader.onload = (function (theFile) {
            return function (e) {
              var data = e.target.result
              console.log(' File read byteLength : ' + data.byteLength)
              var filename = encodeURIComponent(theFile.name)
              var contentType = theFile.type
              uploadFileToContact(filename, contentType, data)
            }
          })(f)
          reader.readAsArrayBuffer(f)
        }
      }
      // //////// End of drag and drop

      /// ///////////////////////////

      // Background metadata for this pane we bundle with the JS
      var individualForm = kb.sym(
        'https://solid.github.io/solid-panes/contact/individualForm.ttl#form1'
      )
      var individualFormDoc = individualForm.doc()
      if (!kb.holds(undefined, undefined, undefined, individualFormDoc)) {
        // If not loaded already
        var individualFormText = require('./individualForm.js')
        $rdf.parse(individualFormText, kb, individualFormDoc.uri, 'text/turtle') // Load form directly
      }
      var vcardOnt = UI.ns.vcard('Type').doc()
      if (!kb.holds(undefined, undefined, undefined, vcardOnt)) {
        // If not loaded already
        $rdf.parse(require('./vcard.js'), kb, vcardOnt.uri, 'text/turtle') // Load ontology directly
      }

      var toBeFetched = [subject.doc()] // was: individualFormDoc, UI.ns.vcard('Type').doc()
      kb.fetcher
        .load(toBeFetched)

        .catch(function (e) {
          console.log('Error: Failed to load subject: ' + e)
        }) // load.then

        .then(function (_xhrs) {
          function setPaneStyle () {
            var types = kb.findTypeURIs(subject)
            var mystyle = 'padding: 0.5em 1.5em 1em 1.5em; '
            var backgroundColor = null
            for (var uri in types) {
              backgroundColor = kb.anyValue(
                kb.sym(uri),
                ns.solid('profileHighlightColor')
              )
              if (backgroundColor) break
            }
            // allow the parent element to define background by default
            backgroundColor = backgroundColor || 'transparent'
            mystyle += 'background-color: ' + backgroundColor + '; '
            div.setAttribute('style', mystyle)
          }
          setPaneStyle()

          UI.authn.checkUser() // kick off async operation

          var editable = kb.updater.editable(subject.doc().uri, kb) // @@ ToDo -- also check wac-allow

          mugshotDiv = div.appendChild(dom.createElement('div'))

          function elementForImage (image) {
            const img = dom.createElement('img')
            img.setAttribute(
              'style',
              'max-height: 10em; border-radius: 1em; margin: 0.7em;'
            )
            UI.widgets.makeDropTarget(
              img,
              handleURIsDroppedOnMugshot,
              droppedFileHandler
            )
            if (image) {
              img.setAttribute('src', image.uri)
              UI.widgets.makeDraggable(img, image)
            }
            return img
          }

          var placeholder = elementForImage()
          UI.widgets.setImage(placeholder, subject) // Fallback icon or get from web

          function syncMugshots () {
            let images = kb.each(subject, ns.vcard('hasPhoto')) // Priviledge vcard ones
            images.sort() // arbitrary consistency
            images = images.slice(0, 5) // max number for the space
            if (images.length === 0) {
              mugshotDiv.innerHTML = '' // strictly, don't remove it if already there
              mugshotDiv.appendChild(placeholder)
            } else {
              UI.utils.syncTableToArray(mugshotDiv, images, elementForImage)
            }
          }

          // Good URI for a Camera picture
          function getImageDoc () {
            const imageDoc = kb.sym(
              subject.dir().uri + 'Image_' + Date.now() + '.png'
            )
            return imageDoc
          }
          // Store picture
          async function tookPicture (imageDoc) {
            if (imageDoc) {
              await linkToPicture(subject, imageDoc)
              syncMugshots()
            }
          }

          function trashCan () {
            const button = UI.widgets.button(
              dom,
              UI.icons.iconBase + 'noun_925021.svg',
              'Drag here to delete'
            )
            async function droppedURIHandler (uris) {
              const images = kb
                .each(subject, ns.vcard('hasPhoto'))
                .map(x => x.uri)
              for (var uri of uris) {
                if (!images.includes(uri)) {
                  alert('Only drop images in this contact onto this trash can.')
                  return
                }
                if (confirm(`Permanently DELETE image ${uri} completely?`)) {
                  console.log('Unlinking image file ' + uri)
                  await linkToPicture(subject, kb.sym(uri), true)
                  try {
                    console.log('Deleting image file ' + uri)
                    await kb.fetcher.webOperation('DELETE', uri)
                  } catch (err) {
                    alert('Unable to delete picture! ' + err)
                  }
                }
              }
              syncMugshots()
            }
            UI.widgets.makeDropTarget(button, droppedURIHandler, null)
            return button
          }

          function renderImageTools () {
            const imageToolTable = dom.createElement('table')
            const row = imageToolTable.appendChild(dom.createElement('tr'))
            const left = row.appendChild(dom.createElement('td'))
            const middle = row.appendChild(dom.createElement('td'))
            const right = row.appendChild(dom.createElement('td'))

            left.appendChild(
              UI.media.cameraButton(dom, kb, getImageDoc, tookPicture)
            ) // 20190812
            try {
              middle.appendChild(
                UI.widgets.fileUploadButtonDiv(dom, droppedFileHandler)
              )
            } catch (e) {
              console.log('ignore fileUploadButtonDiv error for now', e)
            }
            right.appendChild(trashCan())
            return imageToolTable
          }

          syncMugshots()
          mugshotDiv.refresh = syncMugshots
          if (editable) {
            div.appendChild(renderImageTools())
          }

          UI.widgets.appendForm(
            dom,
            div,
            {},
            subject,
            individualForm,
            cardDoc,
            complainIfBad
          )

          div
            .appendChild(dom.createElement('tr'))
            .setAttribute('style', 'height: 1em') // spacer

          function lookUpId (dom, container, x) {
            var tr = table.appendChild(dom.createElement('tr'))
            tr.setAttribute('style', 'margin-top: 0.1em solid #ccc;')
            var nameTD = tr.appendChild(dom.createElement('td'))
            var formTD = tr.appendChild(dom.createElement('td'))
            nameTD.textContent = x.uri.split('/')[2]

            kb.fetcher
              .load(x)
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

            formTD.appendChild(UI.widgets.linkIcon(dom, x))
          }

          var table = div.appendChild(dom.createElement('table'))

          var aliases = kb.allAliases(subject)
          if (aliases.length > 1) {
            for (var i = 0; i < aliases.length; i++) {
              var x = aliases[i]
              if (!x.sameTerm(subject)) {
                lookUpId(dom, table, x)
                // UI.widgets.appendForm(dom, formTD, {}, x, individualForm, x.doc(), complainIfBad)
              }
            }
          }

          UI.widgets.attachmentList(dom, subject, div, {
            // promptIcon: UI.icons.iconBase +  'noun_681601.svg',
            predicate: UI.ns.vcard('url') // @@@@@@@@@ ,--- no, the vcard ontology structure uses a bnode.
          })

          div.appendChild(dom.createElement('hr'))

          var pages = kb.each(subject, ns.vcard('url')) // vcard:url [ a vcard:HomePage; vcard:value <http://www.w3.org/People/Berners-Lee>],
          pages.forEach(function (p) {
            var cla = kb.any(p, ns.rdf('type'))
            var val = kb.any(p, ns.vcard('value'))
            if (val) {
              var tr = table.appendChild(dom.createElement('tr'))
              tr.setAttribute('style', 'margin-top: 0.1em solid #ccc;')

              var nameTD = tr.appendChild(dom.createElement('td'))
              nameTD.textContent = UI.utils.label(cla)

              var formTD = tr.appendChild(dom.createElement('td'))
              var anchor = formTD.appendChild(dom.createElement('a'))
              anchor.setAttribute('href', val.uri)
              var span = anchor.appendChild(dom.createElement('span'))
              span.textContent = val.uri
            }
          })

          div.appendChild(dom.createElement('hr'))

          // Remove a person from a group

          function removeFromGroup (thing, group) {
            var pname = kb.any(thing, ns.vcard('fn'))
            var gname = kb.any(group, ns.vcard('fn'))
            var groups = kb.each(null, ns.vcard('hasMember'), thing)
            if (groups.length < 2) {
              alert(
                'Must be a member of at least one group.  Add to another group first.'
              )
              return
            }
            var message = 'Remove ' + pname + ' from group ' + gname + '?'
            if (confirm(message)) {
              var del = [
                $rdf.st(group, ns.vcard('hasMember'), thing, group.doc()),
                $rdf.st(thing, ns.vcard('fn'), pname, group.doc())
              ]
              kb.updater.update(del, [], function (uri, ok, err) {
                if (!ok) {
                  return complain(
                    'Error removing member from group ' + group + ': ' + err
                  )
                }
                console.log('Removed ' + pname + ' from group ' + gname)
                syncGroupList()
              })
            }
          }

          function newRowForGroup (group) {
            var options = {
              deleteFunction: function () {
                removeFromGroup(subject, group)
              },
              noun: 'membership'
            }
            var tr = UI.widgets.personTR(dom, null, group, options)
            return tr
          }

          var groupList = div.appendChild(dom.createElement('table'))
          function syncGroupList () {
            var groups = kb.each(null, ns.vcard('hasMember'), subject)
            UI.utils.syncTableToArray(groupList, groups, newRowForGroup)
          }
          groupList.refresh = syncGroupList
          syncGroupList()
        })
    } // renderIndividual

    //              Render a single contact Individual

    if (
      t[ns.vcard('Individual').uri] ||
      t[ns.vcard('Organization').uri] ||
      t[ns.foaf('Person').uri] ||
      t[ns.schema('Person').uri]
    ) {
      renderIndividual(subject)

      //          Render a Group instance
    } else if (t[ns.vcard('Group').uri]) {
      // If we have a main address book, then render this group as a guest group within it
      UI.authn
        .findAppInstances(context, ns.vcard('AddressBook'))
        .then(function (context) {
          var addressBooks = context.instances
          var options = { foreignGroup: subject }
          if (addressBooks.length > 0) {
            // var book = addressBooks[0]
            renderThreeColumnBrowser(addressBooks, context, options)
          } else {
            renderThreeColumnBrowser([], context, options)
            // @@ button to Make a new addressBook
          }
        })
        .catch(function (e) {
          UI.widgets.complain(context, e)
        })

      // Render a AddressBook instance
    } else if (t[ns.vcard('AddressBook').uri]) {
      renderThreeColumnBrowser([subject], context, {})
    } else {
      console.log(
        'Error: Contact pane: No evidence that ' +
          subject +
          ' is anything to do with contacts.'
      )
    }

    me = UI.authn.currentUser()
    if (!me) {
      console.log(
        '(You do not have your Web Id set. Sign in or sign up to make changes.)'
      )
      UI.authn.logInLoadProfile(context).then(
        context => {
          console.log('Logged in as ' + context.me)
          me = context.me
        },
        err => {
          div.appendChild(UI.widgets.errorMessageBlock(err))
        }
      )
    } else {
      // console.log("(Your webid is "+ me +")")
    }

    // /////////////// Fix user when testing on a plane

    if (
      typeof document !== 'undefined' &&
      document.location &&
      ('' + document.location).slice(0, 16) === 'http://localhost'
    ) {
      me = kb.any(subject, UI.ns.acl('owner')) // when testing on plane with no webid
      console.log('Assuming user is ' + me)
    }
    return div
  }
}
// ends
