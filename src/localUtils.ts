import * as debug from './debug'
import * as UI from 'solid-ui'
import { store } from 'solid-logic'
import AlertModal from './components/alert-modal'
import ConfirmModal from './components/confirm-modal'

const kb = store
const ns = UI.ns

// ---------- Modal dialog helpers ----------
// Thin promise-returning wrappers over the solid-ui dialog stack, so callers
// can keep using `await confirmDialog(...)` without knowing about components.

// Alerts that are currently on screen, keyed by title + message. Callers such
// as handleURIsDroppedOnGroup report one failure per item, which would
// otherwise stack a separate dialog for each. The previous implementation reused a single
// overlay and so collapsed them; we keep that behaviour by handing back the
// promise of the alert that is already showing.
const openAlerts = new Map()

/**
 * Show an alert-style modal that has a single OK button.
 * Showing the same message while it is already on screen is a no-op: the
 * existing dialog stays, and every caller resolves when it is dismissed.
 * @param {string} message
 * @param {string} [title]
 * @returns {Promise<true>}
 */
export function alertDialog (message: string, title = 'Information'): Promise<true> {
  const key = JSON.stringify([title, message])
  const alreadyOpen = openAlerts.get(key)

  if (alreadyOpen) {
    return alreadyOpen
  }

  const shown = new Promise<true>(resolve => {
    UI.showDialog(AlertModal, {
      props: { message, title },
      onClose: () => {
        openAlerts.delete(key)
        resolve(true)
      }
    })
  })

  openAlerts.set(key, shown)

  return shown
}

/**
 * Show a confirm-style modal returning a boolean.
 * Dismissing the dialog (Escape, close button, backdrop) counts as a cancel.
 * @param {string} message
 * @param {string} [title]
 * @returns {Promise<boolean>}
 */
export function confirmDialog (message: string, title = 'Confirm'): Promise<boolean> {
  return new Promise(resolve => {
    UI.showDialog(ConfirmModal, {
      props: { message, title },
      onClose: result => resolve(result === true)
    })
  })
}

// ---------- end of modal helpers ----------

/**
 * Normalize group URIs to ensure consistent representation.
 * Groups should be referenced with fragment #this, e.g., ...Group/AnotherGroup.ttl#this
 * If a group URI ends with .ttl (without #this), add #this
 * @param {string} uri - The group URI to normalize
 * @returns {string} The normalized group URI
 */
export function normalizeGroupUri (uri: string) {
  if (uri && uri.endsWith('.ttl')) {
    return uri + '#this'
  }
  return uri
}

export function complain (div: any, d: any, message: string) {
  div.appendChild(UI.widgets.errorMessageBlock(d, message, 'pink'))
}

/**
 * Whether anyone on the web can read the thing's document.
 * Reads the ACL when we are allowed to (owners); otherwise falls back to
 * probing whether the document answers an unauthenticated request, which any
 * visitor can do. Resolves 'public' | 'private', or null when neither way
 * gives an answer.
 * @param {NamedNode} subject
 * @returns {Promise<'public' | 'private' | null>}
 */
export function documentVisibility (subject: any): Promise<'public' | 'private' | null> {
  const doc = subject.doc()
  return new Promise(resolve => {
    UI.acl.getACLorDefault(doc, (ok, exists, targetDoc: any, targetACLDoc: any, defaultHolder: any, defaultACLDoc: any) => {
      // Reading an ACL needs Control access; a visitor without it can still
      // learn the answer from the outside.
      if (!ok) return resolve(anonymousVisibility(doc))
      const ac = exists
        ? UI.acl.readACL(targetDoc, targetACLDoc, kb)
        : UI.acl.readACL(defaultHolder, defaultACLDoc, kb, true)
      const everyone = ac.agentClass[ns.foaf('Agent').uri]
      resolve(everyone && everyone[ns.acl('Read').uri] ? 'public' : 'private')
    })
  })
}

/** Public iff the document answers a request that carries no credentials. */
async function anonymousVisibility (doc: any): Promise<'public' | 'private' | null> {
  try {
    const response = await fetch(doc.uri, { method: 'HEAD', credentials: 'omit' })
    if (response.ok) return 'public'
    if (response.status === 401 || response.status === 403) return 'private'
    return null
  } catch (_e) {
    return null
  }
}

