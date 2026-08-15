import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
	assertPackageInventory,
	inspectPackage,
} from '../scripts/lib/package-contract.mts';
import { packageFilename } from '../scripts/lib/package.mts';
import { assertConfigurationContribution } from './configuration-contract.mts';

const sourceManifest = JSON.parse(
	await readFile(new URL('../package.json', import.meta.url), 'utf8'),
) as { name: string; publisher: string; version: string };
const expectedVersion =
	process.env.EXPECTED_PACKAGE_VERSION ?? sourceManifest.version;
const archiveUrl = process.env.PACKAGE_PATH
	? new URL(`../${process.env.PACKAGE_PATH}`, import.meta.url)
	: new URL(
			`../artifacts/${packageFilename(sourceManifest.publisher, sourceManifest.name, expectedVersion)}`,
			import.meta.url,
		);

test('VSIX contains exactly the expected runtime archive', async () => {
	const inspection = await inspectPackage(archiveUrl);
	assertPackageInventory(inspection, expectedVersion);
	const packagedManifest = inspection.manifest;
	assert.equal(packagedManifest.icon, 'img/icon.png');
	assert.equal(packagedManifest.main, './dist/node/extension.js');
	assert.equal(packagedManifest.browser, './dist/web/extension.js');
	assert.equal(
		packagedManifest.contributes['markdown.markdownItPlugins'],
		true,
	);
	assert.deepEqual(packagedManifest.contributes['markdown.previewStyles'], [
		'./dist/preview/preview.css',
	]);
	assert.deepEqual(packagedManifest.contributes['markdown.previewScripts'], [
		'./dist/preview/preview.js',
	]);
	assertConfigurationContribution(packagedManifest.contributes.configuration);
});
