/*   Contact AddressBook Pane
**
**  This outline pane allows a user to interact with a contact,
to change its state according to an ontology, comment on it, etc.
**
** See also things like
**  http://www.w3.org/TR/vcard-rdf/
**  http://tools.ietf.org/html/rfc6350
**  http://www.iana.org/assignments/vcard-elements/vcard-elements.xhtml
**
*/

import { authn } from 'solid-logic'
import { saveNewContact, saveNewGroup } from './contactLogic'
import * as UI from 'solid-ui'
import { mintNewAddressBook } from './mintNewAddressBook'
import { renderIndividual } from './individual'
import { toolsPane } from './toolsPane'
import './styles/contactsPane.css'
import {
  checkDataModel, ensureBookLoaded, renderGroupButtons,
  refreshThingsSelected, refreshNames, selectAllGroups, loadAllGroups,
  syncGroupUl, setActiveGroupButton, createGroupLi, refreshFilteredPeople,
  deselectAllPeople, handleURIsDroppedOnGroup
} from './addressBookPresenter'
import { alertDialog, complain, deleteThingAndDoc, setDom } from './localUtils'
import * as debug from './debug'
import './styles/rdfFormsEnforced.css'

const ns = UI.ns
const utils = UI.utils

export default {
  icon: UI.icons.iconBase + 'noun_99101.svg', // changed from embedded icon 2016-05-01

  name: 'contact',

  // Does the subject deserve a contact pane?
  label: function (subject, context) {
    const t = context.session.store.findTypeURIs(subject)
    if (t[ns.vcard('Individual').uri]) return 'Contact'
    if (t[ns.vcard('Organization').uri]) return 'Contact'
    if (t[ns.foaf('Person').uri]) return 'Person'
    if (t[ns.schema('Person').uri]) return 'Person'
    if (t[ns.vcard('Group').uri]) return 'Group'
    if (t[ns.vcard('AddressBook').uri]) return 'Address book'
    return null // No, under other circumstances
  },

  mintClass: UI.ns.vcard('AddressBook'),

  mintNew: mintNewAddressBook, // Make a new address book

  //  Render the pane
  render: function (subject, dataBrowserContext, paneOptions = {}) {
    /*
    function newAddressBookButton (thisAddressBook) {
      return UI.login.newAppInstance(
        dom,
        { noun: 'address book', appPathSegment: 'contactorator.timbl.com' },
        function (ws, newBase) {
          thisPane.mintNew(thisAddressBook, newBase, {
            me,
            div,
            dom
          })
        }
      )
    } */

    const dom = dataBrowserContext.dom
    const kb = dataBrowserContext.session.store
    const div = dom.createElement('div')
    setDom(dom) // set dom for ana error handling in other modules

    UI.aclControl.preventBrowserDropEvents(dom) // protect drag and drop

    div.setAttribute('class', 'contactPane')

    asyncRender().then(
      () => debug.log('Contacts pane rendered for ' + subject),
      err => complain(div, dom, err.message || '' + err)
    )
    return div

    // Async part of render. Maybe API will later allow render to be async
    async function asyncRender () {
      UI.aclControl.preventBrowserDropEvents(dom)

      const t = kb.findTypeURIs(subject)

      // Render a single contact Individual
      if (
        t[ns.vcard('Individual').uri] ||
        t[ns.foaf('Person').uri] ||
        t[ns.schema('Person').uri] ||
        t[ns.vcard('Organization').uri] ||
        t[ns.schema('Organization').uri]
      ) {
        renderIndividual(dom, div, subject, dataBrowserContext)
          .then(() => debug.log('(individual rendered)'))
          .catch(() => {
            throw new Error('Failed to render contact.')
          })
      /*
        //          Render a Group instance
      }
        else if (t[ns.vcard('Group').uri]) {
        // If we have a main address book, then render this group as a guest group within it
        UI.login
          .findAppInstances(context, ns.vcard('AddressBook'))
          .then(function (context) {
            const addressBooks = context.instances
            const options = { foreignGroup: subject }
            if (addressBooks.length > 0) {
              // const book = addressBooks[0]
              renderAddressBook(addressBooks, options)
            } else {
              renderAddressBook([], options)
              // @@ button to Make a new addressBook
            }
          })
          .catch(function (e) {
            complain(div, dom, '' + e)
          })
        */
      // Render a AddressBook instance
      } else if (t[ns.vcard('AddressBook').uri]) {
        renderAddressBook([subject], {})
      } else {
        debug.error('No evidence that ' + subject + ' is anything to do with contacts.')
        throw new Error('This does not seem to be a contact or address book.')
      }

      let me = authn.currentUser()

      //  Render AddressBook instance
      function renderAddressBook (books, options) {
        kb.fetcher
          .load(books)
          .then(function (_xhr) {
            renderAddressBookDetails(books, options)
          })
          .catch(function (err) {
            debug.error('Error loading address book. Stack: ' + err)
            throw new Error('Failed to load address book.')
          })
      }

      function renderAddressBookDetails (books, options) {
        const classLabel = utils.label(ns.vcard('AddressBook'))

        let book = options.foreignGroup // in case we have only a Grouo
        let title = ''
        if (books && books.length > 0) {
          book = books[0] // if we have an Address Book, we prefer this
          title = utils.label(book.dir())
        } else {
          kb.any(book, ns.dc('title')) || kb.any(book, ns.vcard('fn'))
          if (paneOptions.solo && title && typeof document !== 'undefined') {
            document.title = title.value // @@ only when the outermmost pane
          }
          title = title ? title.value : classLabel
        }

        const groupIndex = kb.any(book, ns.vcard('groupIndex'))
        const selectedGroups = {}
        let selectedPeople = {} // Actually prob max 1

        let allGroupsLi = null
        let newGroupLi = null

        // Centralized active-button tracking across all action buttons
        const actionButtons = []
        function setActiveActionButton (activeBtn) {
          actionButtons.forEach(btn => {
            btn.classList.remove('btn-primary')
            btn.classList.add('btn-secondary')
          })
          if (activeBtn) {
            activeBtn.classList.remove('btn-secondary')
            activeBtn.classList.add('btn-primary')
          }
        }

        // Shared context passed to all builder functions
        const ctx = {
          dom,
          kb,
          ns,
          book,
          options,
          title,
          groupIndex,
          selectedGroups,
          get selectedPeople () { return selectedPeople },
          set selectedPeople (v) { selectedPeople = v },
          get allGroupsLi () { return allGroupsLi },
          set allGroupsLi (v) { allGroupsLi = v },
          get newGroupLi () { return newGroupLi },
          set newGroupLi (v) { newGroupLi = v },
          actionButtons,
          setActiveActionButton,
          dataBrowserContext,
          div,
          me,
          setMe (v) { me = v },
          paneOptions,
        }

        // ── Build layout ────────────────────────────────────────────
        const { main, addressBookSection, detailsSection } = buildMainLayout(ctx)
        div.appendChild(main)

        function showDetailsSection () {
          detailsSection.classList.remove('hidden')
        }
        ctx.showDetailsSection = showDetailsSection
        ctx.detailsSection = detailsSection

        // Create shared DOM elements needed by multiple builders
        const ulPeople = dom.createElement('ul')
        ulPeople.setAttribute('role', 'list')
        ulPeople.setAttribute('aria-label', 'People list')
        ctx.ulPeople = ulPeople
        // make the element available on the dataBrowserContext too; other
        // modules (individual/group membership) look for this property when
        // they need to refresh the master list after a mutation.
        if (ctx.dataBrowserContext) ctx.dataBrowserContext.ulPeople = ulPeople

        const detailsSectionContent = dom.createElement('div')
        detailsSectionContent.classList.add('detailsSectionContent')
        detailsSectionContent.setAttribute('role', 'region')
        detailsSectionContent.setAttribute('aria-labelledby', 'detailsSectionContent')
        detailsSectionContent.setAttribute('aria-live', 'polite')
        ctx.detailsSectionContent = detailsSectionContent

        // ── Header (title + New Contact button) ─────────────────────
        const headerSection = buildHeaderSection(ctx)
        addressBookSection.appendChild(headerSection)

        const dottedHr = dom.createElement('hr')
        dottedHr.classList.add('dottedHr')
        addressBookSection.appendChild(dottedHr)

        // ── Search ──────────────────────────────────────────────────
        const { searchSection, searchInput } = buildSearchSection(ctx)
        ctx.searchInput = searchInput
        addressBookSection.appendChild(searchSection)

        // ── Group bar ───────────────────────────────────────────────
        const { buttonSection, ulGroups } = buildGroupBar(ctx)
        ctx.ulGroups = ulGroups
        addressBookSection.appendChild(buttonSection)

        // ── People list ─────────────────────────────────────────────
        const peopleListSection = dom.createElement('section')
        peopleListSection.classList.add('peopleSection')
        addressBookSection.appendChild(peopleListSection)
        peopleListSection.appendChild(ulPeople)

        // ── Details content section ─────────────────────────────────
        detailsSection.appendChild(detailsSectionContent)

        // ── Footer buttons ──────────────────────────────────────────
        const cardFooter = buildFooterButtons(ctx)
        addressBookSection.appendChild(cardFooter)

        checkDataModel(book, detailsSectionContent).then(() => { debug.log('async checkDataModel done.') })
      }

      // /////////////// Fix user when testing on a plane

      if (
        typeof document !== 'undefined' &&
        document.location &&
        ('' + document.location).slice(0, 16) === 'http://localhost'
      ) {
        me = kb.any(subject, UI.ns.acl('owner')) // when testing on plane with no webid
        debug.log('Assuming user is ' + me)
      }

      return div
    } // asyncRender
  } // render function
} // pane object

