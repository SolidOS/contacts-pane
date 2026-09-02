import type { NamedNode } from 'rdflib'
import { html, nothing } from 'lit'
import { state, property } from 'lit/decorators.js'
import { customElement, DialogComponent } from 'solid-ui'
import type { Input } from 'solid-ui/components/input'

import { saveNewGroup } from '../../contactLogic'

import 'solid-ui/components/dialog-content'
import 'solid-ui/components/dialog-footer'
import 'solid-ui/components/dialog'
import 'solid-ui/components/input'
import 'solid-ui/components/button'

import styles from './NewGroupModal.styles.css'

type Group = NamedNode

@customElement('contacts-pane-new-group-modal')
export default class NewGroupModal extends DialogComponent<Group> {
  static styles = styles

  @property()
  accessor book: NamedNode | null = null;

  @state()
  private accessor name = '';

  @state()
  private accessor loading = false;

  @state()
  private accessor error: string | null = null;

  protected render () {
    if (!this.book) {
      throw new Error('Book is required for <contacts-pane-new-group-modal>')
    }

    return html`
      <solid-ui-dialog title="New Group">
        <form @submit=${this.onSubmit}>
          <solid-ui-dialog-content>
            <solid-ui-input
              required
              name="name"
              label="Group name"
              .value=${this.name}
              @input=${this.onNameChanged}
            ></solid-ui-input>
            ${this.error ? html`<p class="error">${this.error}</p>` : nothing}
          </solid-ui-dialog-content>
          <solid-ui-dialog-footer>
            <solid-ui-button type="submit" ?loading=${this.loading}>Create Group</solid-ui-button>
          </solid-ui-dialog-footer>
        </form>
      </solid-ui-dialog>
    `
  }

  private onNameChanged (e: Event) {
    const { value } = e.target as Input

    this.name = typeof value === 'string' ? value : ''
  }

  private async onSubmit (e: Event) {
    e.preventDefault()

    this.error = null
    this.loading = true

    try {
      if (!this.book) {
        throw new Error('Book is required for <contacts-pane-new-group-modal>')
      }
      const group = await saveNewGroup(this.book, this.name)

      this.close(group)
    } catch (err) {
      console.error(err)

      this.error = 'Error saving group. If it persists, contact your admin.'
    } finally {
      this.loading = false
    }
  }
}
