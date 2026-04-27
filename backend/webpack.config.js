/**
 * Purpose: Webpack configuration that bundles the backend into a single
 *          dist/server.js for production deployment.
 * Usage:   Invoked by `npm run build` (production) and `npm run build:dev`.
 *          Targets node, externalises everything in node_modules via
 *          webpack-node-externals so dependencies are referenced at runtime
 *          rather than bundled. Source maps are emitted in both modes.
 * Goal:    Replace tsc's tree of dist/*.js with one self-contained entry point
 *          so production only needs `node dist/server.js`. Config files
 *          (config/*.yaml + config/.env) are intentionally NOT bundled — the
 *          deploy pipeline mounts `config/` next to `dist/` at runtime.
 * ToDo:    Enable minification (`optimization.minimize: true`) and consider
 *          terser keep_classnames so the audit log's class names stay readable.
 */
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const nodeExternals = require('webpack-node-externals');

/**
 * Webpack plugin that emits dist/package.json with build-time metadata
 * (name, version, commitId, branch, buildTime). Read at runtime by the
 * /info endpoint.
 */
class BuildInfoPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('BuildInfoPlugin', (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: 'BuildInfoPlugin',
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
        },
        () => {
          const pkg = JSON.parse(
            fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'),
          );
          const safe = (cmd) => {
            try { return execSync(cmd, { cwd: __dirname, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); }
            catch { return ''; }
          };
          const commitId = process.env.GIT_COMMIT || safe('git rev-parse HEAD');
          const branch   = process.env.GIT_BRANCH || safe('git rev-parse --abbrev-ref HEAD');
          const info = {
            name: pkg.name,
            version: pkg.version,
            commitId,
            branch,
            buildTime: new Date().toISOString(),
          };
          const json = JSON.stringify(info, null, 2) + '\n';
          compilation.emitAsset(
            'package.json',
            new compiler.webpack.sources.RawSource(json),
          );
        },
      );
    });
  }
}

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
    plugins: [new BuildInfoPlugin()],
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
