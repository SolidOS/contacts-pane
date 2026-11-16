import * as UI from 'solid-ui'
import { solidLogicSingleton } from 'solid-logic'
import * as $rdf from 'rdflib'
import { complain } from './localUtils'
import * as debug from './debug'

const { setACLUserPublic } = solidLogicSingleton.acl
// const mime = require('mime-types')
// const toolsPane0 = require('./toolsPane')
// const toolsPane = toolsPane0.toolsPane

// const ns = UI.ns
// const utils = UI.utils

// Mint a new address book

export function mintNewAddressBook (dataBrowserContext: any, context: any) {
  return new Promise((resolve, reject) => {
    UI.login.ensureLoadedProfile(context).then(
      (context: any) => {
        // 20180713
        debug.log('Logged in as ' + context.me)
        const me = context.me

        const dom = context.dom
        const div = context.div
        const kb = dataBrowserContext.session.store
        const ns = UI.ns
        const newBase = context.newBase || context.newInstance.dir().uri
        const instanceClass = context.instanceClass || ns.vcard('AddressBook')

        if (instanceClass.sameTerm(ns.vcard('Group'))) {
          // Make a group not an address book
          const g =
            context.newInstance || kb.sym(context.newBase + 'index.ttl#this')
          const doc = g.doc()
          kb.add(g, ns.rdf('type'), ns.vcard('Group'), doc)
          kb.add(
            g,
            ns.vcard('fn'),
            context.instanceName || 'untitled group',
            doc
          ) // @@ write doc back
          kb.fetcher
            .putBack(doc, { contentType: 'text/turtle' })
            .then((_xhr: any) => {
              resolve(context)
            })
            .catch((err: any) => {
              debug.error('Failed to fetch new address book. Stack: ' + err)
              reject(
                new Error('Error creating document for new group ' + err)
              )
            })
          return
        }
        const appInstanceNoun = 'address book'

        let bookContents = `@prefix vcard: <http://www.w3.org/2006/vcard/ns#>.
  @prefix ab: <http://www.w3.org/ns/pim/ab#>.
  @prefix dc: <http://purl.org/dc/elements/1.1/>.
  @prefix xsd: <http://www.w3.org/2001/XMLSchema#>.

  <#this> a vcard:AddressBook;
      dc:title "New address Book";
      vcard:nameEmailIndex <people.ttl>;
      vcard:groupIndex <groups.ttl>.
`

        bookContents +=
          '<#this> <http://www.w3.org/ns/auth/acl#owner> <' +
          me.uri +
          '>.\n\n'

        const newAppInstance = kb.sym(newBase + 'index.ttl#this')

        const toBeWritten = [
          {
            to: 'index.ttl',
            content: bookContents,
            contentType: 'text/turtle'
          },
          { to: 'groups.ttl', content: '', contentType: 'text/turtle' },
          { to: 'people.ttl', content: '', contentType: 'text/turtle' },
          { to: '', existing: true, aclOptions: { defaultForNew: true } }
        ]

        // @@ Ask user abut ACLs?

        //
        //   @@ Add header to PUT     If-None-Match: *       to prevent overwrite
        //

        function claimSuccess (newAppInstance: any, appInstanceNoun: string) {
          // @@ delete or grey other stuff
          debug.log(`New ${appInstanceNoun} created at ${newAppInstance}`)
          const p = div.appendChild(dom.createElement('p'))
          p.classList.add('claimSuccess')
          p.innerHTML =
            'Your <a href=\'' +
            newAppInstance.uri +
            '\'><b>new ' +
            appInstanceNoun +
            '</b></a> is ready. ' +
            '<br/><br/><a href=\'' +
            newAppInstance.uri +
            '\'>Go to new ' +
            appInstanceNoun +
            '</a>'
          const newContext = Object.assign(
            { newInstance: newAppInstance },
            context
          )
          resolve(newContext)
        }

        function doNextTask () {
          if (toBeWritten.length === 0) {
            claimSuccess(newAppInstance, appInstanceNoun)
            return
          }

          const task = toBeWritten.shift() as any
          debug.log('Creating new file ' + task.to + ' in new instance ')
          const dest = $rdf.uri.join(task.to, newBase)
          const aclOptions = task.aclOptions || {}

          const setACLAndContinue = () => {
            setACLUserPublic(dest, me, aclOptions)
              .then(() => doNextTask())
              .catch((err: any) => {
                debug.error('Error setting access permissions for ' + task.to + '. Stack: ' + err)
                reject(new Error('Error setting access permissions for ' + task.to + '.'))
              })
          }

          if ('content' in task) {
            kb.fetcher
              .webOperation('PUT', dest, {
                data: task.content,
                saveMetadata: true,
                contentType: task.contentType
              })
              .then(() => setACLAndContinue())
          } else if ('existing' in task) {
            setACLAndContinue()
          } else {
            reject(new Error('Copy not expected while buiding new app.'))
            // const from = task.from || task.to // default source to be same as dest
            // UI.widgets.webCopy(base + from, dest, task.contentType, ...)
          }
        }
        doNextTask()
      },
      err => {
        // log in then
        debug.warn('Error logging in. Stack: ' + err)
        complain(context.div, context.dom, 'Please log in to create a new address book.')
      }
    )
  })
}