// ── Helper: handle "New group" button click ──────────────────────────
async function handleNewGroupClick (ctx) {
  const { dom, kb, ns, book, options, selectedGroups, dataBrowserContext } = ctx
  ctx.showDetailsSection()
  ctx.detailsSectionContent.innerHTML = ''
  const groupIndex = kb.any(book, ns.vcard('groupIndex'))
  try {
    await kb.fetcher.load(groupIndex)
  } catch (e) {
    debug.log('Error: Group index  NOT loaded:' + e + '\n')
  }
  debug.log(' Group index has been loaded\n')

  const name = await UI.widgets.askName(
    dom, kb, ctx.detailsSectionContent, UI.ns.foaf('name'), ns.vcard('Group'), 'group')
  if (!name) return // cancelled by user
  let group
  try {
    group = await saveNewGroup(book, name)
  } catch (err) {
    debug.log('Error: can\'t save new group:' + err)
    ctx.detailsSectionContent.innerHTML = 'Failed to save group' + err
    return
  }
  for (const key in selectedGroups) delete selectedGroups[key]
  selectedGroups[group.uri] = true

  // Refresh the group buttons list
  const allGroupsLi = ctx.allGroupsLi
  const newGroupLi = ctx.newGroupLi
  if (allGroupsLi.parentNode) allGroupsLi.parentNode.removeChild(allGroupsLi)
  if (newGroupLi.parentNode) newGroupLi.parentNode.removeChild(newGroupLi)
  syncGroupUl(book, options, ctx.ulGroups, dom, selectedGroups, ctx.ulPeople, ctx.searchInput)
  ctx.ulGroups.insertBefore(allGroupsLi, ctx.ulGroups.firstChild)
  ctx.ulGroups.appendChild(newGroupLi)
  refreshThingsSelected(ctx.ulGroups, selectedGroups)
  // Highlight the new group button in ulGroups and show empty people list
  const matchingLi = Array.from(ctx.ulGroups.children).find(li => li.subject && li.subject.uri === group.uri)
  setActiveGroupButton(ctx.ulGroups, matchingLi ? matchingLi.querySelector('button') : null)
  refreshNames(ctx.ulPeople, null, false)

  ctx.detailsSectionContent.innerHTML = ''
  ctx.detailsSectionContent.appendChild(UI.aclControl.ACLControlBox5(
    group.doc(), dataBrowserContext, 'group', kb,
    function (ok, body) {
      if (!ok) {
        ctx.detailsSectionContent.innerHTML =
            'Group sharing setup failed: ' + body
      }
    }))
}

