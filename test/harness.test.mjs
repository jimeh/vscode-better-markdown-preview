import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const packageJson = JSON.parse(
	await readFile(new URL('../package.json', import.meta.url), 'utf8'),
);
const tasks = await readFile(
	new URL('../.vscode/tasks.json', import.meta.url),
	'utf8',
);
const esbuild = await readFile(
	new URL('../esbuild.js', import.meta.url),
	'utf8',
);

test('watch tasks rebuild every extension and preview artifact', () => {
	assert.equal(
		packageJson.scripts.watch,
		'npm-run-all -p watch:node watch:preview watch:tsc watch:web',
	);
	assert.equal(
		packageJson.scripts['watch:preview'],
		'node esbuild.js --watch --target=preview',
	);
	assert.match(tasks, /"pnpm: watch:preview"/);
	assert.match(tasks, /"command": "pnpm run watch:preview"/);
	assert.match(esbuild, /entryPoints: \['media\/preview\.css'\]/);
	assert.match(esbuild, /outfile: 'dist\/preview\/preview\.css'/);
});

test('extension test watcher uses the Extension Host compiler project', () => {
	assert.equal(
		packageJson.scripts['watch-tests'],
		'tsc -p tsconfig.extension-tests.json -w',
	);
	assert.match(
		tasks,
		/"label": "pnpm: watch-tests"[\s\S]*?"command": "pnpm run watch-tests"/,
	);
	assert.match(tasks, /"dependsOn": \["watch", "pnpm: watch-tests"\]/);
});
