import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const manifest = JSON.parse(
	await readFile(new URL('../package.json', import.meta.url), 'utf8'),
);

test('manifest exposes behavior-free desktop and web entry points', () => {
	assert.equal(manifest.main, './dist/node/extension.js');
	assert.equal(manifest.browser, './dist/web/extension.js');
	assert.deepEqual(manifest.activationEvents, []);
	assert.deepEqual(manifest.contributes, {});
});
