import { DataBrowserContext, LiveStore, PaneRegistry } from "pane-registry"
import { store, solidLogicSingleton } from "solid-ui"
import {longChatPane} from "chat-pane";

export const context: DataBrowserContext = {
  session: {
    store: store as LiveStore,
    paneRegistry: {
      byName: (name: string) => {
        return longChatPane
      }
    } as PaneRegistry,
    logic: solidLogicSingleton
  },
  dom: document,
  getOutliner: () => null
}

export const fetcher = store.fetcher