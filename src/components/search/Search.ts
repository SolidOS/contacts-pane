import { html, nothing } from 'lit'
import { property, state, query } from 'lit/decorators.js'
import { customElement, WebComponent } from 'solid-ui'
import type { Input } from 'solid-ui/components/input'

import 'solid-ui/components/input'

import styles from './Search.styles.css'

/**
 * The filter box above the people list. It only holds the filter text: the
 * pane listens for `filter-changed` to re-filter the list, and the presenter
 * reads `value` when deciding which rows match -- the same contract callers
 * had with the bare input element this replaces.
 */
@customElement('contacts-pane-search')
export default class Search extends WebComponent {
  static styles = styles

  /** Names what the filter actually matches -- currently names only. */
  @property()
  accessor placeholder = 'Search by name in selected group';

  @state()
  private accessor text = '';

  @query('solid-ui-input')
  private accessor input: Input | null = null;

  /** The current filter text. Setting it programmatically does not announce
   * a change, matching how a native input's `.value` behaves. */
  get value (): string {
    return this.text
  }

  set value (v: string) {
    this.text = v ?? ''
  }

  /** Empty the filter and tell listeners -- for the pane, when it hides the
   * box and the list must stop being invisibly filtered. */
  clear () {
    if (this.text === '') return

    this.text = ''
    this.announce()
  }

  /** Put the caret in the box -- for the pane, when it reveals it. */
  focusInput () {
    // solid-ui-input does not delegate focus yet, so focusing the host does
    // nothing; reach for its inner control until it learns to.
    this.input?.shadowRoot?.querySelector('input')?.focus()
  }

  protected render () {
    return html`
      <div class="searchDiv">
        <solid-ui-input
          type="search"
          aria-label="Search contacts"
          placeholder=${this.placeholder}
          .value=${this.text}
          @input=${this.onInput}
        ></solid-ui-input>
        ${this.text.length > 0
          ? html`
            <button type="button" aria-label="Clear search" @click=${this.onClear}>✕</button>
          `
          : nothing}
      </div>
    `
  }

  private onInput (event: Event) {
    this.text = (event.target as Input).value?.toString() ?? ''
    this.announce()
  }

  private onClear () {
    this.clear()
    this.focusInput()
  }

  private announce () {
    this.dispatchEvent(new CustomEvent('filter-changed', {
      bubbles: true,
      composed: true,
      detail: { value: this.text }
    }))
  }
}
