import { html, nothing } from 'lit'
import type { NamedNode } from 'rdflib'
import { state, property } from 'lit/decorators.js'
import { repeat } from 'lit/directives/repeat.js'
import { ref } from 'lit/directives/ref.js'
import { customElement, WebComponent, ns, widgets } from 'solid-ui'
import { store } from 'solid-logic'

import { groupsInOrder, groupMemberCount, handleURIsDroppedOnGroup, refreshNames } from '../../addressBookPresenter'
import { groupMembers } from '../../contactLogic'

import 'solid-ui/components/button'
import '~icons/lucide/plus'
import 'solid-ui/components/input'

import styles from './GroupBar.styles.css'

const kb = store

type Group = NamedNode
type SelectedGroups = Record<string, boolean>

interface GroupRow {
  group: Group
  uri: string
  name: string
  count: number | null
}

/** Elements already handed to solid-ui's drag/drop widgets, which attach
 * listeners imperatively and must not be wired twice as Lit re-renders. */
const wired = new WeakSet<Element>()

/**
 * The row of group buttons: "All Contacts", every group in the book, and
 * "New Group".
 *
 * `selectedGroups` is shared with the pane -- the people list reads it to work
 * out which contacts to show -- so it is mutated in place rather than replaced.
 * `revision` is what turns those in-place mutations back into a render.
 */
@customElement('contacts-pane-group-bar')
export default class GroupBar extends WebComponent {
  static styles = styles

  /** The address book's title, shown as the column's heading. */
  @property({ attribute: false })
  accessor heading: string | null = null;

  @property({ attribute: false })
  accessor book: Group | null = null;

  @property({ attribute: false })
  accessor options: Record<string, unknown> = {};

  @property({ attribute: false })
  accessor selectedGroups: SelectedGroups = {};

  @state()
  private accessor rows: GroupRow[] = [];

  @state()
  private accessor busy = false;

  @state()
  private accessor error: string | null = null;

  @state()
  private accessor revision = 0;

  /** Narrows the list of group buttons; selections elsewhere are unaffected. */
  @state()
  private accessor filter = '';

  connectedCallback () {
    super.connectedCallback()
    this.refresh()
  }

  /** Re-read the groups from the store. Call after adding or deleting one. */
  refresh () {
    this.rows = groupsInOrder(this.book, this.options).map((group: Group) => {
      const name = kb.any(group, ns.vcard('fn'))

      return {
        group,
        uri: group.uri,
        name: name ? name.value : 'Some group',
        count: groupMemberCount(group)
      }
    })
    this.revision++
  }

  /** Load every group's document and show all of their contacts. */
  async selectAll () {
    this.refresh()
    if (!this.rows.length) return

    this.error = null
    this.busy = true
    const loaded = await Promise.all(this.rows.map(row => this.load(row.group)))
    this.busy = false

    const failed = this.rows.filter((_row, i) => !loaded[i])
    if (failed.length) {
      console.error('Failed to load group documents:', failed.map(row => row.uri))
      this.error = 'Failed to load all groups. If it persists, contact your admin.'
      return
    }

    for (const row of this.rows) this.selectedGroups[row.uri] = true

    this.refresh() // counts are only known once the documents are in
    this.announceSelection()
  }

  /** How many groups the book has, which the header uses to tell "one group
   * is selected" apart from "the only group is selected". */
  get groupCount () {
    return this.rows.length
  }

  private get allSelected () {
    return this.rows.length > 0 && this.rows.every(row => this.selectedGroups[row.uri])
  }

  /** How many distinct contacts the loaded groups hold between them, or null
   * before any group document is in -- the same "show nothing rather than a
   * misleading 0" rule the per-group counts follow. */
  private get allCount (): number | null {
    const seen = new Set<string>()
    let anyLoaded = false
    for (const row of this.rows) {
      if (row.count === null) continue
      anyLoaded = true
      for (const member of groupMembers(kb, row.group)) seen.add(member.uri)
    }
    return anyLoaded ? seen.size : null
  }

  private load (group: Group): Promise<boolean> {
    return new Promise(resolve => {
      kb.fetcher.nowOrWhenFetched(group.doc(), undefined, (ok: boolean) => resolve(ok))
    })
  }

  private announceSelection () {
    refreshNames(null, null, false)
    this.dispatchEvent(new CustomEvent('selection-changed', { bubbles: true, composed: true }))
  }

