import * as assert from 'assert';
import * as vscode from 'vscode';
import {
	assertRenderCompatibility,
	renderCompatibilityFixture,
} from '../render-contract';

interface MarkdownExtensionApi {
	extendMarkdownIt: unknown;
}

suite('Better Markdown Preview extension', () => {
	test('activates and renders through the host Markdown API', async () => {
		const extension = vscode.extensions.all.find(
			(candidate) => candidate.packageJSON.name === 'better-markdown-preview',
		);

		assert.ok(extension, 'the extension is available in the development host');
		assert.strictEqual(
			extension.packageJSON.contributes['markdown.markdownItPlugins'],
			true,
		);

		const api = (await extension.activate()) as MarkdownExtensionApi;
		assert.strictEqual(extension.isActive, true);
		assert.strictEqual(typeof api.extendMarkdownIt, 'function');

		const html = await vscode.commands.executeCommand<string>(
			'markdown.api.render',
			renderCompatibilityFixture,
		);
		assert.strictEqual(typeof html, 'string');
		assertRenderCompatibility(html);
	});
});
