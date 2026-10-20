import { beforeEach, describe, expect, test } from 'vitest'
import { axe } from 'vitest-axe'
import { alertDialog, confirmDialog } from '../../src/localUtils'

import 'solid-ui/components/dialogs-root'

async function settle () {
  for (let i = 0; i < 5; i++) {
    await new Promise(resolve => setTimeout(resolve, 0))
  }
}

describe('modal accessibility', () => {
  beforeEach(async () => {
    document.body.innerHTML = '<solid-ui-dialogs-root></solid-ui-dialogs-root>'

    await settle()
  })

  test('alertDialog is accessible according to axe', async () => {
    alertDialog('Hi!')

    await settle()

    const axeResults = await axe(document.body)
    expect(axeResults.violations).toHaveLength(0)
  })

  test('confirmDialog is accessible according to axe', async () => {
    confirmDialog('Are you sure?')

    await settle()

    const axeResults = await axe(document.body)
    expect(axeResults.violations).toHaveLength(0)
  })
})
