const esbuild = require('esbuild');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');
const requestedTarget = process.argv
	.find((argument) => argument.startsWith('--target='))
	?.split('=', 2)[1];

/**
 * @type {import('esbuild').Plugin}
 */
function esbuildProblemMatcherPlugin(target) {
	return {
		name: `esbuild-problem-matcher-${target}`,

		setup(build) {
			build.onStart(() => {
				console.log(
					watch ? '[watch] build started' : `[${target}] build started`,
				);
			});
			build.onEnd((result) => {
				result.errors.forEach(({ text, location }) => {
					console.error(`✘ [ERROR] ${text}`);
					if (location) {
						console.error(
							`    ${location.file}:${location.line}:${location.column}:`,
						);
					}
				});
				console.log(
					watch ? '[watch] build finished' : `[${target}] build finished`,
				);
			});
		},
	};
}

const targets = [
	{
		name: 'node',
		group: 'node',
		entryPoints: ['src/extension.ts'],
		platform: 'node',
		format: 'cjs',
		outfile: 'dist/node/extension.js',
		external: ['vscode'],
	},
	{
		name: 'web',
		group: 'web',
		entryPoints: ['src/extension.ts'],
		platform: 'browser',
		format: 'cjs',
		outfile: 'dist/web/extension.js',
		external: ['vscode'],
	},
	{
		name: 'preview-script',
		group: 'preview',
		entryPoints: ['src/preview/index.ts'],
		platform: 'browser',
		format: 'iife',
		outfile: 'dist/preview/preview.js',
		external: ['./mermaid-runtime.js'],
	},
	{
		name: 'mermaid',
		group: 'preview',
		entryPoints: ['src/preview/mermaid-runtime.ts'],
		platform: 'browser',
		format: 'esm',
		outfile: 'dist/preview/mermaid-runtime.js',
		external: [],
	},
	{
		name: 'preview-css',
		group: 'preview',
		entryPoints: ['media/preview.css'],
		platform: 'browser',
		outfile: 'dist/preview/preview.css',
		external: [],
	},
];

async function main() {
	const selectedTargets = requestedTarget
		? targets.filter(
				(target) =>
					target.name === requestedTarget || target.group === requestedTarget,
			)
		: targets;

	if (selectedTargets.length === 0) {
		throw new Error(`Unknown build target: ${requestedTarget}`);
	}

	const contexts = await Promise.all(
		selectedTargets.map((target) =>
			esbuild.context({
				entryPoints: target.entryPoints,
				bundle: true,
				...(target.format ? { format: target.format } : {}),
				minify: production,
				outfile: target.outfile,
				platform: target.platform,
				external: target.external,
				logLevel: 'silent',
				plugins: [esbuildProblemMatcherPlugin(target.name)],
				sourcemap: !production,
				sourcesContent: false,
			}),
		),
	);

	if (watch) {
		await Promise.all(contexts.map((context) => context.watch()));
	} else {
		await Promise.all(contexts.map((context) => context.rebuild()));
		await Promise.all(contexts.map((context) => context.dispose()));
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