// ── Helper: render askName form for person or organization ───────────
function createNewPersonOrOrganization (ctx, formContainer, klass) {
  const { dom, kb, book, selectedGroups, dataBrowserContext } = ctx
  formContainer.innerHTML = ''
  UI.widgets
    .askName(dom, kb, formContainer, UI.ns.foaf('name'), klass)
    .then(async (name) => {
      if (!name) return // cancelled by user
      ctx.detailsSectionContent.innerHTML = 'Indexing...'
      let person
      try {
        person = await saveNewContact(book, name, selectedGroups, klass)
      } catch (err) {
        const msg = 'Error saving contact. If it persists, contact your admin.'
        alertDialog(msg)
        return
      }
      // It’s possible `saveNewContact` returned `undefined` when no group was
      // selected.  In that case we already alerted the user and nothing more
      // should happen.
      if (!person) {
        ctx.detailsSectionContent.innerHTML = ''
        return
      }
      ctx.selectedPeople = {}
      ctx.selectedPeople[person.uri] = true
      refreshNames(ctx.ulPeople, null) // Add name to list of group
      ctx.detailsSectionContent.innerHTML = '' // Clear 'indexing'
      ctx.detailsSectionContent.classList.add('detailsSectionContent--wide')
      const contactPane = dataBrowserContext.session.paneRegistry.byName('contact')
      const paneDiv = contactPane.render(person, dataBrowserContext)
      paneDiv.classList.add('renderPane')
      ctx.detailsSectionContent.appendChild(paneDiv)
    })
}