export function getSameAs (kb: any, item: any, doc: any) {
  return kb.each(item, ns.owl('sameAs'), null, doc).concat(
    kb.each(null, ns.owl('sameAs'), item, doc))
}
//  For deleting an addressbook sub-folder eg person - use with care!
// @@ move to solid-logic
export function deleteRecursive (kb: any, folder: any) {
  return new Promise<void>((resolve, reject) => {
    kb.fetcher.load(folder).then(() => {
      const promises = kb.each(folder, ns.ldp('contains')).map((file: any) => {
        if (kb.holds(file, ns.rdf('type'), ns.ldp('BasicContainer'))) {
          return deleteRecursive(kb, file)
        } else {
          debug.log('Recursive delete - we delete file ' + file.uri)
          return kb.fetcher.webOperation('DELETE', file.uri)
        }
      })
      debug.log('Recursive delete - we delete folder ' + folder.uri)
      promises.push(kb.fetcher.webOperation('DELETE', folder.uri))
      Promise.all(promises).then(_res => {
        resolve()
      }).catch(reject)
    }).catch(reject)
  })
}

// In a LDP work, deletes the whole document describing a thing
// plus patch out ALL mentiosn of it!    Use with care!
// beware of other data picked up from other places being smushed
// together and then deleted.
// Callers are responsible for confirming with the user first -- renderDeleteButton
// does that -- so this deletes without asking.
export async function deleteThingAndDoc (x: any) {
  debug.log('deleteThingAndDoc - to be deleted ' + x)
  // Statements in x's own document go down with it; only mentions elsewhere
  // (the indexes, group membership) need patching out.
  const ds = kb.statementsMatching(x)
    .concat(kb.statementsMatching(undefined, undefined, x))
    .filter((st: any) => !st.why.sameTerm(x.doc()))
  try {
    // Document first: if this fails, the thing is still intact everywhere.
    // The reverse order left invisible orphans -- gone from the indexes, but
    // still occupying storage.
    await kb.fetcher.delete(x.doc())
    await kb.updater.updateMany(ds)
    debug.log('deleteThingAndDoc - deleted')
  } catch (err) {
    debug.error('Error deleting ' + x + '. Stack: ' + err)
    throw new Error('An error occured while deleting.')
  }
}

export function compareForSort (self: any, other: any) {
  let s = nameFor(self)
  let o = nameFor(other)
  if (s && o) {
    s = s.toLowerCase()
    o = o.toLowerCase()
    if (s > o) return 1
    if (s < o) return -1
  }
  if (self.uri > other.uri) return 1
  if (self.uri < other.uri) return -1
  return 0
}

// organization-name is a hack for Mac records with no FN which is mandatory.
export function nameFor (x: any) {
  const name =
    kb.any(x, ns.vcard('fn')) ||
    kb.any(x, ns.foaf('name')) ||
    kb.any(x, ns.vcard('organization-name'))
  return name ? name.value : '???'
}

/**
 * Prevent keyboard tabbing into labels/label-like links created by rdflib/solid-ui forms.
 * @param {HTMLElement} root
 */
export function skipLabelsFromTabbing (root: any) {
  // Many Solid-UI forms render field labels as focusable links (hrefs).
  // Make sure keyboard tabbing skips these label links entirely.
  const selectors = [
    'label',
    '.formFieldName a',
    '.classifierBox-label a',
    '.choiceBox-label a',
    '.label a',
    // Skip focusable label-like links created by Solid-UI forms, including the vcard note link
    'a[href="http://www.w3.org/2006/vcard/ns#note"]',
    'a[href$="#note"]',
  ].join(', ')

  // Some environments have NodeLists without forEach (e.g., older Safari).
  const nodes = root?.querySelectorAll?.(selectors)
  if (!nodes) return

  Array.from(nodes).forEach((el: any) => {
    // Some browsers may return null for tabIndex, and some elements may not
    // expose tabIndex at all (e.g., SVG elements), so guard before setting.
    if (typeof el.tabIndex === 'number' && el.tabIndex !== -1) {
      el.tabIndex = -1
    }
    // Ensure those label links are not announced as focusable elements
    if (el.getAttribute('aria-hidden') !== 'true') {
      el.setAttribute('aria-hidden', 'true')
    }
  })
}

