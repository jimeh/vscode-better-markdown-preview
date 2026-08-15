import * as assert from 'assert';
import * as vscode from 'vscode';
import {
	assertConfigurationRoundTrip,
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

	test('reloads rendering and preview settings through the host', async function () {
		this.timeout(10_000);
		const configuration = vscode.workspace.getConfiguration(
			'betterMarkdownPreview',
		);
		await assertConfigurationRoundTrip(
			(source) =>
				vscode.commands.executeCommand<string>('markdown.api.render', source),
			(key, value) =>
				configuration.update(key, value, vscode.ConfigurationTarget.Global),
			{
				'rendering.columns':
					configuration.inspect<boolean>('rendering.columns')?.globalValue,
				'mermaid.viewer':
					configuration.inspect<boolean>('mermaid.viewer')?.globalValue,
			},
		);
	});
});
