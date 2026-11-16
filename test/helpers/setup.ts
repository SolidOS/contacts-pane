import { TextDecoder, TextEncoder } from 'node:util'
import { enableFetchMocks, mockFetchIf } from './fetch-mock'
import { mockFetchFunction } from '../unit/setup'

Object.defineProperty(globalThis, 'TextEncoder', {
  value: TextEncoder,
  configurable: true,
  writable: true,
})

Object.defineProperty(globalThis, 'TextDecoder', {
  value: TextDecoder,
  configurable: true,
  writable: true,
})

enableFetchMocks()
mockFetchIf(/^https?.*$/, mockFetchFunction)

// jsdom's ElementInternals lacks the form-association API that solid-ui's
// FormControlTrait relies on, so any test mounting a solid-ui form control
// (e.g. solid-ui-input) explodes without these no-ops.
const internals = (globalThis as any).ElementInternals?.prototype
if (internals && !internals.setFormValue) {
  internals.setFormValue = () => {}
  internals.setValidity = () => {}
}
