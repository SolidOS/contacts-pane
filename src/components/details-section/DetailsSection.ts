import { html } from 'lit'
import { state } from 'lit/decorators.js'
import { customElement, WebComponent } from 'solid-ui'

import '~icons/lucide/book-user'

type View = 'empty' | 'loading' | 'message' | 'error' | 'content'

/**
 * The right-hand details column: one place that knows whether it is hidden,
 * loading, showing a contact, a tool, or a message -- instead of every caller
 * poking at innerHTML, aria-busy, and the `hidden` class themselves.
 *
 * Renders into the light DOM: what it hosts (a rendered pane, solid-ui's ACL
 * box, the Tools view) is legacy DOM styled by the pane's global stylesheet,
 * which a shadow root would cut off. The `detailSection` and
 * `detailsSectionContent` class names stay for the same reason.
 */
@customElement('contacts-pane-details')
export default class DetailsSection extends WebComponent {
  @state()
  private accessor view: View = 'empty';

  @state()
  private accessor message = '';

  @state()
  private accessor content: HTMLElement | null = null;

  /** Starts wide: the empty state holds the width a contact will need. */
  @state()
  private accessor wide = true;

  /** Extra elements shown above the view, e.g. the data-model cleanup
   * prompt. Like content once appended imperatively, they last until the next
   * view change. */
  @state()
  private accessor notices: HTMLElement[] = [];

  /** What kind of thing the content is; 'contact' survives a group change. */
  private contentKind: 'contact' | 'other' | null = null

  /** The section hosts legacy DOM styled by the pane's stylesheet. */
  protected createRenderRoot () {
    return this
  }

  connectedCallback () {
    super.connectedCallback()

    this.classList.add('detailSection')
    this.setAttribute('role', 'region')
    this.setAttribute('aria-label', 'Details section')
  }

  get hasContact () {
    return this.contentKind === 'contact'
  }

  showLoading ({ wide = false } = {}) {
    this.transition('loading', { wide })
  }

  showMessage (message: string) {
    this.transition('message')
    this.message = message
  }

  showError (message: string) {
    this.transition('error')
    this.message = message
  }

  showContent (content: HTMLElement, { wide = false, kind = 'other' as 'contact' | 'other' } = {}) {
    this.transition('content', { wide })
    this.content = content
    this.contentKind = kind
  }

  /** Back to the empty state -- wide, so the column keeps the width a
   * contact would give it instead of jumping when one is picked. */
  clear () {
    this.transition('empty', { wide: true })
  }

  /** Show an extra element above the current view. It does not open the
   * section -- a notice added while hidden waits for whatever opens it -- and
   * the next view change sweeps it away. */
  addNotice (notice: HTMLElement) {
    this.notices = [...this.notices, notice]
  }

  /** A new group selection keeps a contact on screen but sweeps anything
   * else -- tools, messages, a group's sharing pane -- off it. */
  clearUnlessContact () {
    if (this.hasContact) return

    this.clear()
  }

  private transition (view: View, { wide = false } = {}) {
    this.view = view
    this.wide = wide
    this.message = ''
    this.content = null
    this.contentKind = null
    this.notices = []
  }

  protected render () {
    return html`
      <div
        class="detailsSectionContent ${this.wide ? 'detailsSectionContent--wide' : ''}"
        role="region"
        aria-label="Details"
        aria-live="polite"
        aria-busy=${this.view === 'loading' ? 'true' : 'false'}
      >
        ${this.notices}
        ${this.renderView()}
      </div>
    `
  }

  private renderView () {
    switch (this.view) {
      case 'loading':
        return html`Loading...`
      case 'message':
        return html`${this.message}`
      case 'error':
        return html`<div class="detailsError" role="alert">${this.message}</div>`
      case 'content':
        return this.content
      default:
        return this.renderEmpty()
    }
  }

  private renderEmpty () {
    return html`
      <div class="detailsEmpty">
        <span class="detailsEmptyIcon" aria-hidden="true">
          <icon-lucide-book-user></icon-lucide-book-user>
        </span>
        <h3 class="detailsEmptyTitle">No contact selected</h3>
        <p class="detailsEmptyText">Select a contact from the list to view their profile, edit details, or send a message.</p>
      </div>
    `
  }
}
