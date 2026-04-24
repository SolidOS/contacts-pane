import { default as contactsPane } from '../src/contactsPane'
import { default as profilePane } from '../../profile-pane/src/index'
import { longChatPane } from '../../chat-pane/src/longChatPane'
import { DataBrowserContext, PaneRegistry } from 'pane-registry'
import { solidLogicSingleton, store } from 'solid-logic'
import { LiveStore } from 'rdflib'

function unsupportedPane (name: string) {
  return {
    name: `missing:${name}`,
    label: () => `Missing pane: ${name}`,
    render: (_subject, context) => {
      const warning = context.dom.createElement('div')
      warning.style.padding = '1rem'
      warning.style.margin = '1rem 0'
      warning.style.border = '1px solid #c33'
      warning.style.background = '#fff4f4'
      warning.style.color = '#700'
      warning.textContent = `Pane not registered in contacts-pane dev context: ${name}`
      return warning
    }
  }
}

// Configure fetcher for development
if (store.fetcher) {
  // Configure for cross-origin requests
  (store.fetcher as any).crossSite = true;
  (store.fetcher as any).withCredentials = false;
}

export const context: DataBrowserContext = {
  session: {
    store: store as LiveStore,
    paneRegistry: {
      byName: (name: string) => {
        switch (name) {
        case 'contact':
          return contactsPane
        case 'profile':
          return profilePane
        case 'long chat':
          return longChatPane
        default:
          return unsupportedPane(name)
        }
      }
    } as PaneRegistry,
    logic: solidLogicSingleton
  },
  dom: document,
  getOutliner: () => null,
}

export const fetcher = store.fetcher
