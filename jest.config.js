module.exports = {
  "verbose": true, // Turn on console.log

  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ["./jest.setup.ts"],
  transformIgnorePatterns: ["/node_modules/(?!lit-html).+\\.js"],

  testEnvironmentOptions: {
      customExportConditions: ['node']
}
};
