import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { unzipSync } from 'fflate';

export const expectedPackageEntries = [
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
	'extension/img/preview.png',
	'extension/package.json',
	'extension/readme.md',
].sort();

interface PackagedManifest {
	browser?: unknown;
	contributes: Record<string, unknown>;
	icon?: unknown;
	main?: unknown;
	version?: unknown;
}

export interface PackageInspection {
	archive: Record<string, Uint8Array>;
	changelog: string;
	manifest: PackagedManifest;
}

export async function inspectPackage(
	archivePath: string | URL,
): Promise<PackageInspection> {
	const archive = unzipSync(new Uint8Array(await readFile(archivePath)));
	const manifest = JSON.parse(
		new TextDecoder().decode(archive['extension/package.json']),
	) as PackagedManifest;

	return {
		archive,
		changelog: new TextDecoder().decode(archive['extension/changelog.md']),
		manifest,
	};
}

export function assertPackageInventory(
	inspection: PackageInspection,
	expectedVersion: string,
): void {
	assert.deepEqual(
		Object.keys(inspection.archive).sort(),
		expectedPackageEntries,
	);
	for (const file of expectedPackageEntries) {
		assert.ok(
			inspection.archive[file].byteLength > 0,
			`expected ${file} to be non-empty`,
		);
	}

	assert.equal(inspection.manifest.version, expectedVersion);
	assert.equal(inspection.manifest.icon, 'img/icon.png');
	assert.equal(inspection.manifest.main, './dist/node/extension.js');
	assert.equal(inspection.manifest.browser, './dist/web/extension.js');
	assert.ok(
		inspection.archive['extension/dist/preview/mermaid-runtime.js'].byteLength >
			inspection.archive['extension/dist/node/extension.js'].byteLength,
		'Mermaid stays in its separately loaded preview bundle',
	);
}

export function assertReleaseChangelog(
	inspection: PackageInspection,
	version: string,
): void {
	assert.match(
		inspection.changelog,
		new RegExp(`\\b${version.replaceAll('.', '\\.')}\\b`),
	);
	assert.doesNotMatch(inspection.changelog, /^## \[Unreleased\]/m);
}
