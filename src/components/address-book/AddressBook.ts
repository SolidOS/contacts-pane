import { html } from 'lit'
import type { NamedNode } from 'rdflib'
import type { DataBrowserContext } from 'pane-registry'

/** The pane's context, extended with the people list other modules reach
 * for when they need to refresh it after a mutation. */
type PaneContext = DataBrowserContext & { ulPeople?: PeopleList }
import { state, property, query } from 'lit/decorators.js'
import { customElement, WebComponent, showDialog, ns, aclControl, login, utils } from 'solid-ui'
import { authn, store } from 'solid-logic'

import {
  checkDataModel, configureAddressBook, refreshNames,
  deselectAllPeople, selectPerson, deleteContact, openContactInNewWindow
} from '../../addressBookPresenter'
import { alertDialog, complain, confirmDialog, deleteThingAndDoc } from '../../localUtils'
import * as debug from '../../debug'

import NewGroupModal from '../new-group-modal'
import SharingModal from '../sharing-modal'
import '../address-book-header'
import '../details-section'
import '../group-bar'
import '../people-list'
import '../search'
import '../tools'

import type AddressBookHeader from '../address-book-header'
import type DetailsSection from '../details-section'
import type GroupBar from '../group-bar'
import type PeopleList from '../people-list'
import type Search from '../search'

const kb = store

type Node = NamedNode
type SelectedGroups = Record<string, boolean>

/**
 * The whole address-book view: the group column, the title bar, the people
 * column, and the details column, with the wiring between them.
 *
 * Renders into the light DOM: the pane's stylesheet lays the grid out through
 * the same class names the hand-built version carried, and the details column
 * hosts legacy pane content that a shadow root would cut off from it.
 */
@customElement('contacts-pane-address-book')
export default class AddressBook extends WebComponent {
  @property({ attribute: false })
  accessor book: Node | null = null;

  /** Extra render options; `foreignGroup` shows a group with no book. */
  @property({ attribute: false })
  accessor options: { foreignGroup?: Node } = {};

  @property({ attribute: false })
  accessor dataBrowserContext: PaneContext | null = null;

  @property({ attribute: false })
  accessor paneOptions: { solo?: boolean } = {};

  /** The book's name, shown atop the group column. ("title" would collide
   * with HTMLElement's own property.) */
  @state()
  private accessor heading = '';

  @state()
  private accessor ready = false;

  @state()
  private accessor error: string | null = null;

  /** Name of the single group in view, mirrored into the header. */
  @state()
  private accessor selectedGroupName: string | null = null;

  /** Whose sharing the header's badge reports: that group, or the book. */
  @state()
  private accessor aclSubject: Node | null = null;

  @state()
  private accessor searchOpen = false;

  /** Shared with the group bar and people list, which mutate it in place. */
  private selectedGroups: SelectedGroups = {}

  private me: Node | null = authn.currentUser()

  private wired = false

  @query('contacts-pane-group-bar')
  private accessor groupBar!: GroupBar;

  @query('contacts-pane-address-book-header')
  private accessor header!: AddressBookHeader;

  @query('contacts-pane-search')
  private accessor search!: Search;

  @query('contacts-pane-people-list')
  private accessor peopleList!: PeopleList;

  @query('contacts-pane-details')
  private accessor details!: DetailsSection;

  /** The pane hands the context in before connecting the element; anything
   * running later may rely on it. */
  private get context (): PaneContext {
    if (!this.dataBrowserContext) {
      throw new Error('dataBrowserContext is required for <contacts-pane-address-book>')
    }
    return this.dataBrowserContext
  }

  /** The grid is laid out by the pane's global stylesheet. */
  protected createRenderRoot () {
    return this
  }

  connectedCallback () {
    super.connectedCallback()
    this.load()
  }

  /** Load the book, name the view, and note who owns it when testing
   * offline on localhost with no WebID. */
  private async load () {
    const book = this.book ?? this.options.foreignGroup
    if (!book) {
      this.error = 'No address book to show.'
      return
    }

    if (this.book) {
      try {
        await kb.fetcher.load(this.book)
      } catch (err) {
        debug.error('Error loading address book. Stack: ' + err)
        this.error = 'Failed to load address book.'
        return
      }
    }

    const title = kb.any(book, ns.dc('title')) || kb.any(book, ns.vcard('fn'))
    if (this.paneOptions.solo && title && typeof document !== 'undefined') {
      document.title = title.value // @@ only when the outermost pane
    }
    this.heading = title ? title.value : utils.label(ns.vcard('AddressBook'))
    this.aclSubject = book

    if (this.options.foreignGroup) {
      this.selectedGroups[this.options.foreignGroup.uri] = true
    }

    if (
      typeof document !== 'undefined' &&
      document.location &&
      ('' + document.location).slice(0, 16) === 'http://localhost'
    ) {
      const inferredOwner = kb.any(book, ns.acl('owner')) as NamedNode | null // when testing on plane with no webid
      if (inferredOwner) {
        this.me = inferredOwner
      }
    }

    this.ready = true
  }

