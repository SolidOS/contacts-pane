import { html, nothing, type PropertyValues } from 'lit'
import type { NamedNode } from 'rdflib'
import { keyed } from 'lit/directives/keyed.js'
import { state, property } from 'lit/decorators.js'
import { customElement, WebComponent, showDialog } from 'solid-ui'
import { authn } from 'solid-logic'

import AddContactModal from '../add-contact-modal'
import { documentVisibility } from '../../localUtils'

import 'solid-ui/components/button'
import '~icons/lucide/ellipsis-vertical'
import '~icons/lucide/globe'
import '~icons/lucide/lock'
import '~icons/lucide/plus'
import '~icons/lucide/search'
import '~icons/lucide/trash-2'
import 'solid-ui/components/menu'
import 'solid-ui/components/menu-item'

import styles from './AddressBookHeader.styles.css'

type Person = NamedNode
type Visibility = 'public' | 'private' | null

/**
 * The address book's title bar: what is currently being shown, the button that
 * adds a contact, and -- when a single group is in view -- the button that
 * deletes it.
 *
 * Adding a contact is self-contained: the button opens the modal and reports
 * the result. Deleting a group is not, so it only raises an intent; both the
 * confirmation and the deletion are the pane's business.
 */
@customElement('contacts-pane-address-book-header')
export default class AddressBookHeader extends WebComponent {
  static styles = styles

  /** Name of the single group in view, or null when showing everything. */
  @property()
  accessor selectedGroupName: string | null = null;

  @property({ attribute: false })
  accessor book: NamedNode | null = null;

  @property({ attribute: false })
  accessor selectedGroups: Record<string, boolean> | null = null;

  /** Whose sharing the badge reports: the group in view, or the book. */
  @property({ attribute: false })
  accessor aclSubject: NamedNode | null = null;

  @state()
  private accessor loggedIn = false;

  @state()
  private accessor visibility: Visibility = null;

  /** Stamp for the latest visibility lookup, so a slow older one cannot
   * overwrite the answer for the current subject. */
  private visibilityLookup = 0

  /** Whether the Tools view is the one currently filling the details pane.
   * Sharing opens a dialog instead, so it has nothing to stay marked against. */
  @state()
  private accessor toolsOpen = false;

  /** Whether the search box above the people list is showing. Off until the
   * user asks for it. */
  @state()
  private accessor searchOpen = false;

  connectedCallback () {
    super.connectedCallback()

    // The button stays disabled until we know there is someone to attribute
    // the new contact to.
    authn.checkUser().then((webId: unknown) => {
      if (!webId) {
        return
      }

      this.loggedIn = true
      // The ACL may only be readable now that we know who is asking.
      this.refreshVisibility()
      this.dispatchEvent(new CustomEvent('user-resolved', {
        bubbles: true,
        composed: true,
        detail: { webId }
      }))
    })
  }

  protected updated (changedProperties: PropertyValues<this>) {
    super.updated(changedProperties)

    if (changedProperties.has('aclSubject')) {
      this.refreshVisibility()
    }
  }

  private async refreshVisibility () {
    const lookup = ++this.visibilityLookup
    this.visibility = null
    if (!this.aclSubject) return

    const visibility = await documentVisibility(this.aclSubject)
    if (lookup === this.visibilityLookup) this.visibility = visibility
  }

  protected render () {
    return html`
      <header>
        <div class="titles">
          <div class="titleRow">
            <h2 id="addressBook-heading" tabindex="-1">${this.selectedGroupName ?? 'All Contacts'}</h2>
            ${this.renderVisibilityBadge()}
          </div>
          <p>Search contacts by name, email, WebID, or profile URL</p>
        </div>
        <div class="actions">
          <solid-ui-button
            variant="ghost"
            aria-pressed=${this.searchOpen ? 'true' : 'false'}
            @click=${this.onToggleSearch}
          >
            <icon-lucide-search slot="left-icon"></icon-lucide-search>
            Search
          </solid-ui-button>
          <solid-ui-button
            variant="secondary"
            ?disabled=${!this.loggedIn}
            @click=${this.onAddContact}
          >
            <icon-lucide-plus slot="left-icon"></icon-lucide-plus>
            New Contact
          </solid-ui-button>
          ${this.book ? this.renderMenu() : nothing}
        </div>
      </header>
    `
  }

