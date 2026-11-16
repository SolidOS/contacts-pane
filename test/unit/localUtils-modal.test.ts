import { beforeEach, describe, expect, test } from 'vitest'
import { alertDialog, confirmDialog } from '../../src/localUtils'
import { renderDeleteButton } from '../../src/components/delete-button'

import 'solid-ui/components/dialogs-root'

/** Find the first matching element, descending through open shadow roots. */
function deepQuery (root: ParentNode, selector: string): HTMLElement | null {
  const direct = root.querySelector(selector)
  if (direct) return direct as HTMLElement

  for (const el of Array.from(root.querySelectorAll('*'))) {
    const shadow = (el as HTMLElement).shadowRoot
    if (!shadow) continue

    const found = deepQuery(shadow, selector)
    if (found) return found
  }

  return null
}

/** All matching elements, descending through open shadow roots. */
function deepQueryAll (root: ParentNode, selector: string): HTMLElement[] {
  const found = Array.from(root.querySelectorAll(selector)) as HTMLElement[]

  for (const el of Array.from(root.querySelectorAll('*'))) {
    const shadow = (el as HTMLElement).shadowRoot
    if (!shadow) continue

    found.push(...deepQueryAll(shadow, selector))
  }

  return found
}

/**
 * The action buttons of the currently open dialog.
 * Scoped to the footer so the dialog's own close ("X") button is excluded.
 */
function footerButtons (): HTMLElement[] {
  const footer = deepQuery(document.body, 'solid-ui-dialog-footer')
  if (!footer) throw new Error('No dialog footer rendered')

  return deepQueryAll(footer, 'solid-ui-button')
}

/** Let every pending Lit update flush. */
async function settle () {
  for (let i = 0; i < 5; i++) {
    await new Promise(resolve => setTimeout(resolve, 0))
  }
}

describe('modal dialog helpers', () => {
  beforeEach(async () => {
    document.body.innerHTML = '<solid-ui-dialogs-root></solid-ui-dialogs-root>'

    await settle()
  })

  test('alertDialog shows the message and resolves when OK is clicked', async () => {
    const result = alertDialog('Hello world')

    await settle()

    expect(deepQuery(document.body, 'contacts-pane-alert-modal')).not.toBeNull()

    expect(deepQuery(document.body, 'solid-ui-dialog')?.getAttribute('title')).toBe('Information')
    expect(deepQuery(document.body, 'solid-ui-dialog-content')?.textContent).toContain('Hello world')

    const buttons = footerButtons()
    expect(buttons).toHaveLength(1)

    buttons[0].click()

    await expect(result).resolves.toBe(true)
  })

  test('alertDialog uses a custom title when given one', async () => {
    alertDialog('Something broke', 'Error')

    await settle()

    expect(deepQuery(document.body, 'solid-ui-dialog')?.getAttribute('title')).toBe('Error')
  })

  test('alertDialog does not stack duplicates of the same message', async () => {
    const first = alertDialog('Failed to select all groups.')
    const second = alertDialog('Failed to select all groups.')

    await settle()

    expect(deepQueryAll(document.body, 'contacts-pane-alert-modal')).toHaveLength(1)

    footerButtons()[0].click()

    await expect(first).resolves.toBe(true)
    await expect(second).resolves.toBe(true)

    await settle()

    // Once dismissed, the same message can be shown again.
    alertDialog('Failed to select all groups.')

    await settle()

    expect(deepQueryAll(document.body, 'contacts-pane-alert-modal')).toHaveLength(1)
  })

  test('alertDialog still stacks distinct messages', async () => {
    alertDialog('First problem')
    alertDialog('Second problem')

    await settle()

    expect(deepQueryAll(document.body, 'contacts-pane-alert-modal')).toHaveLength(2)
  })

  test('confirmDialog resolves false on Cancel and true on OK', async () => {
    const cancelled = confirmDialog('Are you sure?')

    await settle()

    const buttons = footerButtons()
    expect(buttons).toHaveLength(2)

    buttons[0].click() // Cancel comes first
    await expect(cancelled).resolves.toBe(false)

    const confirmed = confirmDialog('Again?')

    await settle()

    footerButtons()[1].click() // OK
    await expect(confirmed).resolves.toBe(true)
  })
})

describe('renderDeleteButton', () => {
  let container: HTMLElement

  beforeEach(async () => {
    document.body.innerHTML = '<solid-ui-dialogs-root></solid-ui-dialogs-root><div id="container"></div>'
    container = document.getElementById('container') as HTMLElement

    await settle()
  })

  test('deletes once the confirmation is accepted', async () => {
    let deleted = false
    const button = renderDeleteButton(document, container, 'contact', () => { deleted = true })

    button.click()
    await settle()

    expect(deepQuery(document.body, 'contacts-pane-confirm-modal')).not.toBeNull()
    expect(deleted).toBe(false) // nothing happens until the user agrees

    footerButtons()[1].click() // OK
    await settle()

    expect(deleted).toBe(true)
  })

  test('does not delete when the confirmation is cancelled', async () => {
    let deleted = false
    const button = renderDeleteButton(document, container, 'contact', () => { deleted = true })

    button.click()
    await settle()

    footerButtons()[0].click() // Cancel
    await settle()

    expect(deleted).toBe(false)
  })

  test('skips its own confirmation when the caller opts out', async () => {
    let deleted = false
    const button = renderDeleteButton(document, container, 'membership', () => { deleted = true }, { confirm: false })

    button.click()
    await settle()

    expect(deepQuery(document.body, 'contacts-pane-confirm-modal')).toBeNull()
    expect(deleted).toBe(true)
  })

  test('reports a failing delete instead of rejecting silently', async () => {
    const button = renderDeleteButton(document, container, 'contact', () => {
      throw new Error('nope')
    })

    button.click()
    await settle()

    footerButtons()[1].click() // OK
    await settle()

    const alert = deepQuery(document.body, 'contacts-pane-alert-modal')
    expect(alert).not.toBeNull()
    expect(deepQuery(document.body, 'solid-ui-dialog-content')?.textContent).toContain('Failed to delete contact')
  })
})
