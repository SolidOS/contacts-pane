import {DataBrowserContext, PaneRegistry} from "pane-registry";
import { store } from "solid-ui";
import { solidLogicSingleton } from "solid-logic";
import {default as contactsPane } from "../contactsPane";
import { LiveStore } from "rdflib";

export const context: DataBrowserContext = {
  session: {
    store: store as LiveStore,
    paneRegistry: {
      byName: (name: string) => {
        return contactsPane
      }
    } as PaneRegistry,
    logic: solidLogicSingleton
  },
  dom: document,
  getOutliner: () => null,
};

export const fetcher = store.fetcher;
