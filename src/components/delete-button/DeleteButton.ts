import { html } from 'lit'
import { property } from 'lit/decorators.js'
import { customElement, WebComponent, icons } from 'solid-ui'

import { alertDialog, confirmDialog } from '../../localUtils'
import * as debug from '../../debug'

import styles from './DeleteButton.styles.css'

/**
 * The small delete control that appears on a contact, a membership or a row of
 * bad data: it asks for confirmation through the design-system dialog and
 * reports a failure rather than letting it reject silently.
 *
 * The host keeps `data-testid="deleteButtonWithCheck"` because the surrounding
 * panes hide it until its container is hovered, and those rules match on that
 * attribute. It replaces UI.widgets.deleteButtonWithCheck, whose own inline
 * popup would have asked a second time.
 */
@customElement('contacts-pane-delete-button')
export default class DeleteButton extends WebComponent {
  static styles = styles

  /** What is being removed, e.g. 'contact'. Names the button and the prompts. */
  @property()
  accessor noun = 'item';

  /** Overrides the default confirmation wording. */
  @property()
  accessor message: string | null = null;

  /** Set false when the action confirms on its own -- and can refuse. */
  @property({ type: Boolean })
  accessor confirm = true;

  /** What to run once the user agrees. */
  @property({ attribute: false })
  accessor deleteAction: (() => unknown) | null = null;

  /** Let a caller holding the element drive it. Runs the action directly
   * rather than forwarding to the inner button, which may not have rendered
   * yet when an imperative caller clicks straight after creating this. */
  click () {
    this.onClick()
  }

  connectedCallback () {
    super.connectedCallback()

    // Read by the panes' hover-to-reveal rules, and by tests.
    this.setAttribute('data-testid', 'deleteButtonWithCheck')
  }

  protected render () {
    return html`
      <button type="button" title=${`Remove this ${this.noun}`} @click=${this.onClick}>
        <img src=${icons.iconBase + 'noun_2188_red.svg'} alt="" />
        <span class="sr-only">Remove this ${this.noun}</span>
      </button>
    `
  }

  private async onClick () {
    const prompt = this.message ?? `Really delete this ${this.noun}?`

    if (this.confirm && !(await confirmDialog(prompt))) {
      return
    }

    try {
      await this.deleteAction?.()
    } catch (err) {
      debug.error('Error deleting ' + this.noun + '. Stack: ' + err)
      // A dialog, not the pane's usual inline error text: this control is a
      // bare icon with no surface of its own to carry a message.
      alertDialog(`Failed to delete ${this.noun}. If it persists, contact your admin.`)
    }
  }
}

/**
 * Create one for a caller that builds its DOM imperatively.
 *
 * Mirrors what UI.widgets.deleteButtonWithCheck did, so the panes that still
 * assemble their toolbars by hand keep working; a caller rendering with Lit
 * should use the tag instead.
 */
export function renderDeleteButton (
  dom: Document,
  container: HTMLElement,
  noun: string,
  deleteAction: () => unknown,
  options: { confirm?: boolean, message?: string } = {}
): DeleteButton {
  const button = dom.createElement('contacts-pane-delete-button') as DeleteButton

  button.noun = noun
  button.deleteAction = deleteAction
  button.confirm = options.confirm ?? true
  if (options.message) button.message = options.message

  container.classList.add('hoverControl')
  container.appendChild(button)

  return button
}