// ── Builder: main layout skeleton ────────────────────────────────────
function buildMainLayout (ctx) {
  const { dom } = ctx
  const main = dom.createElement('main')
  main.id = 'main-content'
  main.classList.add('addressBook-grid')
  main.setAttribute('role', 'main')
  main.setAttribute('aria-label', 'Address Book')
  main.setAttribute('tabindex', '-1')

  const addressBookSection = dom.createElement('section')
  addressBookSection.setAttribute('aria-labelledby', 'addressBook-section')
  addressBookSection.classList.add('addressBookSection', 'section-bg')
  addressBookSection.setAttribute('role', 'region')
  addressBookSection.setAttribute('tabindex', '-1')
  main.appendChild(addressBookSection)

  const detailsSection = dom.createElement('section')
  detailsSection.classList.add('detailSection')
  detailsSection.setAttribute('role', 'region')
  detailsSection.setAttribute('aria-label', 'Details section')
  detailsSection.classList.add('hidden')
  main.appendChild(detailsSection)

  return { main, addressBookSection, detailsSection }
}

// ── Builder: header with title and New Contact button ────────────────
function buildHeaderSection (ctx) {
  const { dom, ns, title, me, setMe, setActiveActionButton } = ctx

  const headerSection = dom.createElement('section')
  headerSection.classList.add('headerSection')

  const header = dom.createElement('header')
  header.classList.add('mb-md')
  const h2 = dom.createElement('h2')
  h2.id = 'addressBook-heading'
  h2.setAttribute('tabindex', '-1')
  h2.textContent = title

  // New Contact button
  const newContactButton = dom.createElement('button')
  const container = dom.createElement('div')
  newContactButton.setAttribute('type', 'button')
  if (!me) newContactButton.setAttribute('disabled', 'true')
  authn.checkUser().then(webId => {
    if (webId) {
      setMe(webId)
      newContactButton.removeAttribute('disabled')
    }
  })
  container.appendChild(newContactButton)
  newContactButton.innerHTML = '+ New contact'
  newContactButton.classList.add('actionButton', 'btn-primary', 'action-button-focus')
  let newContactClickGeneration = 0
  newContactButton.addEventListener('click', async function (_event) {
    setActiveActionButton(null)
    deselectAllPeople(ctx.ulPeople)
    const thisGeneration = ++newContactClickGeneration
    ctx.showDetailsSection()
    ctx.detailsSectionContent.innerHTML = ''
    ctx.detailsSectionContent.classList.remove('detailsSectionContent--wide')
    await ensureBookLoaded()
    // Bail out if a newer click has taken over
    if (thisGeneration !== newContactClickGeneration) return
    ctx.detailsSectionContent.innerHTML = ''

    const chooserDiv = dom.createElement('div')
    chooserDiv.classList.add('contactTypeChooser')

    const selectLabel = dom.createElement('label')
    selectLabel.textContent = 'Contact type: '
    selectLabel.setAttribute('for', 'contactTypeSelect')
    chooserDiv.appendChild(selectLabel)

    const select = dom.createElement('select')
    select.id = 'contactTypeSelect'
    select.classList.add('contactTypeSelect')
    const optIndividual = dom.createElement('option')
    optIndividual.value = 'Individual'
    optIndividual.textContent = 'New person'
    select.appendChild(optIndividual)
    const optOrganization = dom.createElement('option')
    optOrganization.value = 'Organization'
    optOrganization.textContent = 'New organization'
    select.appendChild(optOrganization)
    chooserDiv.appendChild(select)

    ctx.detailsSectionContent.appendChild(chooserDiv)

    const remark = dom.createElement('p')
    remark.classList.add('contactCreationRemark')
    remark.textContent = 'The new contact is added to the already selected group.'
    ctx.detailsSectionContent.appendChild(remark)

    // Container for the askName form, placed below the select
    const formContainer = dom.createElement('div')
    formContainer.classList.add('contactFormContainer')
    ctx.detailsSectionContent.appendChild(formContainer)

    function currentKlass () {
      return select.value === 'Organization'
        ? ns.vcard('Organization')
        : ns.vcard('Individual')
    }

    // Render person form immediately as default
    createNewPersonOrOrganization(ctx, formContainer, currentKlass())

    // Switch form when dropdown changes
    select.addEventListener('change', function () {
      createNewPersonOrOrganization(ctx, formContainer, currentKlass())
    })
  }, false)

  // TODO we should also add if it is public or private
  header.appendChild(h2)
  header.appendChild(container)
  headerSection.appendChild(header)
  return headerSection
}

