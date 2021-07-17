module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  settings: {
    react: {
      version: "detect",
    },
  },
  rules: {
    "no-undef":  ["warn"],
    "no-unused-vars": ["warn", {
    argsIgnorePattern: "^_",
    varsIgnorePattern: "^_"
    }],
    "@typescript-eslint/no-var-requires": ["warn"],
    "@typescript-eslint/no-this-alias": ["warn"]
  }
};


