import NodePolyfillPlugin from 'node-polyfill-webpack-plugin'
import path from 'path'

export default [
  {
    mode: "production",
    entry: {
      contactsPane: "./src/contactsPane.js",
      contactLogic: "./src/contactLogic.js", 
      groupMembershipControl: "./src/groupMembershipControl.js",
      individual: "./src/individual.js",
      mintNewAddressBook: "./src/mintNewAddressBook.js",
      mugshotGallery: "./src/mugshotGallery.js", 
      toolsPane: "./src/toolsPane.js",
      webidControl: "./src/webidControl.js"
    },
    output: {
      path: path.resolve(process.cwd(), 'dist'),
      filename: '[name].js',
      library: {
        name: '[name]',
        type: 'umd'
      },
      globalObject: 'this',
      clean: false
    },
    plugins: [
      new NodePolyfillPlugin()
    ],
    module: {
      rules: [
        {
          test: /\.(js|ts)$/,
          exclude: /node_modules/,
          use: ["babel-loader"],
        },
        {
          test: /\.ttl$/, // Target text  files
          type: 'asset/source', // Load the file's content as a string
        }
      ],
    },
    resolve: {
      extensions: [".js", ".ts", ".ttl"]
    },
    devServer: {
      static: './dist'
    },
    devtool: "source-map",
  },
]