// ── Builder: search input section ────────────────────────────────────
function buildSearchSection (ctx) {
  const { dom } = ctx
  const searchSection = dom.createElement('section')
  searchSection.classList.add('searchSection')
  const searchDiv = dom.createElement('div')
  searchDiv.classList.add('searchDiv')
  // container for input + clear button
  searchSection.appendChild(searchDiv)
  const searchInput = dom.createElement('input')
  searchInput.setAttribute('type', 'text')
  searchInput.setAttribute('aria-label', 'Search contacts')
  searchInput.classList.add('searchInput')
  searchInput.setAttribute('placeholder', 'Search by name in selected group')
  searchDiv.appendChild(searchInput)

  // clear button that appears when there is text
  const clearBtn = dom.createElement('button')
  clearBtn.setAttribute('type', 'button')
  clearBtn.setAttribute('aria-label', 'Clear search')
  clearBtn.classList.add('searchClearButton', 'hidden')
  clearBtn.textContent = '\u2715' // multiplication sign ×
  searchDiv.appendChild(clearBtn)

  searchInput.addEventListener('input', function (_event) {
    const hasText = searchInput.value.length > 0
    // show/hide using the shared "hidden" utility class instead of direct
    // style manipulation
    clearBtn.classList.toggle('hidden', !hasText)
    refreshFilteredPeople(ctx.ulPeople, true, ctx.detailsSectionContent)
  })

  clearBtn.addEventListener('click', function () {
    searchInput.value = ''
    clearBtn.classList.add('hidden')
    searchInput.focus()
    refreshFilteredPeople(ctx.ulPeople, true, ctx.detailsSectionContent)
  })

  return { searchSection, searchInput }
}

