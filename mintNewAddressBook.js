import { aclLogic } from 'solid-logic'
import * as UI from 'solid-ui'

// const mime = require('mime-types')
// const toolsPane0 = require('./toolsPane')
// const toolsPane = toolsPane0.toolsPane

const $rdf = UI.rdf
// const ns = UI.ns
// const utils = UI.utils

// Mint a new address book

export function mintNewAddressBook (dataBrowserContext, context) {
  return new Promise(function (resolve, reject) {
    UI.authn.logInLoadProfile(context).then(
      context => {
        // 20180713
        console.log('Logged in as ' + context.me)
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
            .then(function (_xhr) {
              resolve(context)
            })
            .catch(function (err) {
              reject(
                new Error('Error creating document for new group ' + err)
              )
            })
          return
        }
        const appInstanceNoun = 'address book'

        function complain (message) {
          div.appendChild(UI.widgets.errorMessageBlock(dom, message, 'pink'))
        }

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

        function claimSuccess (newAppInstance, appInstanceNoun) {
          // @@ delete or grey other stuff
          console.log(`New ${appInstanceNoun} created at ${newAppInstance}`)
          const p = div.appendChild(dom.createElement('p'))
          p.setAttribute('style', 'font-size: 140%;')
          p.innerHTML =
            "Your <a href='" +
            newAppInstance.uri +
            "'><b>new " +
            appInstanceNoun +
            '</b></a> is ready. ' +
            "<br/><br/><a href='" +
            newAppInstance.uri +
            "'>Go to new " +
            appInstanceNoun +
            '</a>'
          const newContext = Object.assign(
            { newInstance: newAppInstance },
            context
          )
          resolve(newContext)
        }

        function doNextTask () {
          function checkOKSetACL (uri, ok) {
            if (!ok) {
              complain('Error writing new file ' + task.to)
              return reject(new Error('Error writing new file ' + task.to))
            }

            aclLogic
              .setACLUserPublic(dest, me, aclOptions)
              .then(() => doNextTask())
              .catch(err => {
                const message =
                  'Error setting access permissions for ' +
                  task.to +
                  ' : ' +
                  err.message
                complain(message)
                return reject(new Error(message))
              })
          }

          if (toBeWritten.length === 0) {
            claimSuccess(newAppInstance, appInstanceNoun)
          } else {
            var task = toBeWritten.shift() /* eslint-disable-line no-var */
            console.log('Creating new file ' + task.to + ' in new instance ')
            var dest = $rdf.uri.join(task.to, newBase) /* eslint-disable-line no-var */
            var aclOptions = task.aclOptions || {} /* eslint-disable-line no-var */

            if ('content' in task) {
              kb.fetcher
                .webOperation('PUT', dest, {
                  data: task.content,
                  saveMetadata: true,
                  contentType: task.contentType
                })
                .then(() => checkOKSetACL(dest, true))
            } else if ('existing' in task) {
              checkOKSetACL(dest, true)
            } else {
              reject(new Error('copy not expected buiding new app!!'))
              // const from = task.from || task.to // default source to be same as dest
              // UI.widgets.webCopy(base + from, dest, task.contentType, checkOKSetACL)
            }
          }
        }
        doNextTask()
      },
      err => {
        // log in then
        context.div.appendChild(UI.widgets.errorMessageBlock(err))
      }
    )
  })
}
