import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { unzipSync } from 'fflate';

const archiveUrl = new URL(
	'../artifacts/better-markdown-preview.vsix',
	import.meta.url,
);

test('VSIX contains both runtime bundles and excludes development files', async () => {
	const archive = unzipSync(new Uint8Array(await readFile(archiveUrl)));
	const entries = new Set(Object.keys(archive));
	const requiredFiles = [
		'extension/LICENSE.txt',
		'extension/changelog.md',
		'extension/dist/node/extension.js',
		'extension/dist/web/extension.js',
		'extension/package.json',
		'extension/readme.md',
	];

	for (const file of requiredFiles) {
		assert.ok(entries.has(file), `expected ${file} in the VSIX`);
		assert.ok(archive[file].byteLength > 0, `expected ${file} to be non-empty`);
	}

	const forbiddenPrefixes = [
		'extension/.github/',
		'extension/.vscode/',
		'extension/docs/',
		'extension/scripts/',
		'extension/src/',
		'extension/test/',
	];
	const forbiddenFiles = [
		'extension/.markdownlint-cli2.jsonc',
		'extension/AGENTS.md',
		'extension/CLAUDE.md',
		'extension/esbuild.js',
		'extension/mise.toml',
		'extension/pnpm-lock.yaml',
		'extension/pnpm-workspace.yaml',
		'extension/tsconfig.json',
	];

	for (const entry of entries) {
		assert.ok(
			!forbiddenPrefixes.some((prefix) => entry.startsWith(prefix)),
			`did not expect development path ${entry} in the VSIX`,
		);
	}

	for (const file of forbiddenFiles) {
		assert.ok(!entries.has(file), `did not expect ${file} in the VSIX`);
	}

	const packagedManifest = JSON.parse(
		new TextDecoder().decode(archive['extension/package.json']),
	);
	assert.equal(packagedManifest.main, './dist/node/extension.js');
	assert.equal(packagedManifest.browser, './dist/web/extension.js');
	assert.deepEqual(packagedManifest.contributes, {});
});