// ── Builder: group buttons bar ───────────────────────────────────────
function buildGroupBar (ctx) {
  const {
    dom, kb, book, options, groupIndex, selectedGroups,
    actionButtons, setActiveActionButton
  } = ctx

  const buttonSection = dom.createElement('section')
  buttonSection.classList.add('buttonSection')

  const ulGroups = dom.createElement('ul')
  ulGroups.classList.add('groupButtonsList')
  ulGroups.setAttribute('role', 'list')
  ulGroups.setAttribute('aria-label', 'Groups list')

  if (options.foreignGroup) {
    selectedGroups[options.foreignGroup.uri] = true
  }

  if (book) {
    // All groups button — leftmost, initially selected
    ctx.allGroupsLi = dom.createElement('li')
    const allGroupsButton = dom.createElement('button')
    allGroupsButton.textContent = 'All groups'
    allGroupsButton.classList.add('allGroupsButton', 'actionButton', 'btn-primary', 'action-button-focus', 'allGroupsButton--selected')
    allGroupsButton.addEventListener('click', function (_event) {
      setActiveGroupButton(ulGroups, allGroupsButton)
      setActiveActionButton(null)
      // Check if all groups are currently selected
      const allSelected = Array.from(ulGroups.children).every(function (li) {
        if (!li.subject) return true // skip non-group items (All groups, New group)
        return !!selectedGroups[li.subject.uri]
      })

      if (!allSelected) {
        allGroupsButton.classList.add('allGroupsButton--loading')
        allGroupsButton.setAttribute('aria-busy', 'true')
        selectAllGroups(selectedGroups, ulGroups, function (ok, message) {
          if (!ok) return alertDialog('Failed to select all groups. If it persists, contact admin.')
          allGroupsButton.classList.remove('allGroupsButton--loading')
          allGroupsButton.setAttribute('aria-busy', 'false')
          allGroupsButton.classList.add('allGroupsButton--active')
          refreshThingsSelected(ulGroups, selectedGroups)
          refreshNames(ctx.ulPeople, null)
        })
      } else {
        allGroupsButton.classList.remove('allGroupsButton--loading', 'allGroupsButton--active')
        allGroupsButton.setAttribute('aria-busy', 'false')
        allGroupsButton.classList.add('allGroupsButton--loaded') // pale green hint groups loaded
        for (const key in selectedGroups) delete selectedGroups[key]
        refreshThingsSelected(ulGroups, selectedGroups)
      }
    }) // on button click
    ctx.allGroupsLi.appendChild(allGroupsButton)
    ulGroups.appendChild(ctx.allGroupsLi) // First item in the list

    // New group button — rightmost (appended after group buttons are rendered)
    ctx.newGroupLi = dom.createElement('li')
    const newGroupButton = dom.createElement('button')
    newGroupButton.setAttribute('type', 'button')
    newGroupButton.innerHTML = '+ New group'
    newGroupButton.classList.add('allGroupsButton', 'actionButton', 'btn-secondary', 'action-button-focus')
    actionButtons.push(newGroupButton)
    newGroupButton.addEventListener(
      'click', function (event) {
        setActiveGroupButton(ulGroups, newGroupButton)
        setActiveActionButton(null)
        deselectAllPeople(ctx.ulPeople)
        handleNewGroupClick(ctx)
      },
      false
    )
    ctx.newGroupLi.appendChild(newGroupButton)

    // Append ulGroups to buttonSection, then add New group at the end
    buttonSection.appendChild(ulGroups)

    if (groupIndex) {
      kb.fetcher.nowOrWhenFetched(groupIndex.uri, book, function (ok, body) {
        if (!ok) {
          debug.error('Error loading group index. Stack: ' + body)
          alertDialog('Error loading group index. If it persists, contact admin.')
          return
        }
        // Remove special items before sync (syncTableToArrayReOrdered expects .subject on all children)
        if (ctx.allGroupsLi.parentNode) ctx.allGroupsLi.parentNode.removeChild(ctx.allGroupsLi)
        if (ctx.newGroupLi.parentNode) ctx.newGroupLi.parentNode.removeChild(ctx.newGroupLi)
        syncGroupUl(book, options, ulGroups, dom, selectedGroups, ctx.ulPeople, ctx.searchInput) // Refresh list of groups
        ulGroups.insertBefore(ctx.allGroupsLi, ulGroups.firstChild) // Keep All contacts first
        ulGroups.appendChild(ctx.newGroupLi) // Keep New group last

        // Auto-select all groups and display all contacts on load
        allGroupsButton.classList.add('allGroupsButton--loading')
        allGroupsButton.setAttribute('aria-busy', 'true')
        selectAllGroups(selectedGroups, ulGroups, function (ok, message) {
          if (!ok) return alertDialog('Failed to select all groups. If it persists, contact admin.')
          allGroupsButton.classList.remove('allGroupsButton--loading')
          allGroupsButton.setAttribute('aria-busy', 'false')
          allGroupsButton.classList.add('allGroupsButton--active')
          refreshThingsSelected(ulGroups, selectedGroups)
          refreshNames(ctx.ulPeople, null)
        })
      })
    }

    // Remove special items before initial render too
    if (ctx.allGroupsLi.parentNode) ctx.allGroupsLi.parentNode.removeChild(ctx.allGroupsLi)
    if (ctx.newGroupLi.parentNode) ctx.newGroupLi.parentNode.removeChild(ctx.newGroupLi)
    renderGroupButtons(book, ulGroups, options, dom, selectedGroups, ctx.ulPeople, ctx.searchInput, ctx.detailsSectionContent, ctx.dataBrowserContext, function () {
      setActiveActionButton(null)
      // Keep the details section open when a contact or New contact form is showing
      if (!ctx.detailsSectionContent.querySelector('.contactTypeChooser, .contactFormContainer, .renderPane')) {
        ctx.detailsSectionContent.innerHTML = ''
        ctx.detailsSection.classList.add('hidden')
      }
    })
    ulGroups.insertBefore(ctx.allGroupsLi, ulGroups.firstChild) // Keep All contacts first
    ulGroups.appendChild(ctx.newGroupLi) // Ensure New group is last after initial render
  } else {
    syncGroupUl(book, options, ulGroups, dom, selectedGroups, ctx.ulPeople, ctx.searchInput) // Refresh list of groups (will be empty)
    refreshNames(ctx.ulPeople, null)
    debug.log('No book, only one group -> hide list of groups')
  } // if not book

  return { buttonSection, ulGroups }
}

