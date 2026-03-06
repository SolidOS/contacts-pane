//  The tools pane is for managing and debugging and maintaining solid contacts databases
import * as UI from 'solid-ui'
import { store } from 'solid-logic'
import { saveNewGroup, addPersonToGroup, groupMembers } from './contactLogic'
import './styles/toolsPane.css'
import * as $rdf from 'rdflib'
import { complain, normalizeGroupUri } from './localUtils'
import * as debug from './debug'

const kb = store
const ns = UI.ns
const VCARD = ns.vcard

let book
let selectedGroups
let logSpace

export function toolsPane (
  selectAllGroups,
  selectedGroupsParam,
  groupsMainTable,
  bookParam,
  dataBrowserContext,
  me
) {
  book = bookParam
  selectedGroups = selectedGroupsParam
  const dom = dataBrowserContext.dom

  const pane = dom.createElement('div')
  pane.classList.add('toolsPane')

  const settingsHeader = dom.createElement('h3')
  settingsHeader.textContent = 'Tools'
  pane.appendChild(settingsHeader)

  const divStatistics = pane.appendChild(dom.createElement('div'))
  divStatistics.classList.add('statsLog')

  logSpace = divStatistics.appendChild(dom.createElement('pre'))
  logSpace.setAttribute('id', 'logSpace')

  const buttonsContainer = pane.appendChild(dom.createElement('div'))
  buttonsContainer.classList.add('toolsButtonsContainer')

  function setActiveButton (activeBtn) {
    const wasActive = activeBtn.classList.contains('btn-primary')
    buttonsContainer.querySelectorAll('button').forEach(btn => {
      btn.classList.remove('btn-primary', 'toolsButton--loading', 'toolsButton--error', 'toolsButton--success')
      btn.classList.add('btn-secondary')
    })
    if (!wasActive) {
      activeBtn.classList.remove('btn-secondary')
      activeBtn.classList.add('btn-primary')
    }
  }

  const loadIndexButton = buttonsContainer.appendChild(dom.createElement('button'))
  loadIndexButton.textContent = 'Load main index'
  loadIndexButton.classList.add('actionButton', 'btn-secondary', 'action-button-focus')
  loadIndexButton.addEventListener('click', () => {
    setActiveButton(loadIndexButton)
    logSpace.textContent = ''
    loadIndexHandler(loadIndexButton, logSpace)
  })

  const statButton = buttonsContainer.appendChild(dom.createElement('button'))
  statButton.textContent = 'Statistics'
  statButton.classList.add('actionButton', 'btn-secondary', 'action-button-focus')
  statButton.addEventListener('click', () => {
    setActiveButton(statButton)
    logSpace.textContent = ''
    stats(logSpace)
  })

  const checkAccessButton = buttonsContainer.appendChild(dom.createElement('button'))
  checkAccessButton.textContent =
    'Check individual contact access of selected groups'
  checkAccessButton.classList.add('actionButton', 'btn-secondary', 'action-button-focus')
  checkAccessButton.addEventListener('click', (event) => {
    setActiveButton(checkAccessButton)
    logSpace.textContent = ''
    checkAcces(event)
  })

  // DUPLICATES CHECK
  const checkDuplicates = buttonsContainer.appendChild(dom.createElement('button'))
  checkDuplicates.textContent = 'Find duplicate contacts'
  checkDuplicates.classList.add('actionButton', 'btn-secondary', 'action-button-focus')
  checkDuplicates.addEventListener('click', function (_event) {
    setActiveButton(checkDuplicates)
    logSpace.textContent = ''
    const stats = {} // global god context

    stats.book = book
    stats.nameEmailIndex = kb.any(book, ns.vcard('nameEmailIndex'))
    log(logSpace, 'Loading name index...')

    store.fetcher.nowOrWhenFetched(
      stats.nameEmailIndex,
      undefined,
      function (_ok, _message) {
        log(logSpace, 'Loaded name index.')

        stats.cards = []
        stats.duplicates = []
        stats.definitive = []
        stats.nameless = []

        stats.exactDuplicates = []
        stats.nameOnlyDuplicates = []

        stats.uniquesSet = []
        stats.groupProblems = []

        // Erase one card and all its files  -> (err)
        //
        /*
        function eraseOne (card) {
          return new Promise(function (resolve, reject) {
            function removeFromMainIndex () {
              var indexBit = kb.connectedStatements(card, stats.nameEmailIndex)
              log(logSpace, 'Bits of the name index file:' + indexBit)
              log(logSpace, 'Patching main index file...')
              kb.updater.update(indexBit, [], function (uri, ok, body) {
                if (ok) {
                  log(logSpace, 'Success')
                  resolve(null)
                } else {
                  log(logSpace, 'Error patching index file! ' + body)
                  reject('Error patching index file! ' + body)
                }
              })
            }
            var filesToDelete = [ card.doc() ]
            var photos = kb.each(card, ns.vcard('hasPhoto')) // could be > 1
            if (photos.length) {
              filesToDelete = filesToDelete.concat(photos)
            }
            filesToDelete.push(card.dir()) // the folder last
            log(logSpace, 'Files to delete: ' + filesToDelete)
            if (!confirm('DELETE card ' + card.dir() + ' for "' + kb.any(card, VCARD('fn')) + '", with ' + kb.each(card).length + 'statements?')) {
              return resolve('Cancelled by user')
            }

            function deleteNextFile () {
              var resource = filesToDelete.shift()
              if (!resource) {
                log(logSpace, 'All deleted')
                removeFromMainIndex()
                resolve()
              }
              log(logSpace, 'Deleting ... ' + resource)
              kb.fetcher.delete(resource)
                .then(function () {
                  log(logSpace, 'Deleted ok: ' + resource)
                  deleteNextFile()
                })
                .catch(function (e) {
                  var err = '*** ERROR deleting ' + resource + ': ' + e
                  log(logSpace, err)
                  if (confirm('Patch out index file for card ' + card.dir() + ' EVEN THOUGH card DELETE errors?')) {
                    removeFromMainIndex()
                  } else {
                    reject(err)
                  }
                })
            }
            deleteNextFile()
          }) // Promise
        } // erase one
*/
        //   Check actual records to see which are exact matches - slow
        stats.nameDupLog = kb.sym(book.dir().uri + 'dedup-nameDupLog.ttl')
        stats.exactDupLog = kb.sym(book.dir().uri + 'dedup-exactDupLog.ttl')
        /*
        function checkOne (card) {
          return new Promise(function (resolve, reject) {
            var name = kb.anyValue(card, ns.vcard('fn'))
            var other = stats.definitive[name]
            kb.fetcher.load([card, other]).then(function (xhrs) {
              var exclude = {}
              exclude[ns.vcard('hasUID').uri] = true
              exclude[ns.dc('created').uri] = true
              exclude[ns.dc('modified').uri] = true
              function filtered (x) {
                return kb.statementsMatching(null, null, null, x.doc()).filter(function (st) {
                  return !exclude[st.predicate.uri]
                })
              }
              var desc = filtered(card)
              var desc2 = filtered(other)
              // var desc = connectedStatements(card, card.doc(), exclude)
              // var desc2 = connectedStatements(other, other.doc(), exclude)
              if (desc.length !== desc2.length) {
                log(logSpace, 'CARDS to NOT match lengths ')
                stats.nameOnlyDuplicates.push(card)
                return resolve(false)
              }
              if (!desc.length) {
                log(logSpace, '@@@@@@  Zero length ')
                stats.nameOnlyDuplicates.push(card)
                return resolve(false)
              }
              // //////// Compare the two
              // Cheat: serialize and compare
              // var cardText = $rdf.serialize(card.doc(), kb, card.doc().uri, 'text/turtle')
              // var otherText = $rdf.serialize(other.doc(), kb, other.doc().uri, 'text/turtle')
              var cardText = (new $rdf.Serializer(kb)).setBase(card.doc().uri).statementsToN3(desc)
              var otherText = (new $rdf.Serializer(kb)).setBase(other.doc().uri).statementsToN3(desc2)
              //
              //              log('Name: ' + name + ', statements: ' + desc.length)
              //              log('___________________________________________')
              //              log('KEEPING: ' + other.doc() + '\n' + cardText)
              //              log('___________________________________________')
              //              log('DELETING: '+ card.doc() + '\n' + otherText)
              //              log('___________________________________________')
              //
              if (cardText !== otherText) {
                log(logSpace, 'Texts differ')
                stats.nameOnlyDuplicates.push(card)
                return resolve(false)
              }
              var cardGroups = kb.each(null, ns.vcard('hasMember'), card)
              var otherGroups = kb.each(null, ns.vcard('hasMember'), other)
              for (var j = 0; j < cardGroups.length; j++) {
                var found = false
                for (var k = 0; k < otherGroups.length; k++) {
                  if (otherGroups[k].sameTerm(cardGroups[j])) { found = true }
                }
                if (!found) {
                  log(logSpace, 'This one groups: ' + cardGroups)
                  log(logSpace, 'Other one groups: ' + otherGroups)
                  log(logSpace, 'Cant delete this one because it has a group, ' + cardGroups[j] + ', which the other does not.')
                  stats.nameOnlyDuplicates.push(card)
                  return resolve(false)
                }
              }
              debug.log('Group check done -- exact duplicate: ' + card)
              stats.exactDuplicates.push(card)
              resolve(true)
            }).catch(function (e) {
              log(logSpace, 'Cant load a card! ' + [card, other] + ': ' + e)
              stats.nameOnlyDuplicates.push(card)
              resolve(false)
            // if (confirm('Patch out index file for card ' + card.dir() + ' EVEN THOUGH card READ errors?')){
            //  removeFromMainIndex()
            // }
            })
          })
        } // checkOne
*/
        stats.nameOnlyErrors = []
        stats.nameLessZeroData = []
        stats.nameLessIndex = []
        stats.namelessUniques = []
        stats.nameOnlyDuplicatesGroupDiff = []

        function checkOneNameless (card) {
          return new Promise(function (resolve) {
            kb.fetcher
              .load(card)
              .then(function (_xhr) {
                log(logSpace, ' Nameless check ' + card)
                const exclude = {}
                exclude[ns.vcard('hasUID').uri] = true
                exclude[ns.dc('created').uri] = true
                exclude[ns.dc('modified').uri] = true
                function filtered (x) {
                  return kb
                    .statementsMatching(null, null, null, x.doc())
                    .filter(function (st) {
                      return !exclude[st.predicate.uri]
                    })
                }

                const desc = filtered(card)
                // var desc = connectedStatements(card, card.doc(), exclude)
                // var desc2 = connectedStatements(other, other.doc(), exclude)
                if (!desc.length) {
                  log(logSpace, '  Zero length ' + card)
                  stats.nameLessZeroData.push(card)
                  return resolve(false)
                }
                // Compare the two
                // Cheat: serialize and compare
                // var cardText = $rdf.serialize(card.doc(), kb, card.doc().uri, 'text/turtle')
                // var otherText = $rdf.serialize(other.doc(), kb, other.doc().uri, 'text/turtle')
                const cardText = new $rdf.Serializer(kb)
                  .setBase(card.doc().uri)
                  .statementsToN3(desc)
                const other = stats.nameLessIndex[cardText]
                if (other) {
                  log(logSpace, '  Matches with ' + other)
                  // alain not sure it works we may need to concat with 'sameAs' group.doc (.map(st => st.why))
                  const cardGroups = kb.each(null, ns.vcard('hasMember'), card)
                  const otherGroups = kb.each(null, ns.vcard('hasMember'), other)
                  for (let j = 0; j < cardGroups.length; j++) {
                    let found = false
                    for (let k = 0; k < otherGroups.length; k++) {
                      if (otherGroups[k].sameTerm(cardGroups[j])) found = true
                    }
                    if (!found) {
                      log(logSpace, 'This one groups: ' + cardGroups)
                      log(logSpace, 'Other one groups: ' + otherGroups)
                      log(
                        logSpace,
                        'Cant skip this one because it has a group, ' +
                          cardGroups[j] +
                          ', which the other does not.'
                      )
                      stats.nameOnlyDuplicatesGroupDiff.push(card)
                      return resolve(false)
                    }
                  }
                  debug.log('Group check done -- exact duplicate: ' + card)
                } else {
                  log(logSpace, 'First nameless like: ' + card.doc())
                  log(logSpace, '___________________________________________')
                  log(logSpace, cardText)
                  log(logSpace, '___________________________________________')
                  stats.nameLessIndex[cardText] = card
                  stats.namelessUniques.push(card)
                }
                resolve(true)
              })
              .catch(function (e) {
                log(logSpace, 'Cant load a nameless card!: ' + e)
                stats.nameOnlyErrors.push(card)
                resolve(false)
              })
          })
        } // checkOneNameless

        function checkAllNameless () {
          stats.namelessToCheck =
            stats.namelessToCheck || stats.nameless.slice()
          log(logSpace, 'Nameless check left: ' + stats.namelessToCheck.length)
          return new Promise(function (resolve) {
            const x = stats.namelessToCheck.shift()
            if (!x) {
              log(logSpace, 'namelessUniques: ' + stats.namelessUniques.length)
              log(logSpace, 'namelessUniques: ' + stats.namelessUniques)
              if (stats.namelessUniques.length > 0) {
                const msg = dom.createElement('p')
                msg.textContent = 'Add all ' + stats.namelessUniques.length + ' nameless contacts to the rescued set?'
                divStatistics.appendChild(msg)
                const confirmButton = UI.widgets.continueButton(dom, function () {
                  stats.uniques = stats.uniques.concat(stats.namelessUniques)
                  for (let k = 0; k < stats.namelessUniques.length; k++) {
                    stats.uniqueSet[stats.namelessUniques[k].uri] = true
                  }
                  msg.remove()
                  confirmButton.remove()
                  resolve(true)
                })
                divStatistics.appendChild(confirmButton)
              } else {
                return resolve(true)
              }
              return
            }
            checkOneNameless(x).then(function (exact) {
              log(logSpace, '    Nameless check returns ' + exact)
              checkAllNameless() // loop
            })
          })
        }

        function checkGroupMembers () {
          return new Promise(function (resolve) {
            // var inUniques = 0
            log(logSpace, 'Groups loaded')
            for (let i = 0; i < stats.uniques.length; i++) {
              stats.uniquesSet[stats.uniques[i].uri] = true
            }
            stats.groupMembers = []
            kb.each(null, ns.vcard('hasMember'))
              .forEach(group => { stats.groupMembers = stats.groupMembers.concat(groupMembers(kb, group)) })
            log(logSpace, '  Naive group members ' + stats.groupMembers.length)
            stats.groupMemberSet = []
            for (let j = 0; j < stats.groupMembers.length; j++) {
              stats.groupMemberSet[stats.groupMembers[j].uri] =
                stats.groupMembers[j]
            }
            stats.groupMembers2 = []
            for (const g in stats.groupMemberSet) {
              stats.groupMembers2.push(stats.groupMemberSet[g])
            }
            log(logSpace, '  Compact group members ' + stats.groupMembers2.length)

            if (
              $rdf.keepThisCodeForLaterButDisableFerossConstantConditionPolice
            ) {
              // Don't inspect as seems groups membership is complete
              for (let i = 0; i < stats.groupMembers.length; i++) {
                const card = stats.groupMembers[i]
                if (stats.uniquesSet[card.uri]) {
                  // inUniques += 1
                } else {
                  log(logSpace, '  Not in uniques: ' + card)
                  stats.groupProblems.push(card)
                  if (stats.duplicateSet[card.uri]) {
                    log(logSpace, '    ** IN duplicates alas:' + card)
                  } else {
                    log(logSpace, '   **** WTF?')
                  }
                }
              }
              log(logSpace, 'Problem contacts: ' + stats.groupProblems.length)
            } // if
            resolve(true)
          })
        } //  checkGroupMembers

        function scanForDuplicates () {
          return new Promise(function (resolve) {
            stats.cards = kb.each(undefined, VCARD('inAddressBook'), stats.book)
            log(logSpace, '' + stats.cards.length + ' total contacts')

            let c, card, name
            for (c = 0; c < stats.cards.length; c++) {
              card = stats.cards[c]
              name = kb.anyValue(card, ns.vcard('fn'))
              if (!name) {
                stats.nameless.push(card)
                continue
              }
              if (stats.definitive[name] === card) {
                // pass
              } else if (stats.definitive[name]) {
                const n = stats.duplicates.length
                if (n < 100 || (n < 1000 && n % 10 === 0) || n % 100 === 0) {
                  // log('' + n + ') Possible duplicate ' + card + ' of: ' + definitive[name])
                }
                stats.duplicates.push(card)
              } else {
                stats.definitive[name] = card
              }
            }

            stats.duplicateSet = []
            for (let i = 0; i < stats.duplicates.length; i++) {
              stats.duplicateSet[stats.duplicates[i].uri] = stats.duplicates[i]
            }
            stats.namelessSet = []
            for (let i = 0; i < stats.nameless.length; i++) {
              stats.namelessSet[stats.nameless[i].uri] = stats.nameless[i]
            }
            stats.uniques = []
            stats.uniqueSet = []
            for (let i = 0; i < stats.cards.length; i++) {
              const uri = stats.cards[i].uri
              if (!stats.duplicateSet[uri] && !stats.namelessSet[uri]) {
                stats.uniques.push(stats.cards[i])
                stats.uniqueSet[uri] = stats.cards[i]
              }
            }
            log(logSpace, 'Uniques: ' + stats.uniques.length)

            log(logSpace, '' + stats.nameless.length + ' nameless contacts.')
            log(
              logSpace,
              '' +
                stats.duplicates.length +
                ' name-duplicate contacts, leaving ' +
                (stats.cards.length - stats.duplicates.length)
            )
            resolve(true)
          })
        }

        // Save a new clean version
        function saveCleanPeople () {
          let cleanPeople

          return Promise.resolve()
            .then(() => {
              cleanPeople = kb.sym(stats.book.dir().uri + 'clean-people.ttl')
              let sts = []
              for (let i = 0; i < stats.uniques.length; i++) {
                sts = sts.concat(
                  kb.connectedStatements(stats.uniques[i], stats.nameEmailIndex)
                )
              }
              const sz = new $rdf.Serializer(kb).setBase(stats.nameEmailIndex.uri)
              log(logSpace, 'Serializing index of uniques...')
              const data = sz.statementsToN3(sts)

              return kb.fetcher.webOperation('PUT', cleanPeople, {
                data,
                contentType: 'text/turtle'
              })
            })
            .then(function () {
              log(logSpace, 'Done uniques log ' + cleanPeople)
              return true
            })
            .catch(function (e) {
              log(logSpace, 'Error saving uniques: ' + e)
            })
        }

        function saveCleanGroup (g) {
          let cleanGroup

          return Promise.resolve()
            .then(() => {
              const s = g.uri.replace('/Group/', '/NewGroup/')
              cleanGroup = kb.sym(s)
              let sts = []
              for (let i = 0; i < stats.uniques.length; i++) {
                sts = sts.concat(
                  kb.connectedStatements(stats.uniques[i], g.doc())
                )
              }
              const sz = new $rdf.Serializer(kb).setBase(g.uri)
              log(logSpace, '   Regenerating group of uniques...' + cleanGroup)
              const data = sz.statementsToN3(sts)

              return kb.fetcher.webOperation('PUT', cleanGroup, {
                data,
                contentType: 'text/turtle'
              })
            })
            .then(() => {
              log(logSpace, '     Done uniques group ' + cleanGroup)
              return true
            })
            .catch(e => {
              log(logSpace, 'Error saving : ' + e)
            })
        }

        function saveAllGroups () {
          log(logSpace, 'Saving ALL GROUPS')
          return Promise.all(stats.groupObjects.map(saveCleanGroup))
        }

        const getAndSortGroups = function () {
          let groups = []
          if (stats.book) {
            const books = [stats.book]
            books.forEach(function (book) {
              const gs = book ? kb.each(book, ns.vcard('includesGroup')) : []
              const gs2 = gs.map(function (g) {
                return [book, kb.any(g, ns.vcard('fn')), g]
              })
              groups = groups.concat(gs2)
            })
            groups.sort()
          }
          return groups
        }
        const groups = getAndSortGroups() // Needed?

        stats.groupObjects = groups.map(gstr => gstr[2])
        log(logSpace, 'Loading ' + stats.groupObjects.length + ' groups... ')
        kb.fetcher
          .load(stats.groupObjects)
          .then(scanForDuplicates)
          .then(checkGroupMembers)
          .then(checkAllNameless)
          .then(saveCleanPeople)
          .then(saveAllGroups)
          .then(function () {
            log(logSpace, 'Done!')
          })
      }
    )
  })

  const checkGroupless = buttonsContainer.appendChild(dom.createElement('button'))
  checkGroupless.classList.add('actionButton', 'btn-secondary', 'action-button-focus')
  checkGroupless.textContent = 'Find contacts with no group'
  checkGroupless.addEventListener('click', function (_event) {
    setActiveButton(checkGroupless)
    logSpace.textContent = ''
    log(logSpace, 'Loading groups...')
    selectAllGroups(selectedGroups, groupsMainTable, async function (ok, message) {
      if (!ok) {
        log(logSpace, 'Load all groups: failed: ' + message)
        return
      }

      const nameEmailIndex = kb.any(book, ns.vcard('nameEmailIndex'))
      try {
        await kb.fetcher.load(nameEmailIndex)
      } catch (e) {
        complain(e)
      }
      log(logSpace, 'Loaded groups and name index.')
      getGroupless(book)
      log(logSpace, 'Groupless list finished..')
    }) // select all groups then
  })

  const fixGrouplessButton = buttonsContainer.appendChild(dom.createElement('button'))
  fixGrouplessButton.classList.add('actionButton', 'btn-secondary', 'action-button-focus')
  fixGrouplessButton.textContent = 'Put all individuals with no group in a new group'
  fixGrouplessButton.addEventListener('click', _event => {
    setActiveButton(fixGrouplessButton)
    logSpace.textContent = ''
    fixGroupless(book)
  })

  const fixToOldDataModelButton = buttonsContainer.appendChild(dom.createElement('button'))
  fixToOldDataModelButton.classList.add('actionButton', 'btn-secondary', 'action-button-focus')
  fixToOldDataModelButton.textContent = 'Revert groups to old data model'
  fixToOldDataModelButton.addEventListener('click', _event => {
    setActiveButton(fixToOldDataModelButton)
    logSpace.textContent = ''
    fixToOldDataModel(book)
  })
  return pane
}

