import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildTargets, selectBuildTargets } from '../esbuild.mts';

interface PackageJson {
	devDependencies: Record<string, string>;
	scripts: Record<string, string>;
}

interface VsCodeTask {
	label: string;
	command?: string;
	dependsOn?: string[];
}

interface VsCodeTasks {
	tasks: VsCodeTask[];
}

const packageJson = JSON.parse(
	await readFile(new URL('../package.json', import.meta.url), 'utf8'),
) as PackageJson;
const tasks = JSON.parse(
	await readFile(new URL('../.vscode/tasks.json', import.meta.url), 'utf8'),
) as VsCodeTasks;
const lefthookConfig = await readFile(
	new URL('../lefthook.yml', import.meta.url),
	'utf8',
);

function taskByLabel(label: string): VsCodeTask {
	const task = tasks.tasks.find((candidate) => candidate.label === label);
	assert.ok(task, `expected task labeled ${label}`);
	return task;
}

test('quality scripts use the Oxc toolchain, type-aware linting, and CSS linting', () => {
	assert.equal(packageJson.scripts.format, 'oxfmt --write .');
	assert.equal(packageJson.scripts['format:check'], 'oxfmt --check .');
	assert.equal(packageJson.scripts['lint:code'], 'oxlint --deny-warnings .');
	assert.match(packageJson.scripts['lint:types'], /oxlint --type-aware/);
	assert.equal(packageJson.scripts['lint:css'], 'stylelint "media/**/*.css"');
	assert.match(packageJson.devDependencies.typescript, /^\^?7\./);
	for (const replaced of ['eslint', 'prettier', 'typescript-eslint']) {
		assert.equal(packageJson.devDependencies[replaced], undefined);
	}
});

test('pre-commit hooks check staged files before conditional project checks', () => {
	assert.match(lefthookConfig, /^pre-commit:\n  parallel: true/m);
	assert.match(lefthookConfig, /oxfmt --check \{staged_files\}/);
	assert.match(lefthookConfig, /oxlint --deny-warnings \{staged_files\}/);
	assert.match(lefthookConfig, /stylelint \{staged_files\}/);
	assert.match(lefthookConfig, /markdownlint-cli2 --no-globs \{staged_files\}/);
	assert.doesNotMatch(lefthookConfig, /stage_fixed/);
	assert.doesNotMatch(lefthookConfig, /^pre-push:/m);
});

test('watch tasks rebuild every production extension and preview artifact', () => {
	assert.equal(
		packageJson.scripts.watch,
		'npm-run-all -p watch:node watch:preview watch:tsc watch:web',
	);
	assert.equal(
		packageJson.scripts['watch:preview'],
		'node esbuild.mts --watch --target=preview',
	);
	const watchPreview = taskByLabel('pnpm: watch:preview');
	assert.equal(watchPreview.command, 'pnpm run watch:preview');

	const previewTargets = selectBuildTargets('preview');
	assert.deepEqual(
		previewTargets.map((target) => target.options.outfile),
		[
			'dist/preview/preview.js',
			'dist/preview/mermaid-runtime.js',
			'dist/preview/preview.css',
		],
	);
	assert.equal(
		selectBuildTargets(undefined).some((target) => target.testOnly),
		false,
	);
});

test('web host runner is browser-targeted and excluded from production builds', () => {
	const webTest = selectBuildTargets('web-test');
	assert.equal(webTest.length, 1);
	assert.deepEqual(webTest[0]?.options, {
		entryPoints: ['src/test/web/index.ts'],
		platform: 'browser',
		format: 'cjs',
		outfile: 'out/web-test/index.js',
		external: ['vscode'],
	});
	assert.equal(buildTargets.filter((target) => target.testOnly).length, 1);
});

test('extension test watcher uses the Extension Host compiler project', () => {
	assert.equal(
		packageJson.scripts['watch-tests'],
		'tsc -p tsconfig.extension-tests.json -w',
	);
	const watchTests = taskByLabel('pnpm: watch-tests');
	assert.equal(watchTests.command, 'pnpm run watch-tests');

	const extensionTestWatcher = taskByLabel('tasks: watch-tests');
	assert.deepEqual(extensionTestWatcher.dependsOn, [
		'watch',
		'pnpm: watch-tests',
	]);
});

test('unknown build target fails before creating build contexts', () => {
	assert.throws(() => selectBuildTargets('missing'), /Unknown build target/);
});
