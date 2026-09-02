/*   Contact AddressBook Pane
**
**  This outline pane allows a user to interact with a contact,
to change its state according to an ontology, comment on it, etc.
**
** See also things like
**  http://www.w3.org/TR/vcard-rdf/
**  http://tools.ietf.org/html/rfc6350
**  http://www.iana.org/assignments/vcard-elements/vcard-elements.xhtml
**
*/

import * as UI from 'solid-ui'
import { mintNewAddressBook } from './mintNewAddressBook'
import { renderIndividual } from './individual'
import './styles/utilities.css'
import './styles/contactsPane.css'
import { complain, setupResponsiveStacking } from './localUtils'
import * as debug from './debug'
import './styles/contactsRDFFormsEnforced.css'

import './components/address-book'

const ns = UI.ns

export default {
  icon: UI.icons.iconBase + 'noun_99101.svg', // changed from embedded icon 2016-05-01

  name: 'contact',

  global: false,

  // Does the subject deserve a contact pane?
  label (subject: any, context: any) {
    const t = context.session.store.findTypeURIs(subject)
    // with the new design we only display Address Books
    // individuals are rendered through the profile-pane but not Organizations
    if (t[ns.vcard('Organization').uri]) return 'Contact'
    if (t[ns.vcard('AddressBook').uri]) return 'Address book'
    return null // No, under other circumstances
  },

  mintClass: UI.ns.vcard('AddressBook'),

  mintNew: mintNewAddressBook, // Make a new address book

  //  Render the pane
  render (subject: any, dataBrowserContext: any, paneOptions: any = {}) {
    const dom = dataBrowserContext.dom
    const kb = dataBrowserContext.session.store
    const div = dom.createElement('div')

    UI.aclControl.preventBrowserDropEvents(dom) // protect drag and drop

    div.setAttribute('class', 'contactPane')
    // Make the pane stack vertically (sidebar -> details) when narrow
    // Set breakpoint to 1000 so it triggers at 980 width too.
    setupResponsiveStacking(div, 1000)

    asyncRender().then(
      () => debug.log('Contacts pane rendered for ' + subject),
      err => complain(div, dom, err.message || '' + err)
    ).catch(err => {
      complain(div, dom, err.message || '' + err)
    })
    return div

    // Async part of render. Maybe API will later allow render to be async
    async function asyncRender () {
      const t = kb.findTypeURIs(subject)

      // Render a single contact Individual
      if (
        t[ns.vcard('Individual').uri] ||
        t[ns.foaf('Person').uri] ||
        t[ns.schema('Person').uri] ||
        t[ns.vcard('Organization').uri] ||
        t[ns.schema('Organization').uri]
      ) {
        try {
          await renderIndividual(dom, div, subject, dataBrowserContext)
        } catch (err) {
          debug.error('Error rendering contact. Stack: ' + err)
          throw new Error('Failed to render contact: ' + (err.message || err))
        }
      // Render an AddressBook instance; see components/address-book for the
      // whole view.
      } else if (t[ns.vcard('AddressBook').uri]) {
        const addressBook = dom.createElement('contacts-pane-address-book')
        addressBook.book = subject
        addressBook.options = {}
        addressBook.dataBrowserContext = dataBrowserContext
        addressBook.paneOptions = paneOptions
        div.appendChild(addressBook)
      } else {
        debug.error('No evidence that ' + subject + ' is anything to do with contacts.')
        throw new Error('This does not seem to be a contact or address book.')
      }

      return div
    } // asyncRender
  } // render function
} // pane object

export { saveNewGroup, addPersonToGroup, groupMembers, saveNewContact } from './contactLogic'
export { addWebIDToContacts, removeWebIDFromContacts, getPersonas } from './webidControl'
