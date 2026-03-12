import { alertDialog, confirmDialog, setDom } from '../../src/localUtils'
import { axe } from 'jest-axe'

describe('accessible modal dialogs', () => {
  beforeEach(() => {
    // clear dom
    document.body.innerHTML = ''
    setDom(document)
  })

  test('alertDialog displays and resolves when OK clicked', async () => {
    const p = alertDialog('Hello world')
    // modal should be present
    const overlay = document.getElementById('contacts-modal')
    expect(overlay).not.toBeNull()
    expect(overlay?.classList.contains('hidden')).toBe(false)

    const title = overlay?.querySelector('#modal-title')
    const desc = overlay?.querySelector('#modal-desc')
    expect(title?.textContent).toBe('Information')
    expect(desc?.textContent).toBe('Hello world')

    const btn = overlay?.querySelector('button') as HTMLElement
    // primary button should have correct class
    expect(btn.classList.contains('btn-primary')).toBe(true)
    btn.click()
    await expect(p).resolves.toBe(true)
    // after close the overlay should be hidden again
    expect(overlay?.classList.contains('hidden')).toBe(true)
  })

  test('an accessible alertDialog via axe', async () => {
    // bring up an alert and then run axe on the document
    alertDialog('Hi!').then(() => {})
    // wait a tick for DOM to update
    await Promise.resolve()
    await expect(axe(document.body)).resolves.toHaveNoViolations()
  })

  test('confirmDialog resolves false when cancel, true when OK', async () => {
    const p1 = confirmDialog('Are you sure?')
    const overlay = document.getElementById('contacts-modal')
    expect(overlay).not.toBeNull()
    const buttons = overlay?.querySelectorAll('button')
    expect(buttons?.length).toBe(2)
    // cancel is first because we append in order
    const cancelBtn = buttons?.item(0) as HTMLElement
    const okBtn = buttons?.item(1) as HTMLElement
    expect(okBtn.classList.contains('btn-primary')).toBe(true)
    cancelBtn.click()
    await expect(p1).resolves.toBe(false)

    // open another and click OK
    const p2 = confirmDialog('Again?')
    const btns2 = (document.getElementById('contacts-modal') as HTMLElement).querySelectorAll('button')
    ;(btns2?.item(1) as HTMLElement).click()
    await expect(p2).resolves.toBe(true)
  })
})
