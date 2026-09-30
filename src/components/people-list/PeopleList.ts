import { html, nothing } from 'lit'
import type { NamedNode } from 'rdflib'
import { state, property } from 'lit/decorators.js'
import { repeat } from 'lit/directives/repeat.js'
import { ref } from 'lit/directives/ref.js'
import { keyed } from 'lit/directives/keyed.js'
import { customElement, WebComponent, ns, widgets } from 'solid-ui'
import { authn, store } from 'solid-logic'

import { groupMembers } from '../../contactLogic'
import { compareForSort, nameFor } from '../../localUtils'
import * as debug from '../../debug'

import 'solid-ui/components/button'
import '~icons/lucide/ellipsis-vertical'
import '~icons/lucide/external-link'
import '~icons/lucide/trash-2'
import '~icons/lucide/user'
import 'solid-ui/components/menu'
import 'solid-ui/components/menu-item'

import styles from './PeopleList.styles.css'

const kb = store

type Person = NamedNode
type SelectedGroups = Record<string, boolean>

interface PersonRow {
  person: Person
  uri: string
  name: string
  error: boolean
}

/** Elements already handed to solid-ui's drag widgets, which attach listeners
 * imperatively and must not be wired twice as Lit re-renders. */
const wired = new WeakSet<Element>()

/**
 * The list of contacts in the selected groups: avatar, name, and a per-row
 * menu with the actions that used to sit in the contact detail's toolbar.
 *
 * `selectedGroups` is shared with the pane -- the group bar mutates it in
 * place -- so rows are recomputed by `refresh()` rather than reactively.
 * The row actions only raise intents (`person-selected`,
 * `open-contact-requested`, `delete-contact-requested`); rendering the card
 * and deleting the data are the pane's business.
 */
@customElement('contacts-pane-people-list')
export default class PeopleList extends WebComponent {
  static styles = styles

  @property({ attribute: false })
  accessor selectedGroups: SelectedGroups = {};

  @state()
  private accessor rows: PersonRow[] = [];

  @state()
  private accessor filter = '';

  @state()
  private accessor selectedUri: string | null = null;

  @state()
  private accessor loggedIn = false;

  @state()
  private accessor revision = 0;

  connectedCallback () {
    super.connectedCallback()

    // The delete action needs someone to attribute the change to; reveal it
    // once we know who is here.
    authn.checkUser().then((webId: unknown) => {
      this.loggedIn = !!webId
    })
  }

  /** Re-read the members of the selected groups from the store. Call after
   * anything that changes who should be listed. */
  refresh (autoSelect = false) {
    const seen = new Set<string>()
    const people: Person[] = []
    for (const groupUri of Object.keys(this.selectedGroups)) {
      if (!this.selectedGroups[groupUri]) continue
      for (const person of groupMembers(kb, kb.sym(groupUri))) {
        if (seen.has(person.uri)) continue
        seen.add(person.uri)
        people.push(person)
      }
    }
    people.sort(compareForSort)

    const failed = new Set(this.rows.filter(row => row.error).map(row => row.uri))
    this.rows = people.map((person: Person) => ({
      person,
      uri: person.uri,
      name: nameFor(person) || 'Unknown Name',
      error: failed.has(person.uri)
    }))

    // Load each person's own document in the background: it carries the
    // avatar (vcard:hasPhoto), and failing to load it marks the row.
    for (const row of this.rows) {
      kb.fetcher.nowOrWhenFetched(row.person.doc(), undefined, (ok: boolean, message: string) => {
        if (!ok) {
          debug.error('Cannot load contact: ' + row.person + '. Stack: ' + message)
          row.error = true
        }
        this.revision++
      })
    }
    this.revision++

    if (autoSelect) this.autoSelectSingleMatch()
  }

  /** Narrow the list; called by the pane when the search box changes. */
  applyFilter (text: string) {
    this.filter = text ?? ''
    this.autoSelectSingleMatch()
  }

  /** Mark a row as the current one without announcing it -- for callers that
   * are already rendering the person themselves. */
  markSelected (person: Person | null) {
    this.selectedUri = person ? person.uri : null
  }

  clearSelection () {
    this.selectedUri = null
  }

  private get visibleRows () {
    return this.rows.filter(row => this.matchesFilter(row.name))
  }

  /** Every space-separated word of the filter must appear in the name. */
  private matchesFilter (name: string) {
    const filter = this.filter.trim().toLowerCase()
    if (filter.length === 0) return true

    return filter.split(' ').every(word => name.toLowerCase().includes(word))
  }

