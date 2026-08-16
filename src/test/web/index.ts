import * as vscode from 'vscode';
import {
	assertConfigurationRoundTrip,
	assertRenderCompatibility,
	assertYamlFrontmatterCompatibility,
	renderCompatibilityFixture,
	yamlFrontmatterCompatibilityFixture,
} from '../render-contract';

interface MarkdownExtensionApi {
	extendMarkdownIt: unknown;
}

export async function run(): Promise<void> {
	const extension = vscode.extensions.all.find(
		(candidate) => candidate.packageJSON.name === 'better-markdown-preview',
	);
	if (!extension) {
		throw new Error(
			'The extension is unavailable in the web development host.',
		);
	}
	const api = (await extension.activate()) as MarkdownExtensionApi;
	if (!extension.isActive || typeof api.extendMarkdownIt !== 'function') {
		throw new Error('The browser entry point did not expose its Markdown API.');
	}

	const html = await vscode.commands.executeCommand<string>(
		'markdown.api.render',
		renderCompatibilityFixture,
	);
	if (typeof html !== 'string') {
		throw new Error('markdown.api.render did not return HTML in the web host.');
	}
	assertRenderCompatibility(html);

	const yamlHtml = await vscode.commands.executeCommand<string>(
		'markdown.api.render',
		yamlFrontmatterCompatibilityFixture,
	);
	if (typeof yamlHtml !== 'string') {
		throw new Error('markdown.api.render did not return YAML HTML.');
	}
	assertYamlFrontmatterCompatibility(yamlHtml);

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
			'rendering.emojiShortcodes': configuration.inspect<boolean>(
				'rendering.emojiShortcodes',
			)?.globalValue,
			'rendering.emoticonShortcuts': configuration.inspect<boolean>(
				'rendering.emoticonShortcuts',
			)?.globalValue,
			'mermaid.viewer':
				configuration.inspect<boolean>('mermaid.viewer')?.globalValue,
		},
	);
}
