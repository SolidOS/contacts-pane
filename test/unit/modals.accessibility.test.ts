import { alertDialog, setDom } from '../../src/localUtils'
import { axe } from 'jest-axe'

describe('modal accessibility', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    setDom(document)
  })

  test('alertDialog is accessible according to axe', async () => {
    alertDialog('Hi!').then(() => {})
    await Promise.resolve()
    await expect(axe(document.body)).resolves.toHaveNoViolations()
  })
})
