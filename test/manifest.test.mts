import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { DESKTOP_FLOOR_VERSION } from '../scripts/lib/host-tests.mts';
import { assertConfigurationContribution } from './configuration-contract.mts';

const manifest = JSON.parse(
	await readFile(new URL('../package.json', import.meta.url), 'utf8'),
);

test('manifest exposes native Markdown preview hooks for desktop and web', () => {
	assert.equal(manifest.version, '0.0.0');
	assert.equal(manifest.engines.vscode, `^${DESKTOP_FLOOR_VERSION}`);
	assert.equal(manifest.icon, 'img/icon.png');
	assert.equal(manifest.main, './dist/node/extension.js');
	assert.equal(manifest.browser, './dist/web/extension.js');
	assert.deepEqual(manifest.activationEvents, []);
	assert.deepEqual(manifest.extensionKind, ['workspace']);
	assert.equal(manifest.contributes['markdown.markdownItPlugins'], true);
	assert.deepEqual(manifest.contributes['markdown.previewStyles'], [
		'./dist/preview/preview.css',
	]);
	assert.deepEqual(manifest.contributes['markdown.previewScripts'], [
		'./dist/preview/preview.js',
	]);
	assert.equal('commands' in manifest.contributes, false);
	assert.equal(manifest.devDependencies['markdown-it'], '14.3.0');
	assert.equal(manifest.devDependencies['@types/markdown-it-emoji'], '3.0.1');
	assert.equal(manifest.dependencies['markdown-it-emoji'], '3.1.0');
});

test('manifest exposes the exact window-scoped feature setting defaults', () => {
	assertConfigurationContribution(manifest.contributes.configuration);
});