async function checkAcces (_event) {
  function doCard (card) {
    UI.acl.fixIndividualCardACL(card, (msg) => log(logSpace, msg), function (ok, message) {
      if (ok) {
        log(logSpace, 'Success for ' + UI.utils.label(card))
      } else {
        log(logSpace, 'Failure for ' + UI.utils.label(card) + ': ' + message)
      }
    })
  }
  const gg = []
  for (const g in selectedGroups) {
    gg.push(g)
  }

  for (let i = 0; i < gg.length; i++) {
    const g = kb.sym(gg[i])
    const a = groupMembers(kb, g)
    log(logSpace, UI.utils.label(g) + ': ' + a.length + ' members')
    for (let j = 0; j < a.length; j++) {
      const card = a[j]
      log(logSpace, UI.utils.label(card))
      doCard(card)
    }
  }
}

function log (logSpace, message) {
  debug.log(message)
  logSpace.textContent += message + '\n'
}

function stats (logSpace) {
  const totalContacts = kb.each(undefined, VCARD('inAddressBook'), book).length
  log(logSpace, '' + totalContacts + ' contacts loaded. ')
  let groups = kb.each(book, VCARD('includesGroup'))
  const strings = new Set(groups.map(group => normalizeGroupUri(group.uri))) // remove dups with normalized URIs
  groups = [...strings].map(uri => kb.sym(uri))
  log(logSpace, '' + groups.length + ' total groups. ')
  const gg = []
  for (const g in selectedGroups) {
    gg.push(g)
  }
  log(logSpace, '' + gg.length + ' selected groups. ')
}

