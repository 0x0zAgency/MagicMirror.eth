'use strict';

const fs = require('node:fs');
const path = require('node:path');
const webpack = require('webpack');
const resolve = require('resolve');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CaseSensitivePathsPlugin = require('case-sensitive-paths-webpack-plugin');
const InlineChunkHtmlPlugin = require('react-dev-utils/InlineChunkHtmlPlugin');
const TerserPlugin = require('terser-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const { WebpackManifestPlugin } = require('webpack-manifest-plugin');
const InterpolateHtmlPlugin = require('react-dev-utils/InterpolateHtmlPlugin');
const WorkboxWebpackPlugin = require('workbox-webpack-plugin');
const ModuleScopePlugin = require('react-dev-utils/ModuleScopePlugin');
const getCSSModuleLocalIdent = require('react-dev-utils/getCSSModuleLocalIdent');
const ESLintPlugin = require('eslint-webpack-plugin');
const ModuleNotFoundPlugin = require('react-dev-utils/ModuleNotFoundPlugin');
const paths = require('./paths');
const modules = require('./modules');
const getClientEnvironment = require('./env');
const ForkTsCheckerWebpackPlugin =
	process.env.TSC_COMPILE_ON_ERROR === 'true'
		? require('react-dev-utils/ForkTsCheckerWarningWebpackPlugin')
		: require('react-dev-utils/ForkTsCheckerWebpackPlugin');
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');

const createEnvironmentHash = require('./webpack/persistentCache/createEnvironmentHash');

// Source maps are resource heavy and can cause out of memory issue for large source files.
const shouldUseSourceMap = process.env.GENERATE_SOURCEMAP !== 'false';

const reactRefreshRuntimeEntry = require.resolve('react-refresh/runtime');
const reactRefreshWebpackPluginRuntimeEntry = require.resolve(
	'@pmmmwh/react-refresh-webpack-plugin'
);
const babelRuntimeEntry = require.resolve('babel-preset-react-app');
const babelRuntimeEntryHelpers = require.resolve(
	'@babel/runtime/helpers/esm/assertThisInitialized',
	{ paths: [babelRuntimeEntry] }
);
const babelRuntimeRegenerator = require.resolve('@babel/runtime/regenerator', {
	paths: [babelRuntimeEntry],
});

// Some apps do not need the benefits of saving a web request, so not inlining the chunk
// Makes for a smoother build process.
const shouldInlineRuntimeChunk = process.env.INLINE_RUNTIME_CHUNK !== 'false';

const emitErrorsAsWarnings = process.env.ESLINT_NO_DEV_ERRORS === 'true';
const disableESLintPlugin = process.env.DISABLE_ESLINT_PLUGIN === 'true';

const imageInlineSizeLimit = Number.parseInt(
	process.env.IMAGE_INLINE_SIZE_LIMIT || '10000'
);

// Check if TypeScript is setup
const useTypeScript = fs.existsSync(paths.appTsConfig);

// Check if Tailwind config exists
const useTailwind = fs.existsSync(
	path.join(paths.appPath, 'tailwind.config.js')
);

// Get the path to the uncompiled service worker (if it exists).
const swSrc = paths.swSrc;

// Style files regexes
const cssRegex = /\.css$/;
const cssModuleRegex = /\.module\.css$/;
const sassRegex = /\.(scss|sass)$/;
const sassModuleRegex = /\.module\.(scss|sass)$/;

const hasJsxRuntime = (() => {
	if (process.env.DISABLE_NEW_JSX_TRANSFORM === 'true') {
		return false;
	}

	try {
		require.resolve('react/jsx-runtime');
		return true;
	} catch {
		return false;
	}
})();

// This is the production and development configuration.
// It is focused on developer experience, fast rebuilds, and a minimal bundle.
module.exports = function (webpackEnv) {
	const isEnvDevelopment = webpackEnv === 'development';
	const isEnvProduction = webpackEnv === 'production';

	// Variable used for enabling profiling in Production
	// Passed into alias object. Uses a flag if passed into the build command
	const isEnvProductionProfile =
		isEnvProduction && process.argv.includes('--profile');

	// We will provide `paths.publicUrlOrPath` to our app
	// As %PUBLIC_URL% in `index.html` and `process.env.PUBLIC_URL` in JavaScript.
	// Omit trailing slash as %PUBLIC_URL%/xyz looks better than %PUBLIC_URL%xyz.
	// Get environment variables to inject into our app.
	const env = getClientEnvironment(paths.publicUrlOrPath.slice(0, -1));

	const shouldUseReactRefresh = env.raw.FAST_REFRESH;

	// Common function to get style loaders
	const getStyleLoaders = (cssOptions, preProcessor) => {
		const loaders = [
			isEnvDevelopment && require.resolve('style-loader'),
			{
				loader: MiniCssExtractPlugin.loader || 'style-loader',
			},
			{
				loader: require.resolve('css-loader'),
				options: { ...cssOptions, import: true },
			},
			{
				// Options for PostCSS as we reference these options twice
				// Adds vendor prefixing based on your specified browser support in
				// Package.json
				loader: require.resolve('postcss-loader'),
				options: {
					postcssOptions: {
						// Necessary for external CSS imports to work
						// https://github.com/facebook/create-react-app/issues/2677
						ident: 'postcss',
						config: true,
						plugins: !useTailwind
							? [
									'postcss-flexbugs-fixes',
									[
										'postcss-preset-env',
										{
											autoprefixer: {
												flexbox: 'no-2009',
											},
											stage: 3,
										},
									],
									// Adds PostCSS Normalize as the reset css with default options,
									// So that it honors browserslist config in package.json
									// Which in turn let's users customize the target behavior as per their needs.
									'postcss-normalize',
							  ]
							: [
									'tailwindcss',
									'postcss-flexbugs-fixes',
									[
										'postcss-preset-env',
										{
											autoprefixer: {
												flexbox: 'no-2009',
											},
											stage: 3,
										},
									],
							  ],
					},
					sourceMap: isEnvProduction ? shouldUseSourceMap : isEnvDevelopment,
				},
			},
		].filter(Boolean);
		if (preProcessor) {
			loaders.push(
				{
					loader: require.resolve('resolve-url-loader'),
					options: {
						sourceMap: isEnvProduction ? shouldUseSourceMap : isEnvDevelopment,
						root: paths.appSrc,
					},
				},
				{
					loader: require.resolve(preProcessor),
					options: {
						sourceMap: true,
					},
				}
			);
		}

		return loaders;
	};

	return {
		target: ['browserslist'],
		// Webpack noise constrained to errors and warnings
		stats: 'errors-warnings',
		mode: isEnvProduction ? 'production' : isEnvDevelopment && 'development',
		// Stop compilation early in production
		bail: isEnvProduction,
		devtool: isEnvProduction
			? shouldUseSourceMap
				? 'source-map'
				: false
			: isEnvDevelopment && 'cheap-module-source-map',
		// These are the "entry points" to our application.
		// This means they will be the "root" imports that are included in JS bundle.
		entry: paths.appIndexJs,
		output: {
			// The build folder.
			path: paths.appBuild,
			// Add /* filename */ comments to generated require()s in the output.
			pathinfo: isEnvDevelopment,
			// There will be one main bundle, and one file per asynchronous chunk.
			// In development, it does not produce real files.
			filename: isEnvProduction
				? 'static/js/[name].[contenthash:8].js'
				: isEnvDevelopment && 'static/js/bundle.js',
			// There are also additional JS chunk files if you use code splitting.
			chunkFilename: isEnvProduction
				? 'static/js/[name].[contenthash:8].chunk.js'
				: isEnvDevelopment && 'static/js/[name].chunk.js',
			assetModuleFilename: 'static/media/[name].[hash][ext]',
			// Webpack uses `publicPath` to determine where the app is being served from.
			// It requires a trailing slash, or the file assets will get an incorrect path.
			// We inferred the "public path" (such as / or /my-project) from homepage.
			publicPath: paths.publicUrlOrPath,
			// Point sourcemap entries to original disk location (format as URL on Windows)
			devtoolModuleFilenameTemplate: isEnvProduction
				? (info) =>
						path
							.relative(paths.appSrc, info.absoluteResourcePath)
							.replace(/\\/g, '/')
				: isEnvDevelopment &&
				  ((info) =>
						path.resolve(info.absoluteResourcePath).replace(/\\/g, '/')),
		},
		cache: {
			type: 'filesystem',
			version: createEnvironmentHash(env.raw),
			cacheDirectory: paths.appWebpackCache,
			store: 'pack',
			buildDependencies: {
				defaultWebpack: ['webpack/lib/'],
				config: [__filename],
				tsconfig: [paths.appTsConfig, paths.appJsConfig].filter((f) =>
					fs.existsSync(f)
				),
			},
		},
		infrastructureLogging: {
			level: 'none',
		},
		optimization: {
			minimize: isEnvProduction,
			minimizer: [
				// This is only used in production mode
				new TerserPlugin({
					terserOptions: {
						parse: {
							// We want terser to parse ecma 8 code. However, we don't want it
							// To apply any minification steps that turns valid ecma 5 code
							// Into invalid ecma 5 code. This is why the 'compress' and 'output'
							// Sections only apply transformations that are ecma 5 safe
							// https://github.com/facebook/create-react-app/pull/4234
							ecma: 8,
						},
						compress: {
							ecma: 5,
							warnings: false,
							// Disabled because of an issue with Uglify breaking seemingly valid code:
							// https://github.com/facebook/create-react-app/issues/2376
							// Pending further investigation:
							// https://github.com/mishoo/UglifyJS2/issues/2011
							comparisons: false,
							// Disabled because of an issue with Terser breaking valid code:
							// https://github.com/facebook/create-react-app/issues/5250
							// Pending further investigation:
							// https://github.com/terser-js/terser/issues/120
							inline: 2,
						},
						mangle: {
							safari10: true,
						},
						// Added for profiling in devtools
						keep_classnames: isEnvProductionProfile,
						keep_fnames: isEnvProductionProfile,
						output: {
							ecma: 5,
							comments: false,
							// Turned on because emoji and regex is not minified properly using default
							// https://github.com/facebook/create-react-app/issues/2488
							ascii_only: true,
						},
					},
				}),
				// This is only used in production mode
				new CssMinimizerPlugin(),
			],
		},
		resolve: {
			// This allows you to set a fallback for where webpack should look for modules.
			// We placed these paths second because we want `node_modules` to "win"
			// If there are any conflicts. This matches Node resolution mechanism.
			// https://github.com/facebook/create-react-app/issues/253
			modules: ['node_modules', paths.appNodeModules].concat(
				modules.additionalModulePaths || []
			),
			// These are the reasonable defaults supported by the Node ecosystem.
			// We also include JSX as a common component filename extension to support
			// Some tools, although we do not recommend using it, see:
			// https://github.com/facebook/create-react-app/issues/290
			// `web` extension prefixes have been added for better support
			// For React Native Web.
			extensions: paths.moduleFileExtensions
				.map((ext) => `.${ext}`)
				.filter((ext) => useTypeScript || !ext.includes('ts')),
			alias: {
				// Support React Native Web
				// https://www.smashingmagazine.com/2016/08/a-glimpse-into-the-future-with-react-native-for-web/
				'react-native': 'react-native-web',
				// Allows for better profiling with ReactDevTools
				...(isEnvProductionProfile && {
					'react-dom$': 'react-dom/profiling',
					'scheduler/tracing': 'scheduler/tracing-profiling',
				}),
				...modules.webpackAliases,
				...JSON.parse(
					fs.readFileSync(paths.appPackageJson, { encoding: 'utf-8' })
				)._moduleAliases,
			},
			fallback: {
				path: require.resolve('path-browserify'),
				crypto: require.resolve('crypto-browserify'),
				http: require.resolve('http-browserify'),
				https: require.resolve('https-browserify'),
				stream: require.resolve('stream-http'),
				os: require.resolve('os-browserify/browser'),
				// Webpack > 5 does not polyfill core node modules.
				// Events: require.resolve('events/') || false,
				buffer: require.resolve('buffer'),
				'process/browser': require.resolve('process/browser')
			},
			plugins: [
				// Prevents users from importing files from outside of src/ (or node_modules/).
				// This often causes confusion because we only process files within src/ with babel.
				// To fix this, we prevent you from importing files out of src/ -- if you'd like to,
				// Please link the files into your node_modules/ and let module-resolution kick in.
				// Make sure your source files are compiled, as they will not be processed in any way.
				new ModuleScopePlugin(paths.appSrc, [
					paths.appPackageJson,
					reactRefreshRuntimeEntry,
					reactRefreshWebpackPluginRuntimeEntry,
					babelRuntimeEntry,
					babelRuntimeEntryHelpers,
					babelRuntimeRegenerator,
				]),
			],
		},
		module: {
			strictExportPresence: true,
			rules: [
				// Handle node_modules packages that contain sourcemaps
				{
					test: /\.js$/,
					enforce: 'pre',
					use: ['source-map-loader'],
				},
				{
					// "oneOf" will traverse all following loaders until one will
					// Match the requirements. When no loader matches it will fall
					// Back to the "file" loader at the end of the loader list.
					oneOf: [
						// TODO: Merge this config once `image/avif` is in the mime-db
						// https://github.com/jshttp/mime-db
						{
							test: [/\.avif$/],
							type: 'asset',
							mimetype: 'image/avif',
							parser: {
								dataUrlCondition: {
									maxSize: imageInlineSizeLimit,
								},
							},
						},
						// "url" loader works like "file" loader except that it embeds assets
						// Smaller than specified limit in bytes as data URLs to avoid requests.
						// A missing `test` is equivalent to a match.
						{
							test: [/\.bmp$/, /\.gif$/, /\.jpe?g$/, /\.png$/],
							type: 'asset',
							parser: {
								dataUrlCondition: {
									maxSize: imageInlineSizeLimit,
								},
							},
						},
						{
							test: /\.svg$/,
							use: [
								{
									loader: require.resolve('@svgr/webpack'),
									options: {
										prettier: false,
										svgo: false,
										svgoConfig: {
											plugins: [{ removeViewBox: false }],
										},
										titleProp: true,
										ref: true,
									},
								},
								{
									loader: require.resolve('file-loader'),
									options: {
										name: 'static/media/[name].[hash].[ext]',
									},
								},
							],
							issuer: {
								and: [/\.(ts|tsx|js|jsx|md|mdx)$/],
							},
						},
						// Process application JS with Babel.
						// The preset includes JSX, Flow, TypeScript, and some ESnext features.
						{
							test: /\.(js|mjs|jsx|ts|tsx)$/,
							include: paths.appSrc,
							loader: require.resolve('babel-loader'),
							options: {
								customize: require.resolve(
									'babel-preset-react-app/webpack-overrides'
								),
								presets: [
									[
										require.resolve('babel-preset-react-app'),
										{
											runtime: hasJsxRuntime ? 'automatic' : 'classic',
										},
									],
								],

								plugins: [
									isEnvDevelopment &&
										shouldUseReactRefresh &&
										require.resolve('react-refresh/babel'),
								].filter(Boolean),
								// This is a feature of `babel-loader` for webpack (not Babel itself).
								// It enables caching results in ./node_modules/.cache/babel-loader/
								// Directory for faster rebuilds.
								cacheDirectory: true,
								// See #6846 for context on why cacheCompression is disabled
								cacheCompression: false,
								compact: isEnvProduction,
							},
						},
						// Process any JS outside of the app with Babel.
						// Unlike the application JS, we only compile the standard ES features.
						{
							test: /\.(js|mjs)$/,
							exclude: /@babel(?:\/|\\{1,2})runtime/,
							loader: require.resolve('babel-loader'),
							options: {
								babelrc: false,
								configFile: false,
								compact: false,
								presets: [
									[
										require.resolve('babel-preset-react-app/dependencies'),
										{ helpers: true },
									],
								],
								cacheDirectory: true,
								// See #6846 for context on why cacheCompression is disabled
								cacheCompression: false,

								// Babel sourcemaps are needed for debugging into node_modules
								// Code.  Without the options below, debuggers like VSCode
								// Show incorrect code and set breakpoints on the wrong lines.
								sourceMaps: shouldUseSourceMap,
								inputSourceMap: shouldUseSourceMap,
							},
						},
						// "postcss" loader applies autoprefixer to our CSS.
						// "css" loader resolves paths in CSS and adds assets as dependencies.
						// "style" loader turns CSS into JS modules that inject <style> tags.
						// In production, we use MiniCSSExtractPlugin to extract that CSS
						// To a file, but in development "style" loader enables hot editing
						// Of CSS.
						// By default we support CSS Modules with the extension .module.css
						{
							test: cssRegex,
							exclude: cssModuleRegex,
							use: getStyleLoaders({
								importLoaders: 1,
								sourceMap: isEnvProduction
									? shouldUseSourceMap
									: isEnvDevelopment,
								modules: {
									mode: 'icss',
								},
							}),
							// Don't consider CSS imports dead code even if the
							// Containing package claims to have no side effects.
							// Remove this when webpack adds a warning or an error for this.
							// See https://github.com/webpack/webpack/issues/6571
						},
						// Adds support for CSS Modules (https://github.com/css-modules/css-modules)
						// Using the extension .module.css
						{
							test: cssModuleRegex,
							use: getStyleLoaders({
								importLoaders: 1,
								sourceMap: isEnvProduction
									? shouldUseSourceMap
									: isEnvDevelopment,
								modules: {
									mode: 'local',
									getLocalIdent: getCSSModuleLocalIdent,
								},
							}),
						},
						// Opt-in support for SASS (using .scss or .sass extensions).
						// By default we support SASS Modules with the
						// Extensions .module.scss or .module.sass
						{
							test: sassRegex,
							exclude: sassModuleRegex,
							use: getStyleLoaders(
								{
									importLoaders: 3,
									sourceMap: isEnvProduction
										? shouldUseSourceMap
										: isEnvDevelopment,
									modules: {
										mode: 'icss',
									},
								},
								'sass-loader'
							),
							// Don't consider CSS imports dead code even if the
							// Containing package claims to have no side effects.
							// Remove this when webpack adds a warning or an error for this.
							// See https://github.com/webpack/webpack/issues/6571
							sideEffects: true,
						},
						// Adds support for CSS Modules, but using SASS
						// Using the extension .module.scss or .module.sass
						{
							test: sassModuleRegex,
							use: getStyleLoaders(
								{
									importLoaders: 3,
									sourceMap: isEnvProduction
										? shouldUseSourceMap
										: isEnvDevelopment,
									modules: {
										mode: 'local',
										getLocalIdent: getCSSModuleLocalIdent,
									},
								},
								'sass-loader'
							),
						},
						// "file" loader makes sure those assets get served by WebpackDevServer.
						// When you `import` an asset, you get its (virtual) filename.
						// In production, they would get copied to the `build` folder.
						// This loader doesn't use a "test" so it will catch all modules
						// That fall through the other loaders.
						{
							// Exclude `js` files to keep "css" loader working as it injects
							// Its runtime that would otherwise be processed through "file" loader.
							// Also exclude `html` and `json` extensions so they get processed
							// By webpacks internal loaders.
							exclude: [/^$/, /\.(js|mjs|jsx|ts|tsx)$/, /\.html$/, /\.json$/],
							type: 'asset/resource',
						},
						// ** STOP ** Are you adding a new loader?
						// Make sure to add the new loader(s) before the "file" loader.
					],
				},
			].filter(Boolean),
		},
		ignoreWarnings: [/Failed to parse source map/],
		plugins: [
			new MiniCssExtractPlugin(),
			// Generates an `index.html` file with the <script> injected.
			new HtmlWebpackPlugin(
				Object.assign(
					{},
					{
						inject: true,
						template: paths.appHtml,
					},
					isEnvProduction
						? {
								minify: {
									removeComments: true,
									collapseWhitespace: true,
									removeRedundantAttributes: true,
									useShortDoctype: true,
									removeEmptyAttributes: true,
									removeStyleLinkTypeAttributes: true,
									keepClosingSlash: true,
									minifyJS: true,
									minifyCSS: true,
									minifyURLs: true,
								},
						  }
						: undefined
				)
			),
			// Inlines the webpack runtime script. This script is too small to warrant
			// A network request.
			// https://github.com/facebook/create-react-app/issues/5358
			isEnvProduction &&
				shouldInlineRuntimeChunk &&
				new InlineChunkHtmlPlugin(HtmlWebpackPlugin, [/runtime-.+\.js/]),
			// Makes some environment variables available in index.html.
			// The public URL is available as %PUBLIC_URL% in index.html, e.g.:
			// <link rel="icon" href="%PUBLIC_URL%/favicon.ico">
			// It will be an empty string unless you specify "homepage"
			// In `package.json`, in which case it will be the pathname of that URL.
			new InterpolateHtmlPlugin(HtmlWebpackPlugin, env.raw),
			// This gives some necessary context to module not found errors, such as
			// The requesting resource.
			new ModuleNotFoundPlugin(paths.appPath),
			// Makes some environment variables available to the JS code, for example:
			// If (process.env.NODE_ENV === 'production') { ... }. See `./env.js`.
			// It is absolutely essential that NODE_ENV is set to production
			// During a production build.
			// Otherwise React will be compiled in the very slow development mode.
			new webpack.DefinePlugin(env.stringified),
			// Experimental hot reloading for React .
			// https://github.com/facebook/react/tree/main/packages/react-refresh
			isEnvDevelopment &&
				shouldUseReactRefresh &&
				new ReactRefreshWebpackPlugin({
					overlay: false,
				}),
			// Watcher doesn't work well if you mistype casing in a path so we use
			// A plugin that prints an error when you attempt to do this.
			// See https://github.com/facebook/create-react-app/issues/240
			isEnvDevelopment && new CaseSensitivePathsPlugin(),
			isEnvProduction &&
				new MiniCssExtractPlugin({
					// Options similar to the same options in webpackOptions.output
					// Both options are optional
					filename: 'static/css/[name].[contenthash:8].css',
					chunkFilename: 'static/css/[name].[contenthash:8].chunk.css',
				}),
			// Generate an asset manifest file with the following content:
			// - "files" key: Mapping of all asset filenames to their corresponding
			//   Output file so that tools can pick it up without having to parse
			//   `index.html`
			// - "entrypoints" key: Array of files which are included in `index.html`,
			//   Can be used to reconstruct the HTML if necessary
			new WebpackManifestPlugin({
				fileName: 'asset-manifest.json',
				publicPath: paths.publicUrlOrPath,
				generate(seed, files, entrypoints) {
					const manifestFiles = files.reduce((manifest, file) => {
						manifest[file.name] = file.path;
						return manifest;
					}, seed);
					const entrypointFiles = entrypoints.main.filter(
						(fileName) => !fileName.endsWith('.map')
					);

					return {
						files: manifestFiles,
						entrypoints: entrypointFiles,
					};
				},
			}),
			// Moment.js is an extremely popular library that bundles large locale files
			// By default due to how webpack interprets its code. This is a practical
			// Solution that requires the user to opt into importing specific locales.
			// https://github.com/jmblog/how-to-optimize-momentjs-with-webpack
			// You can remove this if you don't use Moment.js:
			new webpack.IgnorePlugin({
				resourceRegExp: /^\.\/locale$/,
				contextRegExp: /moment$/,
			}),
			// Generate a service worker script that will precache, and keep up to date,
			// The HTML & assets that are part of the webpack build.
			isEnvProduction &&
				fs.existsSync(swSrc) &&
				new WorkboxWebpackPlugin.InjectManifest({
					swSrc,
					dontCacheBustURLsMatching: /\.[\da-f]{8}\./,
					exclude: [/\.map$/, /asset-manifest\.json$/, /LICENSE/],
					// Bump up the default maximum size (2mb) that's precached,
					// To make lazy-loading failure scenarios less likely.
					// See https://github.com/cra-template/pwa/issues/13#issuecomment-722667270
					maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
				}),
			// TypeScript type checking
			useTypeScript &&
				new ForkTsCheckerWebpackPlugin({
					async: isEnvDevelopment,
					typescript: {
						typescriptPath: resolve.sync('typescript', {
							basedir: paths.appNodeModules,
						}),
						configOverwrite: {
							compilerOptions: {
								sourceMap: isEnvProduction
									? shouldUseSourceMap
									: isEnvDevelopment,
								skipLibCheck: true,
								inlineSourceMap: false,
								declarationMap: false,
								noEmit: true,
								incremental: true,
								tsBuildInfoFile: paths.appTsBuildInfoFile,
							},
						},
						context: paths.appPath,
						diagnosticOptions: {
							syntactic: true,
						},
						mode: 'write-references',
						// Profile: true,
					},
					issue: {
						// This one is specifically to match during CI tests,
						// As micromatch doesn't match
						// '../cra-template-typescript/template/src/App.tsx'
						// Otherwise.
						include: [
							{ file: '../**/src/**/*.{ts,tsx}' },
							{ file: '**/src/**/*.{ts,tsx}' },
						],
						exclude: [
							{ file: '**/src/**/__tests__/**' },
							{ file: '**/src/**/?(*.){spec|test}.*' },
							{ file: '**/src/setupProxy.*' },
							{ file: '**/src/setupTests.*' },
						],
					},
					logger: {
						infrastructure: 'silent',
					},
				}),
			!disableESLintPlugin &&
				new ESLintPlugin({
					// Plugin options
					extensions: ['js', 'mjs', 'jsx', 'ts', 'tsx'],
					formatter: require.resolve('react-dev-utils/eslintFormatter'),
					eslintPath: require.resolve('eslint'),
					failOnError: !(isEnvDevelopment && emitErrorsAsWarnings),
					context: paths.appSrc,
					cache: true,
					cacheLocation: path.resolve(
						paths.appNodeModules,
						'.cache/.eslintcache'
					),
					// ESLint class options
					cwd: paths.appPath,
					resolvePluginsRelativeTo: __dirname,
					baseConfig: {
						extends: [require.resolve('eslint-config-react-app/base')],
						rules: {
							...(!hasJsxRuntime && {
								'react/react-in-jsx-scope': 'error',
							}),
						},
					},
				}),
				new webpack.ProvidePlugin({
					Buffer: ['buffer', 'Buffer']
				}),
				new webpack.ProvidePlugin({
					process: 'process/browser'
				})
		].filter(Boolean),
		// Turn off performance processing because we utilize
		// Our own hints via the FileSizeReporter
		performance: false,
	};
};
