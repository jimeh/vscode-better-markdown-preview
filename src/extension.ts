import type MarkdownIt from 'markdown-it';
import { commands, workspace, type ExtensionContext } from 'vscode';
import {
	CONFIGURATION_SECTION,
	configurationKeys,
	readConfiguration,
} from './config';
import { extendMarkdownIt } from './markdown/compose';

export interface MarkdownExtensionApi {
	extendMarkdownIt(markdownIt: MarkdownIt): MarkdownIt;
}

export function activate(context: ExtensionContext): MarkdownExtensionApi {
	let configuration = readConfiguration(
		workspace.getConfiguration(CONFIGURATION_SECTION),
	);
	context.subscriptions.push(
		workspace.onDidChangeConfiguration((event) => {
			const relevant = configurationKeys.some((key) =>
				event.affectsConfiguration(`${CONFIGURATION_SECTION}.${key}`),
			);
			if (!relevant) {
				return;
			}
			configuration = readConfiguration(
				workspace.getConfiguration(CONFIGURATION_SECTION),
			);
			void commands
				.executeCommand('markdown.api.reloadPlugins')
				.then(undefined, (error: unknown) => {
					console.error(
						'Better Markdown Preview could not reload Markdown plugins.',
						error,
					);
				});
		}),
	);
	return {
		extendMarkdownIt(markdownIt) {
			return extendMarkdownIt(markdownIt, configuration);
		},
	};
}

export function deactivate(): void {}
