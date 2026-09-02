import { html } from 'lit'
import { property } from 'lit/decorators.js'
import { customElement, DialogComponent } from 'solid-ui'

import 'solid-ui/components/dialog-content'
import 'solid-ui/components/dialog'

import styles from './SharingModal.styles.css'

/**
 * The address book's sharing controls, in a dialog.
 *
 * solid-ui builds the ACL editor imperatively and it is styled by the page's
 * own stylesheets, so the nodes are kept in the light DOM and slotted in
 * rather than rendered into the shadow root, where those rules could not
 * reach them.
 */
@customElement('contacts-pane-sharing-modal')
export default class SharingModal extends DialogComponent<void> {
  static styles = styles

  /** The controls to show, built by the caller. */
  @property({ attribute: false })
  accessor content: HTMLElement | null = null;

  connectedCallback () {
    super.connectedCallback()

    if (this.content && this.content.parentNode !== this) {
      this.appendChild(this.content)
    }
  }

  protected render () {
    return html`
      <solid-ui-dialog title="Sharing">
        <solid-ui-dialog-content>
          <slot></slot>
        </solid-ui-dialog-content>
      </solid-ui-dialog>
    `
  }
}
