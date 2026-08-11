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
	'extension/dist/web/extension.js',
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
	assert.equal(packagedManifest.main, './dist/node/extension.js');
	assert.equal(packagedManifest.browser, './dist/web/extension.js');
	assert.deepEqual(packagedManifest.contributes, {});
});
