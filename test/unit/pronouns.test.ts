import pane from '../../src/contactsPane'
import { sym, parse } from 'rdflib'
import { context, doc, prefixes, web } from './setup'

// base directory used by the mock web store
const base = doc.dir()?.uri || ''

describe('pronoun rendering', () => {
  it('renders pronoun fields for a person with pronouns', async () => {
    const person = sym(base + 'person1#me')
    // insert triples for the three pronoun properties
    web[person.doc().uri] = `
<#me> a vcard:Individual;
    solid:preferredSubjectPronoun "they";
    solid:preferredObjectPronoun "them";
    solid:preferredRelativePronoun "their".
`
    parse(prefixes + web[person.doc().uri], context.session.store, person.doc().uri)

    const div = pane.render(person, context)
    // wait for asyncRender microtask to complete
    await new Promise(resolve => setTimeout(resolve, 0))

    // each pronoun label should be rendered as a link
    expect(div.querySelector('a[href$="#preferredSubjectPronoun"]')).toBeTruthy()
    expect(div.querySelector('a[href$="#preferredObjectPronoun"]')).toBeTruthy()
    expect(div.querySelector('a[href$="#preferredRelativePronoun"]')).toBeTruthy()

    // the string values also appear in the HTML
    expect(div.innerHTML).toMatch('they')
    expect(div.innerHTML).toMatch('them')
    expect(div.innerHTML).toMatch('their')
  })
})
