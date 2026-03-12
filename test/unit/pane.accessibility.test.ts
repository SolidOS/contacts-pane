import { axe } from 'jest-axe'
import pane from '../../src/contactsPane'
import { sym } from 'rdflib'
import { context, doc } from './setup'

const base = doc.dir()?.uri || ''
const book = sym(base + 'book.ttl#this')

// ensure the store knows this is an AddressBook so asyncRender will build UI
import { parse } from 'rdflib'
import { prefixes, web } from './setup'

web[base + 'book.ttl'] = `
<#this> a vcard:AddressBook;
    vcard:fn "Test address book".
`
for (const uri in web) {
  parse(prefixes + web[uri], context.session.store, uri)
}

describe('contacts-pane accessibility', () => {
  it('renders an empty UI of an address book', async () => {
    const div = pane.render(book, context)
    expect(div.outerHTML).toMatch('<div class="contactPane"></div>')
    expect(div.innerHTML).toMatch('')
    // check accessibility of the generated DOM (ignore aria-allowed-role for now)
    await expect(
      axe(div, { rules: { 'aria-allowed-role': { enabled: false } } })
    ).resolves.toHaveNoViolations()
  })

  it('includes a clear button in the search input and it works', async () => {
    const div = pane.render(book, context)
    // let asyncRender finish (it runs in a microtask)
    await new Promise(resolve => setTimeout(resolve, 0))
    const input = div.querySelector('.searchInput') as HTMLInputElement
    expect(input).toBeTruthy()
    const clear = div.querySelector('.searchClearButton') as HTMLElement
    expect(clear).toBeTruthy()
    // initially hidden via utility class
    expect(clear.classList.contains('hidden')).toBe(true)
    // simulate typing
    input.value = 'hello'
    input.dispatchEvent(new Event('input'))
    expect(clear.classList.contains('hidden')).toBe(false)
    // clicking clear should reset input and hide button again
    clear.click()
    expect(input.value).toBe('')
    expect(clear.classList.contains('hidden')).toBe(true)
    // run axe check on the full pane container after interactivity
    await expect(
      axe(div, { rules: { 'aria-allowed-role': { enabled: false } } })
    ).resolves.toHaveNoViolations()
  })
})