async function loadIndexHandler (loadIndexButton, logSpace) {
  loadIndexButton.classList.add('toolsButton--loading')
  loadIndexButton.classList.remove('toolsButton--error', 'toolsButton--success')
  const nameEmailIndex = kb.any(book, ns.vcard('nameEmailIndex'))
  try {
    await kb.fetcher.load(nameEmailIndex)
  } catch (e) {
    loadIndexButton.classList.remove('toolsButton--loading')
    loadIndexButton.classList.add('toolsButton--error')
    log(logSpace, 'Error: People index has NOT been loaded' + e + '\n')
  }
  loadIndexButton.classList.remove('toolsButton--loading')
  loadIndexButton.classList.add('toolsButton--success')
  log(logSpace, ' People index has been loaded\n')
} // loadIndexHandler

async function fixGroupless (book) {
  const groupless = await getGroupless(book)
  if (groupless.length === 0) {
    log(logSpace, 'No groupless contacts found.')
    return
  }
  const groupOfUngrouped = await saveNewGroup(book, 'No group')
  const dom = logSpace.ownerDocument
  return new Promise(function (resolve) {
    const msg = dom.createElement('p')
    msg.textContent = `Add the ${groupless.length} contacts without groups to a 'No group' group?`
    logSpace.parentNode.appendChild(msg)
    const confirmButton = UI.widgets.continueButton(dom, async function () {
      msg.remove()
      confirmButton.remove()
      for (const person of groupless) {
        log(logSpace, '   adding ' + UI.utils.label(person))
        await addPersonToGroup(person, groupOfUngrouped)
      }
      log(logSpace, 'People moved to group.')
      resolve()
    })
    logSpace.parentNode.appendChild(confirmButton)
  })
}

