import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const manifest = JSON.parse(
	await readFile(new URL('../package.json', import.meta.url), 'utf8'),
);

test('manifest exposes native Markdown preview hooks for desktop and web', () => {
	assert.equal(manifest.icon, 'img/icon.png');
	assert.equal(manifest.main, './dist/node/extension.js');
	assert.equal(manifest.browser, './dist/web/extension.js');
	assert.deepEqual(manifest.activationEvents, []);
	assert.deepEqual(manifest.extensionKind, ['workspace']);
	assert.deepEqual(manifest.contributes, {
		'markdown.markdownItPlugins': true,
		'markdown.previewStyles': ['./dist/preview/preview.css'],
		'markdown.previewScripts': ['./dist/preview/preview.js'],
	});
	assert.equal('commands' in manifest.contributes, false);
});
