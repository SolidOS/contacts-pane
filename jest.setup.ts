import '@testing-library/jest-dom'
import fetchMock from 'jest-fetch-mock'
import { TextEncoder, TextDecoder } from 'util'

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock external dependencies that solid-logic expects
jest.mock('$rdf', () => require('rdflib'), { virtual: true })

fetchMock.enableMocks();