async function getGroupless (book) {
  const groupIndex = kb.any(book, ns.vcard('groupIndex'))
  const nameEmailIndex = kb.any(book, ns.vcard('nameEmailIndex'))
  try {
    await kb.fetcher.load([nameEmailIndex, groupIndex])
    const groups = kb.each(book, ns.vcard('includesGroup'))
    await kb.fetcher.load(groups)
  } catch (e) {
    complain('Error loading stuff:' + e)
  }

  const reverseIndex = {}
  const groupless = []
  let groups = kb.each(book, VCARD('includesGroup'))
  const strings = new Set(groups.map(group => normalizeGroupUri(group.uri))) // remove dups with normalized URIs
  groups = [...strings].map(uri => kb.sym(uri))
  log(logSpace, '' + groups.length + ' total groups. ')

  for (let i = 0; i < groups.length; i++) {
    const g = groups[i]
    const a = groupMembers(kb, g)

    log(logSpace, UI.utils.label(g) + ': ' + a.length + ' members')
    for (let j = 0; j < a.length; j++) {
      kb.allAliases(a[j]).forEach(function (y) {
        reverseIndex[y.uri] = g
      })
    }
  }

  const cards = kb.each(undefined, VCARD('inAddressBook'), book)
  log(logSpace, '' + cards.length + ' total contatcs')
  for (let c = 0; c < cards.length; c++) {
    if (!reverseIndex[cards[c].uri]) {
      groupless.push(cards[c])
      log(logSpace, '   groupless ' + UI.utils.label(cards[c]))
    }
  }
  log(logSpace, '' + groupless.length + ' groupless contacts.')
  return groupless
}

