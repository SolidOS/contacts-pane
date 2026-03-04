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
  syncGroupUl, setActiveGroupButton, refreshFilteredPeople
} from './addressBookPresenter'
import { complain, deleteThingAndDoc } from './localUtils'
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

    UI.aclControl.preventBrowserDropEvents(dom) // protect drag and drop

    div.setAttribute('class', 'contactPane')

    asyncRender().then(
      () => debug.log('contactsPane rendered ' + subject),
      err => complain(div, dom, '' + err))
    return div

    // Async part of render. Maybe API will later allow render to be async
    async function asyncRender () {
      UI.aclControl.preventBrowserDropEvents(dom)

      const t = kb.findTypeURIs(subject)

      let me = authn.currentUser()

      const context = {
        target: subject,
        me,
        noun: 'address book',
        div,
        dom
      } // missing: statusRegion

      //  Render AddressBook instance
      function renderAddressBook (books, options) {
        kb.fetcher
          .load(books)
          .then(function (_xhr) {
            renderAddressBookDetails(books, options)
          })
          .catch(function (err) {
            complain(div, dom, '' + err)
          })
      }

      function renderAddressBookDetails (books, options) {
        const classLabel = utils.label(ns.vcard('AddressBook'))

        const book = books[0] // for now
        const groupIndex = kb.any(book, ns.vcard('groupIndex'))
        const selectedGroups = {}
        let selectedPeople = {} // Actually prob max 1

        const target = options.foreignGroup || book

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

        // the title of a adddress book has a default value, reason why if we take the name from the document
        let title = ''
        if (book) {
          title = utils.label(book.dir())
        } else {
          utils.label(book.dir()) || kb.any(target, ns.dc('title')) || kb.any(target, ns.vcard('fn'))
          if (paneOptions.solo && title && typeof document !== 'undefined') {
            document.title = title.value // @@ only when the outermmost pane
          }
          title = title ? title.value : classLabel
        }

        // Click on New Group button
        async function newGroupClickHandler (_event) {
          showDetailsSection()
          detailsSectionContent.innerHTML = ''
          const groupIndex = kb.any(book, ns.vcard('groupIndex'))
          try {
            await kb.fetcher.load(groupIndex)
          } catch (e) {
            debug.log('Error: Group index  NOT loaded:' + e + '\n')
          }
          debug.log(' Group index has been loaded\n')

          const name = await UI.widgets.askName(
            dom, kb, detailsSectionContent, UI.ns.foaf('name'), ns.vcard('Group'), 'group')
          if (!name) return // cancelled by user
          let group
          try {
            group = await saveNewGroup(book, name)
          } catch (err) {
            debug.log('Error: can\'t save new group:' + err)
            detailsSectionContent.innerHTML = 'Failed to save group' + err
            return
          }
          for (const key in selectedGroups) delete selectedGroups[key]
          selectedGroups[group.uri] = true

          // Refresh the group buttons list
          if (allGroupsLi.parentNode) allGroupsLi.parentNode.removeChild(allGroupsLi)
          if (newGroupLi.parentNode) newGroupLi.parentNode.removeChild(newGroupLi)
          syncGroupUl(book, options, ulGroups, dom, selectedGroups, ulPeople, searchInput)
          ulGroups.insertBefore(allGroupsLi, ulGroups.firstChild)
          ulGroups.appendChild(newGroupLi)
          refreshThingsSelected(ulGroups, selectedGroups)
          // Highlight the new group button in ulGroups and show empty people list
          const matchingLi = Array.from(ulGroups.children).find(li => li.subject && li.subject.uri === group.uri)
          setActiveGroupButton(ulGroups, matchingLi ? matchingLi.querySelector('button') : null)
          refreshNames(ulPeople, null, false)

          detailsSectionContent.innerHTML = ''
          detailsSectionContent.appendChild(UI.aclControl.ACLControlBox5(
            group.doc(), dataBrowserContext, 'group', kb,
            function (ok, body) {
              if (!ok) {
                detailsSectionContent.innerHTML =
                    'Group sharing setup failed: ' + body
              }
            }))
        } // newGroupClickHandler

        // Render the askName form for the given klass into formContainer
        function createNewPersonOrOrganization (formContainer, klass) {
          formContainer.innerHTML = ''
          UI.widgets
            .askName(dom, kb, formContainer, UI.ns.foaf('name'), klass)
            .then(async (name) => {
              if (!name) return // cancelled by user
              detailsSectionContent.innerHTML = 'Indexing...'
              let person
              try {
                person = await saveNewContact(book, name, selectedGroups, klass)
              } catch (err) {
                const msg = 'Error: can\'t save new contact: ' + err
                debug.log(msg)
                alert(msg)
                return
              }
              selectedPeople = {}
              selectedPeople[person.uri] = true
              refreshNames(ulPeople, null) // Add name to list of group
              detailsSectionContent.innerHTML = '' // Clear 'indexing'
              const contactPane = dataBrowserContext.session.paneRegistry.byName('contact')
              const paneDiv = contactPane.render(person, dataBrowserContext)
              paneDiv.classList.add('renderPane')
              detailsSectionContent.appendChild(paneDiv)
            })
        }

        // //////////////////////////// Contact Browser  - Body
        // Main wrapper for accessibility and style
        const main = dom.createElement('main')
        main.id = 'main-content'
        main.classList.add('addressBook-grid')
        main.setAttribute('role', 'main')
        main.setAttribute('aria-label', 'Address Book')
        main.setAttribute('tabindex', '-1')
        div.appendChild(main)

        // Section wrapper for accessibility and style
        const section = dom.createElement('section')
        section.setAttribute('aria-labelledby', 'addressBook-section')
        section.classList.add('addressBookSection', 'section-bg')
        section.setAttribute('role', 'region')
        section.setAttribute('tabindex', '-1')
        main.appendChild(section)

        // Create a section for the header with white background
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
            me = webId
            newContactButton.removeAttribute('disabled')
          }
        })
        container.appendChild(newContactButton)
        newContactButton.innerHTML = '+ New contact'
        newContactButton.classList.add('actionButton', 'btn-primary', 'action-button-focus')
        let newContactClickGeneration = 0
        newContactButton.addEventListener('click', async function (_event) {
          setActiveActionButton(null)
          const thisGeneration = ++newContactClickGeneration
          showDetailsSection()
          detailsSectionContent.innerHTML = ''
          await ensureBookLoaded()
          // Bail out if a newer click has taken over
          if (thisGeneration !== newContactClickGeneration) return
          detailsSectionContent.innerHTML = ''

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

          detailsSectionContent.appendChild(chooserDiv)

          const remark = dom.createElement('p')
          remark.classList.add('contactCreationRemark')
          remark.textContent = 'The new contact is added to the already selected group.'
          detailsSectionContent.appendChild(remark)

          // Container for the askName form, placed below the select
          const formContainer = dom.createElement('div')
          formContainer.classList.add('contactFormContainer')
          detailsSectionContent.appendChild(formContainer)

          function currentKlass () {
            return select.value === 'Organization'
              ? ns.vcard('Organization')
              : ns.vcard('Individual')
          }

          // Render person form immediately as default
          createNewPersonOrOrganization(formContainer, currentKlass())

          // Switch form when dropdown changes
          select.addEventListener('change', function () {
            createNewPersonOrOrganization(formContainer, currentKlass())
          })
        }, false)

        // TODO we should also add if it is public or private
        header.appendChild(h2)
        header.appendChild(container)
        headerSection.appendChild(header)
        section.appendChild(headerSection)

        // Add a dotted horizontal rule after the header section
        const dottedHr = dom.createElement('hr')
        dottedHr.classList.add('dottedHr')
        section.appendChild(dottedHr)

        // Search input
        const searchSection = dom.createElement('section')
        searchSection.classList.add('searchSection')
        const searchDiv = dom.createElement('div')
        searchDiv.classList.add('searchDiv')
        searchSection.appendChild(searchDiv)
        const searchInput = dom.createElement('input')
        searchInput.setAttribute('type', 'text')
        searchInput.setAttribute('aria-label', 'Search contacts')
        searchInput.classList.add('searchInput')
        searchInput.setAttribute('placeholder', 'Search by name')
        searchDiv.appendChild(searchInput)
        searchInput.addEventListener('input', function (_event) {
          refreshFilteredPeople(ulPeople, true, detailsSectionContent)
        })
        section.appendChild(searchSection)

        // Create a section for the buttons
        const buttonSection = dom.createElement('section')
        buttonSection.classList.add('buttonSection')

        // People list (created early so it can be passed to presenter functions)
        const ulPeople = dom.createElement('ul')
        ulPeople.setAttribute('role', 'list')
        ulPeople.setAttribute('aria-label', 'People list')

        // Card main (created early so it can be passed to presenter functions)
        const detailsSectionContent = dom.createElement('div')
        detailsSectionContent.classList.add('detailsSectionContent')
        detailsSectionContent.setAttribute('role', 'region')
        detailsSectionContent.setAttribute('aria-labelledby', 'detailsSectionContent')

        if (options.foreignGroup) {
          selectedGroups[options.foreignGroup.uri] = true
        }

        // Groups list (all buttons inside ul > li)
        const ulGroups = dom.createElement('ul')
        ulGroups.classList.add('groupButtonsList')
        ulGroups.setAttribute('role', 'list')
        ulGroups.setAttribute('aria-label', 'Groups list')

        if (book) {
          // All groups button — leftmost, initially selected
          allGroupsLi = dom.createElement('li')
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
              selectAllGroups(selectedGroups, ulGroups, function (
                ok,
                message
              ) {
                if (!ok) return complain(div, dom, message)
                allGroupsButton.classList.remove('allGroupsButton--loading')
                allGroupsButton.classList.add('allGroupsButton--active')
                refreshThingsSelected(ulGroups, selectedGroups)
                refreshNames(ulPeople, null)
              })
            } else {
              allGroupsButton.classList.remove('allGroupsButton--loading', 'allGroupsButton--active')
              allGroupsButton.classList.add('allGroupsButton--loaded') // pale green hint groups loaded
              for (const key in selectedGroups) delete selectedGroups[key]
              refreshThingsSelected(ulGroups, selectedGroups)
              refreshNames(ulPeople, null)
            }
          }) // on button click
          allGroupsLi.appendChild(allGroupsButton)
          ulGroups.appendChild(allGroupsLi) // First item in the list

          // New group button — rightmost (appended after group buttons are rendered)
          newGroupLi = dom.createElement('li')
          const newGroupButton = dom.createElement('button')
          newGroupButton.setAttribute('type', 'button')
          newGroupButton.innerHTML = '+ New group'
          newGroupButton.classList.add('allGroupsButton', 'actionButton', 'btn-secondary', 'action-button-focus')
          actionButtons.push(newGroupButton)
          newGroupButton.addEventListener(
            'click', function (event) {
              setActiveGroupButton(ulGroups, newGroupButton)
              setActiveActionButton(null)
              newGroupClickHandler(event)
            },
            false
          )
          newGroupLi.appendChild(newGroupButton)

          // Append ulGroups to buttonSection, then add New group at the end
          buttonSection.appendChild(ulGroups)

          kb.fetcher.nowOrWhenFetched(groupIndex.uri, book, function (ok, body) {
            if (!ok) return complain(div, dom, 'Cannot load group index: ' + body)
            // Remove special items before sync (syncTableToArrayReOrdered expects .subject on all children)
            if (allGroupsLi.parentNode) allGroupsLi.parentNode.removeChild(allGroupsLi)
            if (newGroupLi.parentNode) newGroupLi.parentNode.removeChild(newGroupLi)
            syncGroupUl(book, options, ulGroups, dom, selectedGroups, ulPeople, searchInput) // Refresh list of groups
            ulGroups.insertBefore(allGroupsLi, ulGroups.firstChild) // Keep All contacts first
            ulGroups.appendChild(newGroupLi) // Keep New group last

            // Auto-select all groups and display all contacts on load
            allGroupsButton.classList.add('allGroupsButton--loading')
            selectAllGroups(selectedGroups, ulGroups, function (loadOk, message) {
              if (!loadOk) return complain(div, dom, message)
              allGroupsButton.classList.remove('allGroupsButton--loading')
              allGroupsButton.classList.add('allGroupsButton--active')
              refreshThingsSelected(ulGroups, selectedGroups)
              refreshNames(ulPeople, null)
            })
          })

          // Remove special items before initial render too
          if (allGroupsLi.parentNode) allGroupsLi.parentNode.removeChild(allGroupsLi)
          if (newGroupLi.parentNode) newGroupLi.parentNode.removeChild(newGroupLi)
          renderGroupButtons(book, ulGroups, options, dom, selectedGroups, ulPeople, searchInput, detailsSectionContent, div, dataBrowserContext, function () {
            setActiveActionButton(null)
            // Keep the New contact form open when switching groups
            if (!detailsSectionContent.querySelector('.contactTypeChooser, .contactFormContainer')) {
              detailsSectionContent.innerHTML = ''
              detailsSection.classList.add('hidden')
            }
          })
          ulGroups.insertBefore(allGroupsLi, ulGroups.firstChild) // Keep All contacts first
          ulGroups.appendChild(newGroupLi) // Ensure New group is last after initial render
        } else {
          syncGroupUl(book, options, ulGroups, dom, selectedGroups, ulPeople, searchInput) // Refresh list of groups (will be empty)
          refreshNames(ulPeople, null)
          debug.log('No book, only one group -> hide list of groups')
        } // if not book

        section.appendChild(buttonSection)

        // List of contacts
        const peopleListSection = dom.createElement('section')
        peopleListSection.classList.add('peopleSection')
        section.appendChild(peopleListSection)

        peopleListSection.appendChild(ulPeople)

        // Accessible table structure — rendered beside the addressBook section
        const detailsSection = dom.createElement('section')
        detailsSection.classList.add('detailSection')
        detailsSection.setAttribute('role', 'region')
        detailsSection.setAttribute('aria-label', 'Details section')
        detailsSection.classList.add('hidden')
        main.appendChild(detailsSection)

        function showDetailsSection () {
          detailsSection.classList.remove('hidden')
        }

        detailsSection.appendChild(detailsSectionContent)

        // Footer area for action buttons
        const cardFooter = dom.createElement('div')
        cardFooter.classList.add('cardFooter')
        section.appendChild(cardFooter)

        if (book) {
          // Groups button
          const groupsButton = cardFooter.appendChild(dom.createElement('button'))
          groupsButton.setAttribute('type', 'button')
          groupsButton.innerHTML = 'Groups'
          groupsButton.classList.add('actionButton', 'btn-secondary', 'action-button-focus')
          actionButtons.push(groupsButton)
          groupsButton.addEventListener('click', async function (_event) {
            setActiveActionButton(groupsButton)
            showDetailsSection()
            detailsSectionContent.innerHTML = ''

            // Header
            const groupsHeader = dom.createElement('h3')
            groupsHeader.textContent = 'Your groups'
            detailsSectionContent.appendChild(groupsHeader)

            const groupRemark = dom.createElement('p')
            groupRemark.classList.add('contactCreationRemark')
            groupRemark.textContent = 'When deleting a group, all its contacts are deleted too.'
            detailsSectionContent.appendChild(groupRemark)

            // Load all groups and display them in a list
            let groups
            try {
              groups = await loadAllGroups(book)
            } catch (err) {
              detailsSectionContent.appendChild(dom.createTextNode('Failed to load groups: ' + err))
              return
            }

            const groupsList = dom.createElement('ul')
            groupsList.setAttribute('role', 'list')
            groupsList.setAttribute('aria-label', 'All groups')
            groupsList.classList.add('groupButtonsList')

            // Sort groups by name
            groups.sort((a, b) => {
              const nameA = (kb.any(a, ns.vcard('fn')) || '').toString().toLowerCase()
              const nameB = (kb.any(b, ns.vcard('fn')) || '').toString().toLowerCase()
              return nameA < nameB ? -1 : nameA > nameB ? 1 : 0
            })

            groups.forEach(function (group) {
              const name = kb.any(group, ns.vcard('fn'))
              const groupLi = dom.createElement('li')
              groupLi.setAttribute('role', 'listitem')
              groupLi.setAttribute('tabindex', '0')
              groupLi.setAttribute('aria-label', name ? name.value : 'Some group')
              groupLi.subject = group

              const groupBtn = groupLi.appendChild(dom.createElement('button'))
              groupBtn.setAttribute('type', 'button')
              groupBtn.innerHTML = name ? name.value : 'Some group'
              groupBtn.classList.add('allGroupsButton', 'actionButton', 'btn-secondary', 'action-button-focus')
              groupBtn.addEventListener('click', function (event) {
                event.preventDefault()
                if (!event.metaKey) {
                  for (const key in selectedGroups) delete selectedGroups[key]
                }
                selectedGroups[group.uri] = !selectedGroups[group.uri]
                refreshThingsSelected(ulGroups, selectedGroups)
                // Highlight the matching group button in the sidebar ulGroups
                const matchingLi = Array.from(ulGroups.children).find(li => li.subject && li.subject.uri === group.uri)
                setActiveGroupButton(ulGroups, matchingLi ? matchingLi.querySelector('button') : null)
                kb.fetcher.nowOrWhenFetched(group.doc(), undefined, function (ok, _message) {
                  if (ok) {
                    refreshNames(ulPeople, null, false)
                  }
                })
              }, false)

              UI.widgets.makeDraggable(groupLi, group)
              UI.widgets.deleteButtonWithCheck(
                dom,
                groupLi,
                'group ' + name,
                async function () {
                  await deleteThingAndDoc(group)
                  delete selectedGroups[group.uri]
                  // Refresh the group buttons list
                  if (allGroupsLi.parentNode) allGroupsLi.parentNode.removeChild(allGroupsLi)
                  if (newGroupLi.parentNode) newGroupLi.parentNode.removeChild(newGroupLi)
                  syncGroupUl(book, options, ulGroups, dom, selectedGroups, ulPeople, searchInput)
                  ulGroups.insertBefore(allGroupsLi, ulGroups.firstChild)
                  ulGroups.appendChild(newGroupLi)
                  refreshThingsSelected(ulGroups, selectedGroups)
                  // Refresh the people list to reflect the deleted group
                  refreshNames(ulPeople, null, false)
                  // Refresh the groups detail view
                  groupsButton.click()
                }
              )

              groupsList.appendChild(groupLi)
            })

            detailsSectionContent.appendChild(groupsList)

            // New group button at the bottom
            const newGroupBtn = dom.createElement('button')
            newGroupBtn.setAttribute('type', 'button')
            newGroupBtn.innerHTML = '+ New group'
            newGroupBtn.classList.add('actionButton', 'btn-primary', 'action-button-focus', 'newGroupBtn')
            newGroupBtn.addEventListener('click', newGroupClickHandler, false)
            detailsSectionContent.appendChild(newGroupBtn)
          })

          // Sharing button
          const sharingButton = cardFooter.appendChild(dom.createElement('button'))
          sharingButton.setAttribute('type', 'button')
          sharingButton.innerHTML = 'Sharing'
          sharingButton.classList.add('actionButton', 'btn-secondary', 'action-button-focus')
          actionButtons.push(sharingButton)
          sharingButton.addEventListener('click', function (_event) {
            setActiveActionButton(sharingButton)
            showDetailsSection()
            detailsSectionContent.innerHTML = ''

            const sharingHeader = dom.createElement('h3')
            sharingHeader.textContent = 'Sharing'
            detailsSectionContent.appendChild(sharingHeader)

            detailsSectionContent.appendChild(
              UI.aclControl.ACLControlBox5(
                book.dir(),
                dataBrowserContext,
                'book',
                kb,
                function (ok, body) {
                  if (!ok) detailsSectionContent.innerHTML = 'ACL control box Failed: ' + body
                }
              )
            )

            const sharingContext = {
              target: book,
              me,
              noun: 'address book',
              div: detailsSectionContent,
              dom,
              statusRegion: div
            }
            UI.login.registrationControl(sharingContext, book, ns.vcard('AddressBook'))
              .then(() => console.log('Registration control finished.'))
              .catch(e => UI.widgets.complain(sharingContext, 'registrationControl: ' + e))
          })

          // Settings button
          const toolsButton = cardFooter.appendChild(dom.createElement('button'))
          toolsButton.setAttribute('type', 'button')
          toolsButton.innerHTML = 'Tools'
          toolsButton.classList.add('actionButton', 'btn-secondary', 'action-button-focus')
          actionButtons.push(toolsButton)
          toolsButton.addEventListener('click', function (_event) {
            setActiveActionButton(toolsButton)
            showDetailsSection()
            detailsSectionContent.innerHTML = ''
            detailsSectionContent.appendChild(
              toolsPane(
                selectAllGroups,
                selectedGroups,
                ulGroups,
                book,
                dataBrowserContext,
                me
              )
            )
          })
        } // if book

        /*
        const newBookBtn = newAddressBookButton(book)
        if (newBookBtn && newBookBtn.classList) {
          newBookBtn.classList.add('actionButton', 'btn-secondary', 'action-button-focus')
        }
        cardFooter.appendChild(newBookBtn)
        */

        checkDataModel(book).then(() => { debug.log('async checkDataModel done.') })
      }

      // ///////////////////////////////////////////////////////////////////////////////////

      //              Render a single contact Individual

      if (
        t[ns.vcard('Individual').uri] ||
        t[ns.foaf('Person').uri] ||
        t[ns.schema('Person').uri] ||
        t[ns.vcard('Organization').uri] ||
        t[ns.schema('Organization').uri]
      ) {
        renderIndividual(dom, div, subject, dataBrowserContext).then(() => debug.log('(individual rendered)'))

        //          Render a Group instance
      } else if (t[ns.vcard('Group').uri]) {
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

        // Render a AddressBook instance
      } else if (t[ns.vcard('AddressBook').uri]) {
        renderAddressBook([subject], {})
      } else {
        debug.log(
          'Error: Contact pane: No evidence that ' +
            subject +
            ' is anything to do with contacts.'
        )
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
// ends
