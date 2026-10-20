import { html } from 'lit'
import { property } from 'lit/decorators.js'
import { customElement, DialogComponent } from 'solid-ui'

import 'solid-ui/components/dialog-content'
import 'solid-ui/components/dialog-footer'
import 'solid-ui/components/dialog'
import 'solid-ui/components/button'

import styles from './ConfirmModal.styles.css'

@customElement('contacts-pane-confirm-modal')
export default class ConfirmModal extends DialogComponent<boolean> {
  static styles = styles

  @property()
  accessor message = '';

  @property()
  accessor title = 'Confirm';

  protected render () {
    return html`
      <solid-ui-dialog title=${this.title}>
        <solid-ui-dialog-content>
          <p>${this.message}</p>
        </solid-ui-dialog-content>
        <solid-ui-dialog-footer>
          <solid-ui-button variant="secondary" @click=${this.onCancel}>Cancel</solid-ui-button>
          <solid-ui-button @click=${this.onConfirm}>OK</solid-ui-button>
        </solid-ui-dialog-footer>
      </solid-ui-dialog>
    `
  }

  private onCancel () {
    this.close(false)
  }

  private onConfirm () {
    this.close(true)
  }
}