async function fixToOldDataModel (book) {
  async function updateToOldDataModel (groups) {
    let ds = []
    let ins = []
    groups.forEach(group => {
      let vcardOrWebids = kb.statementsMatching(null, ns.owl('sameAs'), null, group.doc()).map(st => st.subject)
      const strings = new Set(vcardOrWebids.map(contact => contact.uri)) // remove dups
      vcardOrWebids = [...strings].map(uri => kb.sym(uri))
      vcardOrWebids.forEach(item => {
        if (!kb.each(item, ns.vcard('fn'), null, group.doc()).length) {
          // delete item this is a new data model,  item is a webid not a card.
          ds = ds.concat(kb
            .statementsMatching(item, ns.owl('sameAs'), null, group.doc())
            .concat(kb.statementsMatching(undefined, undefined, item, group.doc())))
          // add webid card to group
          const cards = kb.each(item, ns.owl('sameAs'), null, group.doc())
          cards.forEach(card => {
            ins = ins.concat($rdf.st(card, ns.owl('sameAs'), item, group.doc()))
              .concat($rdf.st(group, ns.vcard('hasMember'), card, group.doc()))
          })
        }
      })
    })
    if (ds.length) {
      const dom = logSpace.ownerDocument
      return new Promise(function (resolve) {
        const msg = dom.createElement('p')
        msg.textContent = 'Groups can be updated to old data model?'
        logSpace.appendChild(msg)
        const confirmButton = UI.widgets.continueButton(dom, async function () {
          msg.remove()
          confirmButton.remove()
          await kb.updater.updateMany(ds, ins)
          log(logSpace, 'Update done')
          resolve()
        })
        logSpace.appendChild(confirmButton)
      })
    } else {
      log(logSpace, 'Nothing to update.\nAll groups already use the old data model.')
    }
  }
  let groups = kb.each(book, VCARD('includesGroup'))
  const strings = new Set(groups.map(group => normalizeGroupUri(group.uri))) // remove dups with normalized URIs
  groups = [...strings].map(uri => kb.sym(uri))
  updateToOldDataModel(groups)
}
