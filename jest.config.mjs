export default {
  // verbose: true, // Uncomment for detailed test output
  collectCoverage: true,
  coverageDirectory: 'coverage',
  testEnvironment: 'jsdom',
  testEnvironmentOptions: {
    customExportConditions: ['node'],
  },
  transform: {
    '^.+\\.[tj]sx?$': ['babel-jest', { configFile: './babel.config.mjs' }],
  },
  // Some npm packages publish ESM sources. By default Jest will NOT transform
  // files in node_modules which causes syntax errors like "import ..." here.
  // Allow transforming mime-types and mime-db so Babel can compile them for tests.
  transformIgnorePatterns: ['/node_modules/(?!(mime-types|mime-db)/)'],
  setupFilesAfterEnv: ['./test/jest.setup.ts'],
  testMatch: ['**/test/**/*.test.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  roots: ['<rootDir>/src', '<rootDir>/test'],
  moduleNameMapper: {
    '^SolidLogic$': 'solid-logic',
    '^\\$rdf$': 'rdflib'
  },
}
