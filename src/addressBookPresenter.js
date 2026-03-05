import { addPersonToGroup, groupMembers, getDataModelIssues } from './contactLogic'
import * as UI from 'solid-ui'
import { store } from 'solid-logic'
import * as debug from './debug'
import { complain, complainIfBad, getSameAs, deleteRecursive, deleteThingAndDoc, compareForSort, nameFor } from './localUtils'
import { groupMembership } from './groupMembershipControl'

const ns = UI.ns
const utils = UI.utils
const kb = store
let dom
let selectedGroups = {}
let selectedPeople = {}
let ulPeople = null
let ulGroups = null
let searchInput = null
let cardMain = null
let book = null
let div = null
let dataBrowserContext = null
let onGroupButtonClick = null

// ######## Group presenter

export function setActiveGroupButton (groupsUl, activeBtn) {
  groupsUl.querySelectorAll('button').forEach(btn => {
    btn.classList.remove('btn-primary', 'allGroupsButton--selected', 'allGroupsButton--active', 'allGroupsButton--loaded')
    btn.classList.add('btn-secondary')
  })
  if (activeBtn) {
    activeBtn.classList.remove('btn-secondary')
    activeBtn.classList.add('btn-primary')
  }
}

export function renderGroupButtons (currentBook, groupsUl, options, domElement, groupsSelected, peopleUl, searchEl, cardMainEl, divEl, context, groupClickCallback) {
  dom = domElement
  selectedGroups = groupsSelected || {}
  if (peopleUl) ulPeople = peopleUl
  if (searchEl) searchInput = searchEl
  if (cardMainEl) cardMain = cardMainEl
  if (divEl) div = divEl
  if (context) dataBrowserContext = context
  if (groupClickCallback) onGroupButtonClick = groupClickCallback
  book = currentBook
  ulGroups = groupsUl
  const groups = groupsInOrder(book, options)
  utils.syncTableToArrayReOrdered(ulGroups, groups, renderGroupLi)
}

function renderGroupLi (group) {
  async function handleURIsDroppedOnGroup (uris) {
    uris.forEach(function (u) {
      debug.log('Dropped on group: ' + u)
      const thing = kb.sym(u)
      try {
        addPersonToGroup(thing, group)
      } catch (e) {
        complain(e)
      }
      refreshNames(ulPeople)
    })
  }
  function groupLiClickListener (event) {
    event.preventDefault()
    setActiveGroupButton(ulGroups, groupButton)
    if (onGroupButtonClick) onGroupButtonClick()
    if (!event.metaKey) {
      for (const key in selectedGroups) delete selectedGroups[key] // If Command key pressed, accumulate multiple
    }
    selectedGroups[group.uri] = !selectedGroups[group.uri]
    refreshThingsSelected(ulGroups, selectedGroups)
    // Load group members and refresh people list
    kb.fetcher.nowOrWhenFetched(group.doc(), undefined, function (ok, _message) {
      if (ok) {
        refreshNames(ulPeople, null, false)
      }
    })
  }

  // Body of renderGroupUl
  const name = kb.any(group, ns.vcard('fn'))
  const groupLi = dom.createElement('li')
  groupLi.setAttribute('role', 'listitem')
  groupLi.setAttribute('tabindex', '0')
  groupLi.setAttribute('aria-label', name ? name.value : 'Some group')
  groupLi.subject = group
  UI.widgets.makeDraggable(groupLi, group)

  const groupButton = groupLi.appendChild(dom.createElement('button'))
  groupButton.setAttribute('type', 'button')
  groupButton.innerHTML = name ? name.value : 'Some group'
  groupButton.classList.add('allGroupsButton', 'actionButton', 'btn-secondary', 'action-button-focus')
  groupButton.addEventListener(
    'click', groupLiClickListener,
    false
  )

  UI.widgets.makeDropTarget(groupLi, handleURIsDroppedOnGroup)
  groupLi.addEventListener('click', groupLiClickListener, true)
  return groupLi
} // renderGroupLi

