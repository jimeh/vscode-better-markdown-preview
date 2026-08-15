import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { unzipSync } from 'fflate';

const archiveUrl = new URL(
	'../artifacts/better-markdown-preview.vsix',
	import.meta.url,
);
const expectedEntries = [
	'[Content_Types].xml',
	'extension.vsixmanifest',
	'extension/LICENSE.txt',
	'extension/changelog.md',
	'extension/dist/node/extension.js',
	'extension/dist/preview/mermaid-runtime.js',
	'extension/dist/preview/preview.css',
	'extension/dist/preview/preview.js',
	'extension/dist/web/extension.js',
	'extension/img/icon.png',
	'extension/package.json',
	'extension/readme.md',
].sort();

test('VSIX contains exactly the expected runtime archive', async () => {
	const archive = unzipSync(new Uint8Array(await readFile(archiveUrl)));

	assert.deepEqual(Object.keys(archive).sort(), expectedEntries);
	for (const file of expectedEntries) {
		assert.ok(archive[file].byteLength > 0, `expected ${file} to be non-empty`);
	}

	const packagedManifest = JSON.parse(
		new TextDecoder().decode(archive['extension/package.json']),
	);
	assert.equal(packagedManifest.icon, 'img/icon.png');
	assert.equal(packagedManifest.main, './dist/node/extension.js');
	assert.equal(packagedManifest.browser, './dist/web/extension.js');
	assert.deepEqual(packagedManifest.contributes, {
		'markdown.markdownItPlugins': true,
		'markdown.previewStyles': ['./dist/preview/preview.css'],
		'markdown.previewScripts': ['./dist/preview/preview.js'],
	});
	assert.ok(
		archive['extension/dist/preview/mermaid-runtime.js'].byteLength >
			archive['extension/dist/node/extension.js'].byteLength,
		'Mermaid stays in its separately loaded preview bundle',
	);
});