  /** When exactly one contact is in view, showing it is what the user meant. */
  private autoSelectSingleMatch () {
    const visible = this.visibleRows
    if (visible.length === 1) this.select(visible[0].person)
  }

  private select (person: Person) {
    this.selectedUri = person.uri
    this.dispatchEvent(new CustomEvent('person-selected', {
      bubbles: true,
      composed: true,
      detail: { person }
    }))
  }

  /** Hand a freshly rendered row to solid-ui's drag widgets. */
  private wireDrag (person: Person) {
    return ref((el?: Element) => {
      if (!el || wired.has(el)) return

      wired.add(el)
      widgets.makeDraggable(el, person)
    })
  }

  protected render () {
    return html`
      <ul role="list" aria-label="People list">
        ${repeat(this.visibleRows, row => row.uri, row => this.renderRow(row))}
      </ul>
    `
  }

  /** The person's first email address, once their card has loaded. Read at
   * render time like the avatar, so it appears when the background load
   * finishes. */
  private emailFor (person: Person): string | null {
    for (const emailNode of kb.each(person, ns.vcard('hasEmail'))) {
      // vcard nests the address under vcard:value; older data may put the
      // mailto: on hasEmail directly.
      const value = kb.any(emailNode as any, ns.vcard('value')) ?? emailNode
      const address = String(value.value ?? '').replace(/^mailto:/, '')
      if (address.includes('@')) return address
    }
    return null
  }

  private renderRow (row: PersonRow) {
    const avatarUrl = kb.any(row.person, ns.vcard('hasPhoto'))
    const email = this.emailFor(row.person)
    const role = kb.anyValue(row.person, ns.vcard('role'))

    return html`
      <li
        role="listitem"
        tabindex="0"
        aria-label=${[row.name, role, email].filter(Boolean).join(', ')}
        class="personLi ${this.selectedUri === row.uri ? 'selected' : ''} ${row.error ? 'personLi--error' : ''}"
        @click=${() => this.select(row.person)}
        @keydown=${(event: KeyboardEvent) => this.onRowKeydown(event, row)}
        ${this.wireDrag(row.person)}
      >
        <div class="avatar" aria-hidden="true">
          ${avatarUrl
            ? html`<img src=${avatarUrl.value} alt="" />`
            : html`<icon-lucide-user class="avatarFallback"></icon-lucide-user>`}
        </div>
        <div class="identity">
          <div class="nameRow">
            <div class="name">${row.name}</div>
            ${role ? html`<div class="role">${role}</div>` : nothing}
          </div>
          ${email ? html`<div class="email">${email}</div>` : nothing}
        </div>
        ${this.renderRowMenu(row)}
      </li>
    `
  }

  /**
   * The row's own actions. Clicks inside must not bubble into the row, which
   * would read as "show this contact".
   *
   * solid-ui-menu assigns each child a slot when it first sees it, so an item
   * appearing later (Delete, once the user is known) would land on top of the
   * first one; keying the menu on `loggedIn` rebuilds it with a complete set.
   */
  private renderRowMenu (row: PersonRow) {
    return html`
      <div
        class="rowMenu"
        @click=${(event: Event) => event.stopPropagation()}
        @keydown=${(event: Event) => event.stopPropagation()}
      >
        ${keyed(this.loggedIn, html`
          <solid-ui-menu placement="bottom-end" distance="5">
            <solid-ui-button slot="trigger" variant="ghost" title="More actions">
              <span class="sr-only">Actions for ${row.name}</span>
              <icon-lucide-ellipsis-vertical slot="icon"></icon-lucide-ellipsis-vertical>
            </solid-ui-button>

            <solid-ui-menu-item @solid-ui-select=${() => this.request('open-contact-requested', row)}>
              <icon-lucide-external-link slot="left-icon"></icon-lucide-external-link>
              Open in new window
            </solid-ui-menu-item>
            ${this.loggedIn
              ? html`
                <solid-ui-menu-item @solid-ui-select=${() => this.request('delete-contact-requested', row)}>
                  <icon-lucide-trash-2 slot="left-icon"></icon-lucide-trash-2>
                  Delete contact
                </solid-ui-menu-item>
              `
              : nothing}
          </solid-ui-menu>
        `)}
      </div>
    `
  }

  private onRowKeydown (event: KeyboardEvent, row: PersonRow) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      this.select(row.person)
    }
  }

  private request (name: 'open-contact-requested' | 'delete-contact-requested', row: PersonRow) {
    this.dispatchEvent(new CustomEvent(name, {
      bubbles: true,
      composed: true,
      detail: { person: row.person }
    }))
  }
}
