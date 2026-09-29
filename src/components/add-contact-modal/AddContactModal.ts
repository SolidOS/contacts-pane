import { html, nothing } from 'lit'
import { state, property } from 'lit/decorators.js'
import { consume } from '@lit/context'
import { customElement, WebComponent, ns, DialogTrait, dialogContext, DEFAULT_DIALOG_CONTEXT } from 'solid-ui'
import type { Select } from 'solid-ui/components/select'
import type { Input } from 'solid-ui/components/input'
import type { DialogContext } from 'solid-ui'

import { saveNewContact } from '../../contactLogic'

import 'solid-ui/components/dialog-content'
import 'solid-ui/components/dialog-footer'
import 'solid-ui/components/dialog'
import 'solid-ui/components/input'
import 'solid-ui/components/select-option'
import 'solid-ui/components/select'

import styles from './AddContactModal.styles.css'

const CONTACT_TYPES = [
  { value: 'person', label: 'Person' },
  { value: 'organization', label: 'Organization' },
] as const

type ContactType = (typeof CONTACT_TYPES)[number]['value']

type Person = any

@customElement('solid-contacts-pane-add-contact-modal')
export default class AddContactModal extends WebComponent {
  static styles = styles

  @property()
  accessor book: unknown | null = null;

  @property()
  accessor selectedGroups: unknown | null = null;

  @state()
  private accessor contactType: ContactType = 'organization';

  @state()
  private accessor name = '';

  @state()
  private accessor loading = false;

  @state()
  private accessor error: string | null = null;

  @consume({ context: dialogContext, subscribe: true })
  private accessor context: DialogContext = DEFAULT_DIALOG_CONTEXT;

  private dialogTrait: DialogTrait<Person>

  constructor () {
    super()

    this.dialogTrait = this.addTrait(new DialogTrait(this, {
      getContext: () => this.context,
    }))
  }

  protected render () {
    if (!this.book || !this.selectedGroups) {
      throw new Error('Book and selectedGroups are required for <solid-contacts-pane-add-contact-modal>')
    }

    return html`
      <solid-ui-dialog title="Add Contact">
        <form @submit=${this.onSubmit}>
          <solid-ui-dialog-content>
            <p>The new contact is added to the already selected group.</p>
            <solid-ui-select
              name="type"
              label="Contact type"
              .value=${this.contactType}
              @input=${this.onContactTypeChanged}
            >
              ${CONTACT_TYPES.map(
                (type) =>
                  html`<solid-ui-select-option .value=${type.value}
                    >${type.label}</solid-ui-select-option
                  >`
              )}
            </solid-ui-select>
            <solid-ui-input
              required
              name="name"
              label=${this.contactType === 'person'
                ? 'Individual name'
                : 'Organization name'}
              .value=${this.name}
              @input=${this.onNameChanged}
            ></solid-ui-input>
            ${this.error ? html`<p class="error">${this.error}</p>` : nothing}
          </solid-ui-dialog-content>
          <solid-ui-dialog-footer>
            <solid-ui-button type="submit" ?loading=${this.loading}>Add Contact</solid-ui-button>
          </solid-ui-dialog-footer>
        </form>
      </solid-ui-dialog>
    `
  }

  private onContactTypeChanged (e: Event) {
    this.contactType = (e.target as Select).value as ContactType
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
      const person = await saveNewContact(
        this.book,
        this.name,
        this.selectedGroups,
        this.contactType === 'organization'
          ? ns.vcard('Organization')
          : ns.vcard('Individual')
      )

      this.dialogTrait.close(person)
    } catch (err) {
      console.error(err)

      this.error = 'Error saving contact. If it persists, contact your admin.'
    } finally {
      this.loading = false
    }
  }
}
