import * as UI from 'solid-ui'
import * as mime from 'mime-types'

const $rdf = UI.rdf
const ns = UI.ns
const utils = UI.utils
const kb = UI.store

// //////// End of drag and drop

export function renderMugshotGallery (dom, subject) {
  function complain (message) {
    console.log(message)
    galleryDiv.appendChild(UI.widgets.errorMessageBlock(dom, message, 'pink'))
  }

  async function linkToPicture (subject, pic, remove) {
    const link = [
      $rdf.st(subject, ns.vcard('hasPhoto'), pic, subject.doc())
    ]
    try {
      if (remove) {
        await kb.updater.update(link, [])
      } else {
        await kb.updater.update([], link)
      }
    } catch (err) {
      const msg = ' Write back image link FAIL ' + pic + ', Error: ' + err
      console.log(msg)
      alert(msg)
    }
  }

  function handleDroppedThing (thing) {
    kb.fetcher.nowOrWhenFetched(thing.doc(), function (ok, mess) {
      if (!ok) {
        console.log('Error looking up dropped thing ' + thing + ': ' + mess)
      } else {
        const types = kb.findTypeURIs(thing)
        for (const ty in types) {
          console.log('    drop object type includes: ' + ty) // @@ Allow email addresses and phone numbers to be dropped?
        }
        console.log('Default: assume web page  ' + thing) // icon was: UI.icons.iconBase + 'noun_25830.svg'
        kb.add(subject, ns.wf('attachment'), thing, subject.doc())
        // @@ refresh UI
      }
    })
  }

  function uploadFileToContact (filename, contentType, data) {
    // var fileExtension = filename.split('.').pop() // .toLowerCase()
    const extension = mime.extension(contentType)
    if (contentType !== mime.lookup(filename)) {
      filename += '_.' + extension
      console.log('MIME TYPE MISMATCH -- adding extension: ' + filename)
    }
    let prefix, predicate
    const isImage = contentType.startsWith('image')
    if (isImage) {
      prefix = 'image_'
      predicate = ns.vcard('hasPhoto')
    } else {
      prefix = 'attachment_'
      predicate = ns.wf('attachment')
    }

    let n, pic
    for (n = 0; ; n++) {
      // Check filename is not used or invent new one
      pic = kb.sym(subject.dir().uri + filename)
      if (!kb.holds(subject, ns.vcard('hasPhoto'), pic)) {
        break
      }
      filename = prefix + n + '.' + extension
    }
    console.log(
      'Putting ' +
        data.byteLength +
        ' bytes of ' +
        contentType +
        ' to ' +
        pic
    )
    kb.fetcher
      .webOperation('PUT', pic.uri, {
        data: data,
        contentType: contentType
      })
      .then(function (response) {
        if (!response.ok) {
          complain('Error uploading ' + pic + ':' + response.status)
          return
        }
        console.log(' Upload: put OK: ' + pic)
        kb.add(subject, predicate, pic, subject.doc())
        kb.fetcher
          .putBack(subject.doc(), { contentType: 'text/turtle' })
          .then(
            function (_response) {
              if (isImage) {
                mugshotDiv.refresh()
              }
            },
            function (err) {
              console.log(
                ' Write back image link FAIL ' + pic + ', Error: ' + err
              )
            }
          )
      })
  }

  // When a set of URIs are dropped on
  function handleURIsDroppedOnMugshot (uris) {
    uris.forEach(function (u) {
      const thing = $rdf.sym(u) // Attachment needs text label to disinguish I think not icon.
      console.log('Dropped on mugshot thing ' + thing) // icon was: UI.icons.iconBase + 'noun_25830.svg'
      if (u.startsWith('http') && u.indexOf('#') < 0) {
        // Plain document
        // Take a copy of a photo on the web:
        const options = { withCredentials: false, credentials: 'omit' }
        kb.fetcher.webOperation('GET', thing.uri, options).then(
          result => {
            const contentType = result.headers.get('Content-Type')
            // let data = result.responseText
            let pathEnd = thing.uri.split('/').slice(-1)[0] // last segment as putative filename
            pathEnd = pathEnd.split('?')[0] // chop off any query params
            result.arrayBuffer().then(function (data) {
              // read text stream
              if (!result.ok) {
                complain('Error downloading ' + thing + ':' + result.status)
                return
              }
              uploadFileToContact(pathEnd, contentType, data)
            })
          },
          err => {
            complain(
              `WebOp (fetch) error trying to read picture ${thing} on web: ${err}`
            )
          }
        )
        return
      } else {
        console.log(
          'Not a web document URI, cannot copy as picture: ' + thing
        )
      }
      handleDroppedThing(thing)
    })
  }

  // Drop an image file to set up the mugshot
  function droppedFileHandler (files) {
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      console.log(
        ' contacts: Filename: ' +
          f.name +
          ', type: ' +
          (f.type || 'n/a') +
          ' size: ' +
          f.size +
          ' bytes, last modified: ' +
          (f.lastModifiedDate
            ? f.lastModifiedDate.toLocaleDateString()
            : 'n/a')
      ) // See e.g. https://www.html5rocks.com/en/tutorials/file/dndfiles/

      // @@ Add: progress bar(s)
      const reader = new FileReader()
      reader.onload = (function (theFile) {
        return function (e) {
          const data = e.target.result
          console.log(' File read byteLength : ' + data.byteLength)
          const filename = encodeURIComponent(theFile.name)
          const contentType = theFile.type
          uploadFileToContact(filename, contentType, data)
        }
      })(f)
      reader.readAsArrayBuffer(f)
    }
  }

  function elementForImage (image) {
    const img = dom.createElement('img')
    img.setAttribute(
      'style',
      'max-height: 10em; border-radius: 1em; margin: 0.7em;'
    )
    UI.widgets.makeDropTarget(
      img,
      handleURIsDroppedOnMugshot,
      droppedFileHandler
    )
    if (image) {
      img.setAttribute('src', image.uri)
      UI.widgets.makeDraggable(img, image)
    }
    return img
  }

  function syncMugshots () {
    let images = kb.each(subject, ns.vcard('hasPhoto')) // Priviledge vcard ones
    images.sort() // arbitrary consistency
    images = images.slice(0, 5) // max number for the space
    if (images.length === 0) {
      mugshotDiv.innerHTML = '' // strictly, don't remove it if already there
      mugshotDiv.appendChild(placeholder)
    } else {
      utils.syncTableToArray(mugshotDiv, images, elementForImage)
    }
  }

  // Good URI for a Camera picture
  function getImageDoc () {
    const imageDoc = kb.sym(
      subject.dir().uri + 'Image_' + Date.now() + '.png'
    )
    return imageDoc
  }
  // Store picture
  async function tookPicture (imageDoc) {
    if (imageDoc) {
      await linkToPicture(subject, imageDoc)
      syncMugshots()
    }
  }

  function trashCan () {
    const button = UI.widgets.button(
      dom,
      UI.icons.iconBase + 'noun_925021.svg',
      'Drag here to delete'
    )
    async function droppedURIHandler (uris) {
      const images = kb
        .each(subject, ns.vcard('hasPhoto'))
        .map(x => x.uri)
      for (const uri of uris) {
        if (!images.includes(uri)) {
          alert('Only drop images in this contact onto this trash can.')
          return
        }
        if (confirm(`Permanently DELETE image ${uri} completely?`)) {
          console.log('Unlinking image file ' + uri)
          await linkToPicture(subject, kb.sym(uri), true)
          try {
            console.log('Deleting image file ' + uri)
            await kb.fetcher.webOperation('DELETE', uri)
          } catch (err) {
            alert('Unable to delete picture! ' + err)
          }
        }
      }
      syncMugshots()
    }
    UI.widgets.makeDropTarget(button, droppedURIHandler, null)
    return button
  }

  function renderImageTools () {
    const imageToolTable = dom.createElement('table')
    const row = imageToolTable.appendChild(dom.createElement('tr'))
    const left = row.appendChild(dom.createElement('td'))
    const middle = row.appendChild(dom.createElement('td'))
    const right = row.appendChild(dom.createElement('td'))

    left.appendChild(
      UI.media.cameraButton(dom, kb, getImageDoc, tookPicture)
    ) // 20190812
    try {
      middle.appendChild(
        UI.widgets.fileUploadButtonDiv(dom, droppedFileHandler)
      )
    } catch (e) {
      console.log('ignore fileUploadButtonDiv error for now', e)
    }
    right.appendChild(trashCan())
    return imageToolTable
  }

  // Body of renderMugshotGallery

  const editable = kb.updater.editable(subject.doc().uri, kb) // @@ ToDo -- also check wac-allow
  const galleryDiv = dom.createElement('div')
  const mugshotDiv = galleryDiv.appendChild(dom.createElement('div'))
  var placeholder = elementForImage()
  UI.widgets.setImage(placeholder, subject) // Fallback icon or get from web
  syncMugshots()
  mugshotDiv.refresh = syncMugshots
  if (editable) {
    galleryDiv.appendChild(renderImageTools())
  }
  return galleryDiv
}
