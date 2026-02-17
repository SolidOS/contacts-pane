import path from 'path'
import TerserPlugin from 'terser-webpack-plugin'
import CopyPlugin from 'copy-webpack-plugin'

const common = {
  entry: './src/contactsPane.js',
  resolve: {
    extensions: ['.js'],
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.ttl$/i,
        type: 'asset/source'
      }
    ],
  },
  externals: {
    fs: 'null',
    'node-fetch': 'fetch',
    'isomorphic-fetch': 'fetch',
    'text-encoding': 'TextEncoder',
    '@trust/webcrypto': 'crypto',
    rdflib: {
      commonjs: 'rdflib',
      commonjs2: 'rdflib',
      amd: 'rdflib',
      root: '$rdf'
    },
    'solid-logic': {
      commonjs: 'solid-logic',
      commonjs2: 'solid-logic',
      amd: 'solid-logic',
      root: 'SolidLogic'
    },
    'solid-ui': {
      commonjs: 'solid-ui',
      commonjs2: 'solid-ui',
      amd: 'solid-ui',
      root: 'UI'
    }
  },
  devtool: 'source-map',
}

const normalConfig = {
  ...common,
  mode: 'production',
  output: {
    path: path.resolve(process.cwd(), 'dist'),
    filename: 'contactsPane.js',
    library: {
      type: 'umd',
      name: 'ContactsPane',
      export: 'default',
    },
    globalObject: 'globalThis',
    clean: true,
  },
  plugins: [
    ...(common.plugins || []),
    new CopyPlugin({
      patterns: [
        {
          from: path.resolve('src/styles'),
          to: path.resolve('dist/styles'),
        },
      ],
    }),
  ],
  optimization: {
    minimize: false,
  }
}

const minConfig = {
  ...common,
  mode: 'production',
  output: {
    path: path.resolve(process.cwd(), 'dist'),
    filename: 'contactsPane.min.js',
    library: {
      type: 'umd',
      name: 'ContactsPane',
      export: 'default',
    },
    globalObject: 'globalThis',
    clean: false,
  },
  plugins: [
    ...(common.plugins || []),
    new CopyPlugin({
      patterns: [
        {
          from: path.resolve('src/styles'),
          to: path.resolve('dist/styles'),
        },
      ],
    }),
  ],
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          format: {
            comments: false,
          },
        },
        extractComments: false,
      })
    ],
  }
}

export default [normalConfig, minConfig]