  protected updated (changedProperties: Map<PropertyKey, unknown>) {
    super.updated(changedProperties)

    // The children exist after the first ready render; wire up what still
    // works imperatively, once.
    if (this.ready && !this.wired) {
      this.wired = true
      this.wireUp()
    }
  }

  private wireUp () {
    // The people list and its presenter helpers read these.
    configureAddressBook({
      book: this.book,
      dom: this.ownerDocument,
      selectedGroups: this.selectedGroups,
      ulPeople: this.peopleList,
      cardMain: this.details,
      dataBrowserContext: this.dataBrowserContext
    })

    // Other modules (individual/group membership) look for this property
    // when they need to refresh the master list after a mutation.
    if (this.dataBrowserContext) this.dataBrowserContext.ulPeople = this.peopleList

    checkDataModel(this.book, this.details).then(() => { debug.log('Async checkDataModel done.') })

    const groupIndex = this.book && (kb.any(this.book, ns.vcard('groupIndex')) as NamedNode | null)
    if (this.book) {
      if (groupIndex) {
        // rdflib's typings omit the referringTerm form of nowOrWhenFetched
        ;(kb.fetcher as any).nowOrWhenFetched(groupIndex.uri, this.book, (ok: boolean, body: string) => {
          if (!ok) {
            debug.error('Error loading group index. Stack: ' + body)
            alertDialog('Error loading group index. If it persists, contact admin.')
            return
          }
          this.groupBar.selectAll() // Show all contacts on load
        })
      }
    } else {
      refreshNames(this.peopleList, null)
      debug.log('No book, only one group -> hide list of groups')
    }
  }

  protected render () {
    if (this.error) {
      return html`<p class="detailsError" role="alert">${this.error}</p>`
    }
    if (!this.ready) return html``

    return html`
      <main id="main-content" class="addressBook-grid" role="main" aria-label="Address Book" tabindex="-1">
        <section class="addressBookSection section-bg" role="region" aria-label="Groups" tabindex="-1">
          <contacts-pane-group-bar
            class="buttonSection"
            .heading=${this.heading}
            .book=${this.book}
            .options=${this.options}
            .selectedGroups=${this.selectedGroups}
            @selection-changed=${this.onSelectionChanged}
            @new-group-requested=${this.onNewGroupRequested}
          ></contacts-pane-group-bar>
        </section>

        <!-- Everything right of the address book shares one title bar, so the
             header spans the people list and the contact detail rather than
             being squeezed into the people column on its own. -->
        <div class="contentArea">
          <contacts-pane-address-book-header
            .book=${this.book}
            .selectedGroups=${this.selectedGroups}
            .selectedGroupName=${this.selectedGroupName}
            .aclSubject=${this.aclSubject}
            @user-resolved=${(event: CustomEvent) => { this.me = event.detail.webId }}
            @search-toggled=${this.onSearchToggled}
            @contact-added=${(event: CustomEvent) => this.showNewContact(event.detail.person)}
            @delete-group-requested=${this.deleteSelectedGroup}
            @sharing-requested=${this.showSharing}
            @tools-requested=${this.showTools}
          ></contacts-pane-address-book-header>

          <div class="contentColumns">
            <section class="peopleSection" role="region" aria-label="People">
              <contacts-pane-search
                class=${this.searchOpen ? '' : 'hidden'}
                @filter-changed=${(event: CustomEvent) => this.peopleList.applyFilter(event.detail.value)}
              ></contacts-pane-search>
              <contacts-pane-people-list
                .selectedGroups=${this.selectedGroups}
                @person-selected=${(event: CustomEvent) => selectPerson(this.peopleList, event.detail.person, this.details)}
                @open-contact-requested=${(event: CustomEvent) => openContactInNewWindow(event.detail.person)}
                @delete-contact-requested=${(event: CustomEvent) => deleteContact(event.detail.person)}
              ></contacts-pane-people-list>
            </section>

            <contacts-pane-details></contacts-pane-details>
          </div>
        </div>
      </main>
    `
  }

  // ── Selection ──────────────────────────────────────────────────────