export function selectAllGroups (
  selectedGroups,
  ulGroups,
  callbackFunction
) {
  function fetchGroupAndSelect (group, groupLi) {
    groupLi.classList.add('group-loading')
    kb.fetcher.nowOrWhenFetched(group.doc(), undefined, function (
      ok,
      message
    ) {
      if (!ok) {
        const msg = 'Can\'t load group file: ' + group + ': ' + message
        badness.push(msg)
        return complainIfBad(div, dom, ok, msg)
      }
      groupLi.classList.remove('group-loading')
      groupLi.classList.add('selected')
      selectedGroups[group.uri] = true
      refreshThingsSelected(ulGroups, selectedGroups)
      refreshNames(ulPeople, null) // @@ every time??
      todo -= 1
      if (!todo) {
        if (callbackFunction) { callbackFunction(badness.length === 0, badness) }
      }
    })
  }

  let todo = 0
  var badness = [] /* eslint-disable-line no-var */
  for (let k = 0; k < ulGroups.children.length; k++) {
    const groupLi = ulGroups.children[k]
    const group = groupLi.subject
    if (!group) continue // Skip non-group items (e.g. All contacts, New group)
    todo++
    fetchGroupAndSelect(group, groupLi)
  } // for each row
  if (todo === 0 && callbackFunction) { callbackFunction(true, badness) }
}

export function refreshThingsSelected (ul, selectionArray) {
  for (let i = 0; i < ul.children.length; i++) {
    const li = ul.children[i]
    if (li.subject) {
      li.classList.toggle('selected', !!selectionArray[li.subject.uri])
    }
  }
}

export function syncGroupUl (book, options, groupsUl, domElement, groupsSelected, peopleUl, searchEl) {
  dom = domElement
  if (groupsSelected) selectedGroups = groupsSelected
  if (peopleUl) ulPeople = peopleUl
  if (searchEl) searchInput = searchEl
  ulGroups = groupsUl
  const groups = groupsInOrder(book, options)
  if (groups.length > 0) {
    renderGroupLi(groups[0]) // pre-render one to get the style right, then throw it away
  }
  utils.syncTableToArrayReOrdered(groupsUl, groups, renderGroupLi)
  // refreshThingsSelected(groupsUl, selectedGroups)
}

function groupsInOrder (book, options) {
  let sortMe = []
  if (options.foreignGroup) {
    sortMe.push([
      '',
      kb.any(options.foreignGroup, ns.vcard('fn')),
      options.foreignGroup
    ])
  }
  if (book) {
    const groupIndex = kb.any(book, ns.vcard('groupIndex'))
    const gs = book ? kb.each(book, ns.vcard('includesGroup'), null, groupIndex) : []
    const gs2 = gs.map(function (g) {
      return [book, kb.any(g, ns.vcard('fn')), g]
    })
    sortMe = sortMe.concat(gs2)
    sortMe.sort()
  }
  return sortMe.map(tuple => tuple[2])
}

export async function loadAllGroups (book) {
  const groupIndex = kb.any(book, ns.vcard('groupIndex'))
  await kb.fetcher.load(groupIndex)
  const gs = book ? kb.each(book, ns.vcard('includesGroup'), null, groupIndex) : []
  await kb.fetcher.load(gs)
  return gs
}

// The book could be the main subject, or linked from a group we are dealing with
export function findBookFromGroups (book) {
  if (book) {
    return book
  }
  let g
  for (const gu in selectedGroups) {
    g = kb.sym(gu)
    const b = kb.any(undefined, ns.vcard('includesGroup'), g)
    if (b) return b
  }
  throw new Error(
    'findBookFromGroups: Cant find address book which this group is part of'
  )
}
// ######## Group presenter - END

