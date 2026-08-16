import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { DESKTOP_FLOOR_VERSION } from '../scripts/lib/host-tests.mts';
import {
	assertConfigurationContribution,
	assertConfigurationDocumentation,
} from './configuration-contract.mts';

const [manifestSource, readme] = await Promise.all([
	readFile(new URL('../package.json', import.meta.url), 'utf8'),
	readFile(new URL('../README.md', import.meta.url), 'utf8'),
]);
const manifest = JSON.parse(manifestSource);

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
});

test('manifest exposes the exact window-scoped feature settings enabled by default', () => {
	assertConfigurationContribution(manifest.contributes.configuration);
});

test('README documents every public setting exactly once and in manifest order', () => {
	assertConfigurationDocumentation(readme);
});
