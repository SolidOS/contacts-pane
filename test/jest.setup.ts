import '@testing-library/jest-dom'
import fetchMock from 'jest-fetch-mock'
import { TextEncoder, TextDecoder } from 'util'
import { toHaveNoViolations } from 'jest-axe'

// jest-axe's matcher has a slightly loose return type; cast to any to satisfy TS
expect.extend(toHaveNoViolations as any)

global.TextEncoder = TextEncoder as any
global.TextDecoder = TextDecoder as any

fetchMock.enableMocks()
