import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { posix, win32 } from 'node:path';
import test from 'node:test';
import { buildTargets, selectBuildTargets } from '../esbuild.mts';
import { isPathWithin } from '../scripts/lib/paths.mts';

interface PackageJson {
	devDependencies: Record<string, string>;
	scripts: Record<string, string>;
}

interface OxfmtConfig {
	ignorePatterns: string[];
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
const oxfmtConfig = JSON.parse(
	await readFile(new URL('../.oxfmtrc.json', import.meta.url), 'utf8'),
) as OxfmtConfig;
const tasks = JSON.parse(
	await readFile(new URL('../.vscode/tasks.json', import.meta.url), 'utf8'),
) as VsCodeTasks;
const lefthookConfig = await readFile(
	new URL('../lefthook.yml', import.meta.url),
	'utf8',
);
const miseConfig = await readFile(
	new URL('../mise.toml', import.meta.url),
	'utf8',
);

function taskByLabel(label: string): VsCodeTask {
	const task = tasks.tasks.find((candidate) => candidate.label === label);
	assert.ok(task, `expected task labeled ${label}`);
	return task;
}

function lefthookJob(name: string): string {
	const marker = `    - name: ${name}\n`;
	const start = lefthookConfig.indexOf(marker);
	assert.notEqual(start, -1, `expected Lefthook job named ${name}`);
	const end = lefthookConfig.indexOf('\n    - name:', start + marker.length);
	return lefthookConfig.slice(start, end === -1 ? undefined : end);
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function miseTask(name: string): string {
	const marker = name.includes(':') ? `[tasks."${name}"]` : `[tasks.${name}]`;
	const start = miseConfig.indexOf(marker);
	assert.notEqual(start, -1, `expected Mise task named ${name}`);
	const end = miseConfig.indexOf('\n[tasks.', start + marker.length);
	return miseConfig.slice(start, end === -1 ? undefined : end);
}

test('quality scripts use the Oxc toolchain, type-aware linting, and CSS linting', () => {
	assert.equal(packageJson.scripts.format, 'oxfmt --write .');
	assert.equal(packageJson.scripts['format:check'], 'oxfmt --check .');
	assert.equal(packageJson.scripts['lint:code'], 'oxlint --deny-warnings .');
	assert.match(packageJson.scripts['lint:types'], /oxlint --type-aware/);
	assert.match(
		packageJson.scripts['lint:types'],
		/--ignore-pattern "src\/test\/\*\*"/,
	);
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

test('pre-commit routes configuration and test inputs to relevant checks', () => {
	const formatting = lefthookJob('check staged formatting');
	assert.match(formatting, /exclude:/);
	for (const pattern of oxfmtConfig.ignorePatterns) {
		assert.match(
			formatting,
			new RegExp(`- '${escapeRegExp(pattern)}'`),
			`expected staged format exclusion for ${pattern}`,
		);
	}

	const typeAwareLint = lefthookJob('type-aware product lint');
	assert.match(typeAwareLint, /'\.oxlintrc\.json'/);
	assert.match(typeAwareLint, /'pnpm-lock\.yaml'/);

	const typecheck = lefthookJob('typecheck TypeScript projects');
	assert.match(typecheck, /'pnpm-lock\.yaml'/);

	const unitTests = lefthookJob('run unit tests');
	assert.match(unitTests, /'vitest\.config\.mts'/);
	assert.match(unitTests, /'pnpm-lock\.yaml'/);
	assert.doesNotMatch(unitTests, /'test\/\*\*/);

	const contractTests = lefthookJob('run Node contract tests');
	assert.match(contractTests, /'\.oxfmtrc\.json'/);
	assert.match(contractTests, /'test\/\*\*/);
	assert.match(contractTests, /'pnpm-lock\.yaml'/);
	assert.match(contractTests, /'scripts\/\*\*/);
	assert.match(contractTests, /'media\/preview\.css'/);
	assert.match(contractTests, /'CHANGELOG\.md'/);
	assert.match(contractTests, /pnpm run test:contracts/);
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

test('preview browser verification is discoverable and part of the final gate', () => {
	assert.equal(
		packageJson.scripts['test:preview-browser'],
		'node scripts/run-preview-browser-tests.mts',
	);
	assert.match(
		miseTask('test:preview-browser'),
		/run = \["mise run build", "pnpm run test:preview-browser"\]/,
	);
	assert.match(miseTask('verify'), /"mise run test:preview-browser"/);
});

test('preview browser assets stay inside their root on POSIX and Windows', () => {
	assert.equal(
		isPathWithin('/repo/dist/preview', '/repo/dist/preview/preview.js', posix),
		true,
	);
	assert.equal(
		isPathWithin(
			'/repo/dist/preview',
			'/repo/dist/preview-other/file.js',
			posix,
		),
		false,
	);
	assert.equal(
		isPathWithin(
			'C:\\repo\\dist\\preview',
			'C:\\repo\\dist\\preview\\preview.js',
			win32,
		),
		true,
	);
	assert.equal(
		isPathWithin(
			'C:\\repo\\dist\\preview',
			'C:\\repo\\dist\\preview-other\\file.js',
			win32,
		),
		false,
	);
	assert.equal(
		isPathWithin(
			'C:\\repo\\dist\\preview',
			'D:\\repo\\dist\\preview\\preview.js',
			win32,
		),
		false,
	);
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