// ── Builder: footer action buttons (Groups / Sharing / Tools) ────────
function buildFooterButtons (ctx) {
  const {
    dom, kb, ns, book, options, selectedGroups,
    actionButtons, setActiveActionButton, dataBrowserContext, div, me
  } = ctx

  const cardFooter = dom.createElement('div')
  cardFooter.classList.add('cardFooter')

  if (book) {
    // Groups button
    const groupsButton = cardFooter.appendChild(dom.createElement('button'))
    groupsButton.setAttribute('type', 'button')
    groupsButton.innerHTML = 'Groups'
    groupsButton.classList.add('actionButton', 'btn-secondary', 'action-button-focus')
    actionButtons.push(groupsButton)
    groupsButton.addEventListener('click', async function (_event) {
      setActiveActionButton(groupsButton)
      deselectAllPeople(ctx.ulPeople)
      ctx.showDetailsSection()
      ctx.detailsSectionContent.innerHTML = ''
      ctx.detailsSectionContent.classList.remove('detailsSectionContent--wide')

      // Header
      const groupsHeader = dom.createElement('h3')
      groupsHeader.textContent = 'Your groups'
      ctx.detailsSectionContent.appendChild(groupsHeader)

      let groupRemark = dom.createElement('p')
      groupRemark.textContent = 'When you delete a group it can happen that some contacts end up groupless.'
      ctx.detailsSectionContent.appendChild(groupRemark)

      groupRemark = dom.createElement('p')
      groupRemark.textContent = 'To move contacts around, simply drag and drop them onto a group.'
      ctx.detailsSectionContent.appendChild(groupRemark)

      // Load all groups and display them in a list
      let groups
      try {
        groups = await loadAllGroups(book)
      } catch (err) {
        ctx.detailsSectionContent.appendChild(dom.createTextNode('Failed to load groups: ' + err))
        return
      }

      const groupsList = dom.createElement('ul')
      groupsList.setAttribute('role', 'list')
      groupsList.setAttribute('aria-label', 'All groups')
      groupsList.classList.add('groupButtonsList')

      // Sort groups by name
      if (groups) {
        groups.sort((a, b) => {
          const nameA = (kb.any(a, ns.vcard('fn')) || '').toString().toLowerCase()
          const nameB = (kb.any(b, ns.vcard('fn')) || '').toString().toLowerCase()
          return nameA < nameB ? -1 : nameA > nameB ? 1 : 0
        })
        groups.forEach(function (group) {
          const { groupLi, groupButton: groupBtn, name } = createGroupLi(group)
          groupBtn.addEventListener('click', function (event) {
            event.preventDefault()
            if (!event.metaKey) {
              for (const key in selectedGroups) delete selectedGroups[key]
            }
            selectedGroups[group.uri] = !selectedGroups[group.uri]
            refreshThingsSelected(ctx.ulGroups, selectedGroups)
            // Highlight the matching group button in the sidebar ulGroups
            const matchingLi = Array.from(ctx.ulGroups.children).find(li => li.subject && li.subject.uri === group.uri)
            setActiveGroupButton(ctx.ulGroups, matchingLi ? matchingLi.querySelector('button') : null)
            kb.fetcher.nowOrWhenFetched(group.doc(), undefined, function (ok, message) {
              if (!ok) {
                debug.error('Cannot load group: ' + group + '. Stack: ' + message)
                return alertDialog('Failed to load group details. If it persists, contact your admin.')
              }
              refreshNames(ctx.ulPeople, null, false)
            })
          }, false)
          UI.widgets.makeDropTarget(groupLi, uris => handleURIsDroppedOnGroup(uris, group))

          if (me) {
            UI.widgets.deleteButtonWithCheck(
              dom,
              groupLi,
              'group ' + name,
              async function () {
                await deleteThingAndDoc(group)
                delete selectedGroups[group.uri]
                // Refresh the group buttons list
                const allGroupsLi = ctx.allGroupsLi
                const newGroupLi = ctx.newGroupLi
                if (allGroupsLi.parentNode) allGroupsLi.parentNode.removeChild(allGroupsLi)
                if (newGroupLi.parentNode) newGroupLi.parentNode.removeChild(newGroupLi)
                syncGroupUl(book, options, ctx.ulGroups, dom, selectedGroups, ctx.ulPeople, ctx.searchInput)
                ctx.ulGroups.insertBefore(allGroupsLi, ctx.ulGroups.firstChild)
                ctx.ulGroups.appendChild(newGroupLi)
                refreshThingsSelected(ctx.ulGroups, selectedGroups)
                // Refresh the people list to reflect the deleted group
                refreshNames(ctx.ulPeople, null, false)
                // Refresh the groups detail view
                groupsButton.click()
              }
            )
          }

          groupsList.appendChild(groupLi)
        })
      }

      ctx.detailsSectionContent.appendChild(groupsList)

      // New group button at the bottom
      const newGroupBtn = dom.createElement('button')
      newGroupBtn.setAttribute('type', 'button')
      newGroupBtn.innerHTML = '+ New group'
      newGroupBtn.classList.add('actionButton', 'btn-primary', 'action-button-focus', 'newGroupBtn')
      newGroupBtn.addEventListener('click', function () { handleNewGroupClick(ctx) }, false)
      ctx.detailsSectionContent.appendChild(newGroupBtn)
    })

    // Sharing button
    const sharingButton = cardFooter.appendChild(dom.createElement('button'))
    sharingButton.setAttribute('type', 'button')
    sharingButton.innerHTML = 'Sharing'
    sharingButton.classList.add('actionButton', 'btn-secondary', 'action-button-focus')
    actionButtons.push(sharingButton)
    sharingButton.addEventListener('click', function (_event) {
      setActiveActionButton(sharingButton)
      deselectAllPeople(ctx.ulPeople)
      ctx.showDetailsSection()
      ctx.detailsSectionContent.innerHTML = ''
      ctx.detailsSectionContent.classList.remove('detailsSectionContent--wide')

      const sharingHeader = dom.createElement('h3')
      sharingHeader.textContent = 'Sharing'
      ctx.detailsSectionContent.appendChild(sharingHeader)

      ctx.detailsSectionContent.appendChild(
        UI.aclControl.ACLControlBox5(
          book.dir(),
          dataBrowserContext,
          'book',
          kb,
          function (ok, body) {
            if (!ok) {
              debug.error('ACL control box Failed. Stack: ' + body)
              complain(ctx.detailsSectionContent, dom, 'Problem displaying sharing controls. If persists, contact admin.')
            }
          }
        )
      )

      const sharingContext = {
        target: book,
        me,
        noun: 'address book',
        div: ctx.detailsSectionContent,
        dom,
        statusRegion: div
      }
      UI.login.registrationControl(sharingContext, book, ns.vcard('AddressBook'))
        .then(() => debug.log('Registration control finished.'))
        .catch(e => {
          debug.error('Error in registration control. Stack: ' + e)
          complain(ctx.detailsSectionContent, dom, 'Problem displaying findable controls. If persists, contact admin.')
        })
    })

    // Settings button
    const toolsButton = cardFooter.appendChild(dom.createElement('button'))
    toolsButton.setAttribute('type', 'button')
    toolsButton.innerHTML = 'Tools'
    toolsButton.classList.add('actionButton', 'btn-secondary', 'action-button-focus')
    actionButtons.push(toolsButton)
    toolsButton.addEventListener('click', function (_event) {
      setActiveActionButton(toolsButton)
      deselectAllPeople(ctx.ulPeople)
      ctx.showDetailsSection()
      ctx.detailsSectionContent.innerHTML = ''
      ctx.detailsSectionContent.classList.add('detailsSectionContent--wide')
      ctx.detailsSectionContent.appendChild(
        toolsPane(
          selectAllGroups,
          selectedGroups,
          ctx.ulGroups,
          book,
          dataBrowserContext,
          me,
          function refreshGroups () {
            if (ctx.allGroupsLi.parentNode) ctx.allGroupsLi.parentNode.removeChild(ctx.allGroupsLi)
            if (ctx.newGroupLi.parentNode) ctx.newGroupLi.parentNode.removeChild(ctx.newGroupLi)
            syncGroupUl(book, options, ctx.ulGroups, dom, selectedGroups, ctx.ulPeople, ctx.searchInput)
            ctx.ulGroups.insertBefore(ctx.allGroupsLi, ctx.ulGroups.firstChild)
            ctx.ulGroups.appendChild(ctx.newGroupLi)
            refreshThingsSelected(ctx.ulGroups, selectedGroups)
          }
        )
      )
    })
  } // if book

  return cardFooter
}
