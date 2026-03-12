import '@testing-library/jest-dom'
import fetchMock from 'jest-fetch-mock'
import { TextEncoder, TextDecoder } from 'util'
import { toHaveNoViolations } from 'jest-axe'

expect.extend(toHaveNoViolations)

global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

fetchMock.enableMocks()