// ######## Person presenter
/** Refresh the list of names */
export function refreshNames (ulPeople, detailsView, autoSelect = true) {
  function setPersonListener (personLi, person) {
    personLi.addEventListener('click', function (event) {
      event.preventDefault()
      selectPerson(ulPeople, person, cardMain)
    })
  }

  let cards = []
  const groups = Object.keys(selectedGroups).map(groupURI => kb.sym(groupURI))
  groups.forEach(group => {
    if (selectedGroups[group.value]) {
      cards = cards.concat(groupMembers(kb, group))
    }
  })
  cards.sort(compareForSort) // @@ sort by name not UID later
  for (let k = 0; k < cards.length - 1;) {
    if (cards[k].uri === cards[k + 1].uri) {
      cards.splice(k, 1) // Eliminate duplicates from more than one group
    } else {
      k++
    }
  }

  function renderNameInGroupList (person, ulPeople) {
    const personLi = dom.createElement('li')
    personLi.setAttribute('role', 'listitem')
    personLi.setAttribute('tabindex', '0')
    personLi.classList.add('personLi')
    personLi.subject = person
    UI.widgets.makeDraggable(personLi, person)

    // Container for the row
    const rowDiv = dom.createElement('div')
    rowDiv.classList.add('personLi-row')

    // Left: Avatar
    const avatarDiv = dom.createElement('div')
    avatarDiv.classList.add('personLi-avatar')
    // Placeholder avatar (shown initially while person doc loads)
    const placeholderEl = dom.createElement('div')
    placeholderEl.classList.add('avatar-placeholder')
    placeholderEl.innerHTML = '<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="18" cy="18" r="18" fill="#e0e0e0"/><text x="50%" y="58%" text-anchor="middle" fill="#888" font-size="16" font-family="Arial" dy=".3em">?</text></svg>'
    avatarDiv.appendChild(placeholderEl)

    // Try to set avatar from already-loaded data, or fetch the person's doc
    function trySetAvatar () {
      const avatarUrl = kb.any(person, ns.vcard('hasPhoto'))
      if (avatarUrl && avatarUrl.value) {
        const img = dom.createElement('img')
        img.src = avatarUrl.value
        img.alt = 'Avatar'
        avatarDiv.replaceChild(img, avatarDiv.firstChild)
      }
    }
    trySetAvatar() // check if already in store
    // Load person's own document in background to get hasPhoto
    kb.fetcher.nowOrWhenFetched(person.doc(), undefined, function (ok) {
      if (ok) trySetAvatar()
    })

    // Center: Name
    const infoDiv = dom.createElement('div')
    infoDiv.classList.add('personLi-info')

    const name = nameFor(person) || 'Unknown Name'
    personLi.setAttribute('aria-label', name)
    const nameDiv = dom.createElement('div')
    nameDiv.classList.add('personLi-name')
    nameDiv.textContent = name

    infoDiv.appendChild(nameDiv)

    // Right: Arrow icon
    const arrowDiv = dom.createElement('div')
    arrowDiv.classList.add('personLi-arrow')
    arrowDiv.innerHTML = '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 4.5L11.25 9L6 13.5" stroke="#888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'

    // Assemble
    rowDiv.appendChild(avatarDiv)
    rowDiv.appendChild(infoDiv)
    rowDiv.appendChild(arrowDiv)
    personLi.appendChild(rowDiv)

    setPersonListener(personLi, person)
    return personLi
  }

  utils.syncTableToArrayReOrdered(ulPeople, cards, person => renderNameInGroupList(person, ulPeople))
  refreshFilteredPeople(ulPeople, autoSelect, detailsView || cardMain)
} // refreshNames