  /** Hand a freshly rendered row to solid-ui's drag and drop widgets. */
  private wireDragAndDrop (group: Group) {
    return ref((el?: Element) => {
      if (!el || wired.has(el)) return

      wired.add(el)
      widgets.makeDraggable(el, group)
      widgets.makeDropTarget(el, (uris: string[]) => handleURIsDroppedOnGroup(uris, group))
    })
  }

  private get visibleRows () {
    const filter = this.filter.trim().toLowerCase()
    if (filter.length === 0) return this.rows

    return this.rows.filter(row => row.name.toLowerCase().includes(filter))
  }

  private onFilterInput (event: Event) {
    this.filter = (event.target as HTMLInputElement).value?.toString() ?? ''
  }

  protected render () {
    return html`
      <header class="header">
        ${this.heading ? html`<h2 class="heading">${this.heading}</h2>` : nothing}
        <solid-ui-input
          class="groupFilter"
          type="search"
          aria-label="Filter groups"
          placeholder="Filter groups"
          .value=${this.filter}
          @input=${this.onFilterInput}
        ></solid-ui-input>
      </header>

      <button
        type="button"
        class="allGroupsButton ${this.allSelected ? 'allGroupsButton--active' : ''}"
        aria-label=${this.allCount === null
          ? 'All Contacts'
          : `All Contacts, ${this.allCount} ${this.allCount === 1 ? 'contact' : 'contacts'}`}
        aria-pressed=${this.allSelected ? 'true' : 'false'}
        aria-busy=${this.busy ? 'true' : 'false'}
        @click=${this.onAllGroups}
      >
        <span class="groupName">All Contacts</span>
        ${this.allCount === null
          ? nothing
          : html`<span class="groupCount" aria-hidden="true">${this.allCount}</span>`}
      </button>

      <ul class="groupButtonsList" role="list" aria-label="Groups list">
        ${repeat(this.visibleRows, row => row.uri, row => this.renderGroup(row))}
      </ul>

      ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}

      <div class="newGroup">
        <solid-ui-button variant="secondary" @click=${this.onNewGroup}>
          <icon-lucide-plus slot="left-icon"></icon-lucide-plus>
          New Group
        </solid-ui-button>
      </div>
    `
  }

  private renderGroup (row: GroupRow) {
    // While "All Contacts" is on, it carries the selection on behalf of every
    // group -- showing each row as picked as well reads as a second, separate
    // choice. Kept out of aria-pressed too, so both tellings agree.
    const selected = !!this.selectedGroups[row.uri] && !this.allSelected
    const label = row.count === null
      ? row.name
      : `${row.name}, ${row.count} ${row.count === 1 ? 'contact' : 'contacts'}`

    return html`
      <li
        role="listitem"
        aria-label=${label}
        class=${selected ? 'selected' : ''}
        ${this.wireDragAndDrop(row.group)}
      >
        <button
          type="button"
          class="groupButton"
          aria-pressed=${selected ? 'true' : 'false'}
          @click=${(event: MouseEvent) => this.onGroup(event, row)}
        >
          <span class="groupName">${row.name}</span>
          ${row.count === null
            ? nothing
            : html`<span class="groupCount" aria-hidden="true">${row.count}</span>`}
        </button>
      </li>
    `
  }

  private async onAllGroups () {
    // Selecting everything is a destination, not a toggle: clicking it while
    // it is already on should leave you where you are, not empty the list.
    if (this.allSelected) return

    await this.selectAll()
  }

  private async onGroup (event: MouseEvent, row: GroupRow) {
    event.preventDefault()
    this.error = null

    // Command-click accumulates; a plain click replaces the selection.
    if (event.metaKey) {
      this.selectedGroups[row.uri] = !this.selectedGroups[row.uri]
    } else {
      for (const key in this.selectedGroups) delete this.selectedGroups[key]
      this.selectedGroups[row.uri] = true
    }

    this.revision++

    const ok = await this.load(row.group)
    if (!ok) {
      console.error('Failed to load group document:', row.uri)
      this.error = `Failed to load "${row.name}". If it persists, contact your admin.`
    }

    this.refresh() // the members, and so the count, are known now
    this.announceSelection()
  }

  private onNewGroup () {
    this.dispatchEvent(new CustomEvent('new-group-requested', { bubbles: true, composed: true }))
  }
}
