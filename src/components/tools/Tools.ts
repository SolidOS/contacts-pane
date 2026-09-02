import { html, nothing } from 'lit'
import type { NamedNode } from 'rdflib'
import { state, property } from 'lit/decorators.js'
import { customElement, WebComponent } from 'solid-ui'

import { confirmDialog } from '../../localUtils'
import * as toolsLogic from '../../toolsLogic'
import * as debug from '../../debug'

import 'solid-ui/components/button'

import styles from './Tools.styles.css'

type Book = NamedNode
type SelectedGroups = Record<string, boolean>

interface Action {
  id: string
  label: string
  /** Receives the book already null-checked by the click handler. */
  run: (tools: Tools, book: Book) => unknown
}

/** The maintenance routines, in the order their buttons appear. */
const ACTIONS: Action[] = [
  {
    id: 'load-index',
    label: 'Load main index',
    run: (tools, book) => toolsLogic.loadMainIndex(book, tools.log)
  },
  {
    id: 'stats',
    label: 'Statistics',
    run: (tools, book) => toolsLogic.showStats(book, tools.selectedGroups, tools.log)
  },
  {
    id: 'check-access',
    label: 'Check individual contact access of selected groups',
    run: tools => toolsLogic.checkAccess(tools.selectedGroups, tools.log)
  },
  {
    id: 'find-duplicates',
    label: 'Find duplicate contacts',
    run: (tools, book) => toolsLogic.findDuplicates(book, tools.log, confirmDialog)
  },
  {
    id: 'find-groupless',
    label: 'Find contacts with no group',
    run: async (tools, book) => {
      await toolsLogic.findGroupless(book, tools.log)
      tools.log('Groupless list finished.')
    }
  },
  {
    id: 'fix-groupless',
    label: 'Put all individuals with no group in a new group',
    run: async (tools, book) => {
      const changed = await toolsLogic.fixGroupless(book, tools.log, confirmDialog)
      if (changed) {
        tools.dispatchEvent(new CustomEvent('groups-changed', { bubbles: true, composed: true }))
      }
    }
  }
]

/**
 * The Tools view of an address book: maintenance routines and the running log
 * of whichever one was picked. The routines themselves live in toolsLogic; the
 * component owns their buttons and the log they write to.
 */
@customElement('contacts-pane-tools')
export default class Tools extends WebComponent {
  static styles = styles

  @property({ attribute: false })
  accessor book: Book | null = null;

  @property({ attribute: false })
  accessor selectedGroups: SelectedGroups = {};

  @state()
  private accessor logLines: string[] = [];

  /** The routine whose output the log currently shows. */
  @state()
  private accessor activeAction: string | null = null;

  /** The routine that is still working, if any. */
  @state()
  private accessor runningAction: string | null = null;

  @state()
  private accessor failed = false;

  /** Bound once so the logic module can be handed a bare function. */
  readonly log = (message: string) => {
    this.logLines = [...this.logLines, message]
  }

  protected render () {
    return html`
      <h3>Tools</h3>
      <div class="statsLog">
        <pre aria-live="polite">${this.logLines.join('\n')}</pre>
      </div>
      <div class="buttons">
        ${ACTIONS.map(action => this.renderAction(action))}
      </div>
    `
  }

  private renderAction (action: Action) {
    const active = this.activeAction === action.id

    return html`
      <solid-ui-button
        variant=${active && !this.failed ? 'primary' : 'secondary'}
        ?loading=${this.runningAction === action.id}
        ?disabled=${this.runningAction !== null && this.runningAction !== action.id}
        @click=${() => this.onAction(action)}
      >${action.label}</solid-ui-button>
      ${active && this.failed
        ? html`<span class="sr-only" role="alert">${action.label} failed</span>`
        : nothing}
    `
  }

  private async onAction (action: Action) {
    if (this.runningAction || !this.book) return

    this.activeAction = action.id
    this.runningAction = action.id
    this.failed = false
    this.logLines = []

    try {
      await action.run(this, this.book)
    } catch (err) {
      debug.error('Tools action "' + action.id + '" failed. Stack: ' + err)
      this.failed = true
      this.log('Failed: ' + ((err as Error).message || err) + '. If it persists, contact your admin.')
    } finally {
      this.runningAction = null
    }
  }
}