function selectPerson (ulPeople, person, detailsView) {
  if (!detailsView) return
  if (detailsView.parentNode) detailsView.parentNode.classList.remove('hidden')
  detailsView.innerHTML = 'Loading...'
  selectedPeople = {}
  selectedPeople[person.uri] = true
  refreshFilteredPeople(ulPeople, false, detailsView) // Color to remember which one you picked
  const local = book ? localNode(person) : person
  kb.fetcher.nowOrWhenFetched(local.doc(), undefined, function (
    ok,
    message
  ) {
    detailsView.innerHTML = ''
    if (!ok) {
      return complainIfBad(div, dom, ok, 'Can\'t load card: ' + local + ': ' + message)
    }
    // debug.log("Loaded card " + local + '\n')

    // Top-right toolbar with link icon and delete button
    const toolbar = dom.createElement('div')
    toolbar.classList.add('contact-toolbar')
    const linkEl = UI.widgets.linkIcon(dom, local)
    linkEl.setAttribute('title', 'Uri of contact')
    toolbar.appendChild(linkEl)

    // Add in a delete button to delete from AB
    const deleteButton = UI.widgets.deleteButtonWithCheck(
      dom,
      detailsView,
      'contact',
      async function () {
        const container = person.dir() // ASSUMPTION THAT CARD IS IN ITS OWN DIRECTORY
        // alert('Container to delete is ' + container)
        const pname = kb.any(person, ns.vcard('fn'))
        if (confirm('Delete contact ' + pname + ' completely?? ' + container)) {
          debug.log('Deleting a contact ' + pname)
          await loadAllGroups() // need to wait for all groups to be loaded in case they have a link to this person
          // load people.ttl
          const nameEmailIndex = kb.any(book, ns.vcard('nameEmailIndex'))
          await kb.fetcher.load(nameEmailIndex)

          //  - delete person's WebID's in each Group
          //  - delete the references to it in group files and save them back
          //  - delete the reference in people.ttl and save it back

          // find all Groups
          const groups = groupMembership(person)
          let removeFromGroups = []
          // find person WebID's
          groups.forEach(group => {
            const webids = getSameAs(kb, person, group.doc())
            // for each check in each Group that it is not used by an other person then delete
            webids.forEach(webid => {
              if (getSameAs(kb, webid, group.doc()).length === 1) {
                removeFromGroups = removeFromGroups.concat(kb.statementsMatching(group, ns.vcard('hasMember'), webid, group.doc()))
              }
            })
          })
          // debug.log(removeFromGroups)
          await kb.updater.updateMany(removeFromGroups)
          await deleteThingAndDoc(person)
          await deleteRecursive(kb, container)
          refreshNames(ulPeople, person) // "Doesn't work" -- maybe does now with waiting for async
          detailsView.innerHTML = 'Contact data deleted.'
        }
      }
    )
    deleteButton.classList.add('deleteButton')
    toolbar.appendChild(deleteButton)
    detailsView.appendChild(toolbar)

    detailsView.appendChild(renderPane(local, 'contact'))
  })
}

export function refreshFilteredPeople (ulPeople, active, detailsView) {
  let count = 0
  let lastRow = null
  for (let i = 0; i < ulPeople.children.length; i++) {
    const liElement = ulPeople.children[i]
    const matches = filterName(nameFor(liElement.subject))
    if (matches) {
      count++
      lastRow = liElement
    }
    liElement.classList.toggle('selected', matches && !!selectedPeople[liElement.subject.uri])
    liElement.classList.toggle('hidden', !matches)
  }
  if (count === 1 && active) {
    const unique = lastRow.subject
    selectPerson(ulPeople, unique, detailsView)
  }
}

function filterName (name) {
  const filter = searchInput.value.trim().toLowerCase()
  if (filter.length === 0) return true
  const parts = filter.split(' ') // Each name part must be somewhere
  for (let j = 0; j < parts.length; j++) {
    const word = parts[j]
    if (name.toLowerCase().indexOf(word) < 0) return false
  }
  return true
}

function renderPane (subject, paneName) {
  const p = dataBrowserContext.session.paneRegistry.byName(paneName)
  const d = p.render(subject, dataBrowserContext)
  d.classList.add('renderPane')
  return d
}

function localNode (person) {
  const aliases = kb.allAliases(person)
  const prefix = book.dir().uri
  for (let i = 0; i < aliases.length; i++) {
    if (aliases[i].uri.slice(0, prefix.length) === prefix) {
      return aliases[i]
    }
  }
  throw new Error('No local URI for ' + person)
}

// Check every group is in the list and add it if not.
export async function checkDataModel (book) {
  // await kb.fetcher.load(groups) // asssume loaded already
  const groups = await loadAllGroups(book)

  const { del, ins } = await getDataModelIssues(groups)

  if (del.length && confirm(`Groups data model need to be updated? (${del.length})`)) {
    await kb.updater.updateMany(del, ins)
    alert('Update done')
  }
}

// Prepare book data once so askName forms load instantly
export async function ensureBookLoaded () {
  const ourBook = findBookFromGroups(book)
  try {
    await kb.fetcher.load(ourBook)
  } catch (err) {
    throw new Error('Book won\'t load:' + ourBook)
  }
  const nameEmailIndex = kb.any(ourBook, ns.vcard('nameEmailIndex'))
  if (!nameEmailIndex) throw new Error('No nameEmailIndex')
  await kb.fetcher.load(nameEmailIndex)
}
