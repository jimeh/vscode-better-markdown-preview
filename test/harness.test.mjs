import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const packageJson = JSON.parse(
	await readFile(new URL('../package.json', import.meta.url), 'utf8'),
);
const tasksDocument = await readFile(
	new URL('../.vscode/tasks.json', import.meta.url),
	'utf8',
);
const { config: tasks, error: tasksParseError } = ts.parseConfigFileTextToJson(
	'.vscode/tasks.json',
	tasksDocument,
);
const esbuild = await readFile(
	new URL('../esbuild.js', import.meta.url),
	'utf8',
);

function taskByLabel(label) {
	assert.equal(tasksParseError, undefined);
	const task = tasks.tasks.find((candidate) => candidate.label === label);
	assert.ok(task, `expected task labeled ${label}`);
	return task;
}

test('watch tasks rebuild every extension and preview artifact', () => {
	assert.equal(
		packageJson.scripts.watch,
		'npm-run-all -p watch:node watch:preview watch:tsc watch:web',
	);
	assert.equal(
		packageJson.scripts['watch:preview'],
		'node esbuild.js --watch --target=preview',
	);
	const watchPreview = taskByLabel('pnpm: watch:preview');
	assert.equal(watchPreview.command, 'pnpm run watch:preview');
	assert.match(esbuild, /entryPoints: \['media\/preview\.css'\]/);
	assert.match(esbuild, /outfile: 'dist\/preview\/preview\.css'/);
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