  /**
   * solid-ui-menu assigns each child a slot when it first sees it, and only
   * numbers children that do not have one yet -- so an item appearing later
   * restarts at zero and lands on top of the first one. Keying the menu on the
   * items it contains rebuilds the element instead of mutating it, so it always
   * numbers a complete set.
   */
  private renderMenu () {
    const canDeleteGroup = !!this.selectedGroupName && this.loggedIn

    return keyed(canDeleteGroup, html`
      <solid-ui-menu placement="bottom-end" distance="5">
        <solid-ui-button slot="trigger" variant="ghost" title="More actions">
          <span class="sr-only">More actions</span>
          <icon-lucide-ellipsis-vertical slot="icon"></icon-lucide-ellipsis-vertical>
        </solid-ui-button>

        <solid-ui-menu-item @solid-ui-select=${this.onSharing}>
          Sharing
        </solid-ui-menu-item>
        <solid-ui-menu-item
          ?selected=${this.toolsOpen}
          @solid-ui-select=${this.onTools}
        >
          Tools
        </solid-ui-menu-item>
        ${canDeleteGroup
          ? html`
            <solid-ui-menu-item @solid-ui-select=${this.onDeleteGroup}>
              <icon-lucide-trash-2 slot="left-icon"></icon-lucide-trash-2>
              Delete Group
            </solid-ui-menu-item>
          `
          : nothing}
      </solid-ui-menu>
    `)
  }

  /** The pill next to the title saying whether the web can read what is on
   * show. Hidden while unknown -- e.g. the ACL is unreadable before login. */
  private renderVisibilityBadge () {
    if (!this.visibility) return nothing

    const isPublic = this.visibility === 'public'

    return html`
      <span class="badge ${isPublic ? 'badge--public' : 'badge--private'}">
        ${isPublic
          ? html`<icon-lucide-globe aria-hidden="true"></icon-lucide-globe>`
          : html`<icon-lucide-lock aria-hidden="true"></icon-lucide-lock>`}
        ${isPublic ? 'Public' : 'Private'}
      </span>
    `
  }

  /** Drop the Sharing / Tools highlight when something else takes the stage. */
  clearActiveAction () {
    this.toolsOpen = false
  }

  private onToggleSearch () {
    this.searchOpen = !this.searchOpen
    this.dispatchEvent(new CustomEvent('search-toggled', {
      bubbles: true,
      composed: true,
      detail: { open: this.searchOpen }
    }))
  }

  private onSharing () {
    // Opens a dialog rather than taking over the details pane, so nothing
    // here stays marked afterwards.
    this.request('sharing')
  }

  private onTools () {
    this.toolsOpen = true
    this.request('tools')
  }

  private request (action: 'sharing' | 'tools') {
    this.dispatchEvent(new CustomEvent(`${action}-requested`, {
      bubbles: true,
      composed: true
    }))
  }

  private onDeleteGroup () {
    this.dispatchEvent(new CustomEvent('delete-group-requested', {
      bubbles: true,
      composed: true
    }))
  }

  private onAddContact () {
    if (!this.book || !this.selectedGroups) {
      throw new Error('Book and selectedGroups are required for <contacts-pane-address-book-header>')
    }

    showDialog(AddContactModal, {
      props: { book: this.book, selectedGroups: this.selectedGroups },
      onClose: (person?: Person) => {
        if (!person) {
          return
        }

        this.dispatchEvent(new CustomEvent('contact-added', {
          bubbles: true,
          composed: true,
          detail: { person }
        }))
      }
    })
  }
}
