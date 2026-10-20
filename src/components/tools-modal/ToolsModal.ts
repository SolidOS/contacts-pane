import type { NamedNode } from 'rdflib'
import { html } from 'lit'
import { property } from 'lit/decorators.js'
import { customElement, DialogComponent } from 'solid-ui'

import '../tools'

import 'solid-ui/components/dialog-content'
import 'solid-ui/components/dialog'

import styles from './ToolsModal.styles.css'

/**
 * The address book's maintenance tools, in a dialog. The dialog is mounted
 * outside the address book, so group changes are reported through
 * `onGroupsChanged` rather than a bubbling event.
 */
@customElement('contacts-pane-tools-modal')
export default class ToolsModal extends DialogComponent<void> {
  static styles = styles

  @property({ attribute: false })
  accessor book: NamedNode | null = null;

  @property({ attribute: false })
  accessor selectedGroups: Record<string, boolean> = {};

  /** Called when a routine changed the book's groups, so the bar can refresh. */
  @property({ attribute: false })
  accessor onGroupsChanged: () => void = () => {};

  protected render () {
    return html`
      <solid-ui-dialog title="Tools">
        <solid-ui-dialog-content>
          <contacts-pane-tools
            .book=${this.book}
            .selectedGroups=${this.selectedGroups}
            @groups-changed=${() => this.onGroupsChanged()}
          ></contacts-pane-tools>
        </solid-ui-dialog-content>
      </solid-ui-dialog>
    `
  }
}