  /** The one group in view, or null when showing all of them (or none). */
  private soleSelectedGroup (): Node | null {
    const uris = Object.keys(this.selectedGroups).filter(uri => this.selectedGroups[uri])
    const groupCount = this.groupBar ? this.groupBar.groupCount : 0

    // "All groups" selects everything, which is not the same as picking one.
    if (uris.length !== 1 || groupCount <= 1) return null

    return kb.sym(uris[0])
  }

  /** Keep the header's title and its Delete Group button in step. */
  private syncHeaderToSelection () {
    const group = this.soleSelectedGroup()
    const name = group && kb.any(group, ns.vcard('fn'))

    this.selectedGroupName = name ? name.value : null
    this.aclSubject = group || this.book
  }

  private onSelectionChanged () {
    this.syncHeaderToSelection()
    this.header.clearActiveAction()
    // Keep a contact on screen; anything else resets to the empty state
    this.details.clearUnlessContact()
  }

  private onSearchToggled (event: CustomEvent) {
    this.searchOpen = event.detail.open
    if (this.searchOpen) {
      this.search.focusInput()
    } else {
      this.search.clear() // the list must not stay invisibly filtered
    }
  }

  // ── Groups ─────────────────────────────────────────────────────────

  private async onNewGroupRequested () {
    this.header.clearActiveAction()
    deselectAllPeople(this.peopleList)

    const groupIndex = kb.any(this.book, ns.vcard('groupIndex'))
    if (groupIndex) {
      try {
        await kb.fetcher.load(groupIndex as any)
      } catch (e) {
        debug.log('Error: Group index  NOT loaded:' + e + '\n')
      }
    }
    debug.log(' Group index has been loaded\n')

    showDialog(NewGroupModal, {
      props: { book: this.book },
      onClose: (group?: Node) => {
        if (!group) {
          return // cancelled by user
        }

        this.showNewGroup(group)
      }
    })
  }

  /** Reveal a freshly created group. */
  private showNewGroup (group: Node) {
    for (const key in this.selectedGroups) delete this.selectedGroups[key]
    this.selectedGroups[group.uri] = true

    this.groupBar.refresh()
    this.syncHeaderToSelection()
    refreshNames(this.peopleList, null, false)

    this.details.showContent(
      aclControl.ACLControlBox5(group.doc(), this.context, 'group', kb))
  }

  private async deleteSelectedGroup () {
    const group = this.soleSelectedGroup()
    if (!group) return

    const name = kb.any(group, ns.vcard('fn'))
    const label = name ? name.value : 'this group'

    if (!(await confirmDialog(`Really delete the group ${label}?`))) return

    try {
      await deleteThingAndDoc(group)
    } catch (err) {
      debug.error('Error deleting group. Stack: ' + err)
      alertDialog('Failed to delete the group. If it persists, contact your admin.')
      return
    }

    delete this.selectedGroups[group.uri]
    this.groupBar.refresh()
    this.syncHeaderToSelection()
    refreshNames(this.peopleList, null, false)
  }

  // ── Contacts and address-book-wide views ───────────────────────────

  /** Reveal a freshly created contact. */
  private showNewContact (person: Node) {
    refreshNames(this.peopleList, null, false) // Add name to list of group
    this.peopleList.markSelected(person)
    const contactPane = this.context.session.paneRegistry.byName('contact')
    const paneDiv = contactPane!.render(person, this.context)
    paneDiv.classList.add('renderPane')
    this.details.showContent(paneDiv, { wide: true, kind: 'contact' })
  }

  private showSharing () {
    const dom = this.ownerDocument
    const content = dom.createElement('div')
    content.classList.add('sharingControls')

    const complainInto = (message: string) => complain(content, dom, message)

    content.appendChild(
      aclControl.ACLControlBox5(this.book!.dir()!, this.context, 'book', kb)
    )

    const sharingContext = {
      target: this.book,
      me: this.me,
      noun: 'address book',
      div: content,
      dom,
      statusRegion: this.parentElement ?? this
    }
    login.registrationControl(sharingContext, this.book, ns.vcard('AddressBook'))
      .then(() => debug.log('Registration control finished.'))
      .catch((e: unknown) => {
        debug.error('Error in registration control. Stack: ' + e)
        complainInto('Problem displaying findable controls. If persists, contact admin.')
      })

    showDialog(SharingModal, { props: { content } })
  }

  private showTools () {
    deselectAllPeople(this.peopleList)

    const tools = this.ownerDocument.createElement('contacts-pane-tools') as any
    tools.book = this.book
    tools.selectedGroups = this.selectedGroups
    tools.addEventListener('groups-changed', () => this.groupBar.refresh())

    this.details.showContent(tools, { wide: true })
  }
}
