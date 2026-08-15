import * as esbuild from 'esbuild';
import type { BuildOptions, Plugin } from 'esbuild';

export interface BuildTarget {
	name: string;
	group: string;
	testOnly?: boolean;
	options: Pick<
		BuildOptions,
		'entryPoints' | 'platform' | 'format' | 'outfile' | 'external'
	>;
}

export const buildTargets: readonly BuildTarget[] = [
	{
		name: 'node',
		group: 'node',
		options: {
			entryPoints: ['src/extension.ts'],
			platform: 'node',
			format: 'cjs',
			outfile: 'dist/node/extension.js',
			external: ['vscode'],
		},
	},
	{
		name: 'web',
		group: 'web',
		options: {
			entryPoints: ['src/extension.ts'],
			platform: 'browser',
			format: 'cjs',
			outfile: 'dist/web/extension.js',
			external: ['vscode'],
		},
	},
	{
		name: 'preview-script',
		group: 'preview',
		options: {
			entryPoints: ['src/preview/index.ts'],
			platform: 'browser',
			format: 'iife',
			outfile: 'dist/preview/preview.js',
			external: ['./mermaid-runtime.js'],
		},
	},
	{
		name: 'mermaid',
		group: 'preview',
		options: {
			entryPoints: ['src/preview/mermaid-runtime.ts'],
			platform: 'browser',
			format: 'esm',
			outfile: 'dist/preview/mermaid-runtime.js',
			external: [],
		},
	},
	{
		name: 'preview-css',
		group: 'preview',
		options: {
			entryPoints: ['media/preview.css'],
			platform: 'browser',
			outfile: 'dist/preview/preview.css',
			external: [],
		},
	},
	{
		name: 'web-test',
		group: 'web-test',
		testOnly: true,
		options: {
			entryPoints: ['src/test/web/index.ts'],
			platform: 'browser',
			format: 'cjs',
			outfile: 'out/web-test/index.js',
			external: ['vscode'],
		},
	},
];

export function selectBuildTargets(
	requestedTarget: string | undefined,
): readonly BuildTarget[] {
	if (!requestedTarget) {
		return buildTargets.filter((target) => !target.testOnly);
	}
	const selected = buildTargets.filter(
		(target) =>
			target.name === requestedTarget || target.group === requestedTarget,
	);
	if (selected.length === 0) {
		throw new Error(`Unknown build target: ${requestedTarget}`);
	}
	return selected;
}

function problemMatcherPlugin(target: string, watch: boolean): Plugin {
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

export async function build(
	args: readonly string[] = process.argv.slice(2),
): Promise<void> {
	const production = args.includes('--production');
	const watch = args.includes('--watch');
	const requestedTarget = args
		.find((argument) => argument.startsWith('--target='))
		?.split('=', 2)[1];
	const selectedTargets = selectBuildTargets(requestedTarget);
	const contexts = await Promise.all(
		selectedTargets.map((target) =>
			esbuild.context({
				...target.options,
				bundle: true,
				minify: production,
				logLevel: 'silent',
				plugins: [problemMatcherPlugin(target.name, watch)],
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

if (import.meta.main) {
	build().catch((error: unknown) => {
		console.error(error);
		process.exitCode = 1;
	});
}
