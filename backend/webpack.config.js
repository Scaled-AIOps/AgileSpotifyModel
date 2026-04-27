const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = (_env, argv) => {
  const isProd = argv.mode === 'production';
  return {
    target: 'node',
    mode: isProd ? 'production' : 'development',
    entry: './src/index.ts',
    devtool: isProd ? 'source-map' : 'inline-source-map',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'server.js',
      clean: true,
    },
    resolve: {
      extensions: ['.ts', '.js'],
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: { loader: 'ts-loader', options: { transpileOnly: false } },
          exclude: /node_modules/,
        },
      ],
    },
    externals: [nodeExternals()],
    optimization: {
      minimize: false,
    },
    stats: {
      errorDetails: true,
      modules: false,
      children: false,
      assets: true,
    },
    performance: { hints: false },
  };
};