export function isAWebID (subject: any) {
  const t = kb.findTypeURIs(subject.doc())
  return !!t[ns.foaf('PersonalProfileDocument').uri]
}

// Make the layout stack vertically when the containing pane gets narrow
export function setupResponsiveStacking (paneDiv: any, breakpoint = 900) {
  function updateResponsiveState () {
    const width = paneDiv.getBoundingClientRect().width
    const paneNarrow = width > 0 ? width <= breakpoint : false
    const viewportNarrow = (typeof window !== 'undefined' && typeof window.matchMedia === 'function')
      ? window.matchMedia('(max-width: ' + breakpoint + 'px)').matches
      : false
    const isNarrow = width > 0 ? paneNarrow : viewportNarrow

    if (width > 0) {
      paneDiv.dataset.paneWidth = Math.round(width).toString()
      paneDiv.dataset.paneNarrow = paneNarrow ? 'true' : 'false'
    } else {
      // If not inserted yet, apply viewport mode until placed.
      paneDiv.dataset.paneWidth = '0'
      paneDiv.dataset.paneNarrow = viewportNarrow ? 'true' : 'false'
    }

    paneDiv.classList.toggle('contactPane--narrow', isNarrow)
    paneDiv.dataset.viewportNarrow = viewportNarrow ? 'true' : 'false'

    // On desktop the pane fills the viewport below whatever sits above it
    // (the data browser's header) and no more; the columns scroll inside.
    // Narrow layouts stack and let the page scroll instead.
    if (!isNarrow && typeof window !== 'undefined' && paneDiv.isConnected) {
      const top = Math.max(0, paneDiv.getBoundingClientRect().top)
      // Page overflow that remains once the pane is viewport-sized comes
      // from the chrome around it (the outline table's borders, a footer).
      // Remember it and leave it room, else the page scrolls by that much.
      // Capped: unexpectedly tall surroundings must not crush the pane.
      const docEl = paneDiv.ownerDocument.documentElement
      if (paneDiv.style.getPropertyValue('--pane-max-height') !== '') {
        const overflow = docEl.scrollHeight - window.innerHeight
        if (overflow > 0) {
          paneDiv.__paneHeightTrim = Math.min(200, (paneDiv.__paneHeightTrim || 0) + overflow)
        }
      }
      const available = Math.max(320, window.innerHeight - top - (paneDiv.__paneHeightTrim || 0))
      paneDiv.style.setProperty('--pane-max-height', available + 'px')
    } else {
      paneDiv.style.removeProperty('--pane-max-height')
    }

    return isNarrow
  }

  // Debounce utility
  function debounce (fn: (...args: any[]) => void, delay: number) {
    let timer: any = null
    return function (this: any, ...args: any[]) {
      clearTimeout(timer)
      timer = setTimeout(() => fn.apply(this, args), delay)
    }
  }

  const debouncedUpdate = debounce(() => {
    updateResponsiveState()
  }, 100)

  const resizeObserverAvailable = typeof ResizeObserver !== 'undefined'
  if (resizeObserverAvailable) {
    const ro = new ResizeObserver(() => {
      debouncedUpdate()
    })
    ro.observe(paneDiv)
    // Referenced from the element so the observer cannot be collected while
    // the pane lives.
    paneDiv.__responsiveObserver = ro
  }

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('resize', debouncedUpdate)
  }

  // Initial state
  function ensureInitialUpdate () {
    // Call both updaters for their side effects (setting dataset attributes).
    // Return values are intentionally discarded — ESLint-safe.
    updateResponsiveState()
    // If we are not in the document yet, re-run until connected
    if (!paneDiv.isConnected) {
      requestAnimationFrame(ensureInitialUpdate)
    } else {
      // Connected, but typically not laid out yet: the first run sees width
      // 0 and guesses from the viewport. Settle on real measurements once
      // layout and the async render have had a chance to happen.
      for (const delay of [0, 250, 1000]) {
        setTimeout(updateResponsiveState, delay)
      }
    }
  }

  ensureInitialUpdate()
}
