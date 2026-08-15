import MarkdownIt from 'markdown-it';
import type { ConfigurationChangeEvent, ExtensionContext } from 'vscode';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const vscode = vi.hoisted(() => {
	let listener: ((event: ConfigurationChangeEvent) => void) | undefined;
	const values = new Map<string, boolean>();
	const disposable = { dispose: vi.fn() };
	return {
		commands: { executeCommand: vi.fn(async () => undefined) },
		workspace: {
			getConfiguration: vi.fn(() => ({
				get: (key: string, fallback: boolean) => values.get(key) ?? fallback,
			})),
			onDidChangeConfiguration: vi.fn(
				(callback: (event: ConfigurationChangeEvent) => void) => {
					listener = callback;
					return disposable;
				},
			),
		},
		values,
		disposable,
		fire(affected: string) {
			listener?.({
				affectsConfiguration: (section: string) => section === affected,
			} as ConfigurationChangeEvent);
		},
		reset() {
			listener = undefined;
			values.clear();
			disposable.dispose.mockClear();
		},
	};
});

vi.mock('vscode', () => ({
	commands: vscode.commands,
	workspace: vscode.workspace,
}));

import { activate, deactivate } from './extension';

describe('extension entry point', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vscode.reset();
	});

	test('reads defaults and registers the configuration listener for disposal', () => {
		const context = { subscriptions: [] } as unknown as ExtensionContext;
		const api = activate(context);
		const markdown = api.extendMarkdownIt(
			new MarkdownIt({ html: true, linkify: false }),
		);

		expect(markdown.render('- [x] entry point\n')).toContain('task-list-item');
		expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith(
			'betterMarkdownPreview',
		);
		expect(context.subscriptions).toContain(vscode.disposable);
		expect(deactivate()).toBeUndefined();
	});

	test('refreshes explicit settings and reloads only for relevant changes', () => {
		const context = { subscriptions: [] } as unknown as ExtensionContext;
		const api = activate(context);
		vscode.fire('editor.fontSize');
		expect(vscode.commands.executeCommand).not.toHaveBeenCalled();

		vscode.values.set('rendering.taskLists', false);
		vscode.fire('betterMarkdownPreview.rendering.taskLists');
		expect(vscode.commands.executeCommand).toHaveBeenCalledOnce();
		expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
			'markdown.api.reloadPlugins',
		);

		const html = api
			.extendMarkdownIt(new MarkdownIt({ html: true, linkify: false }))
			.render('- [x] delegated\n');
		expect(html).not.toContain('task-list-item');
	});

	test('reports a Markdown plugin reload rejection without leaving it unhandled', async () => {
		const failure = new Error('reload unavailable');
		vscode.commands.executeCommand.mockRejectedValueOnce(failure);
		const report = vi
			.spyOn(console, 'error')
			.mockImplementation(() => undefined);
		const context = { subscriptions: [] } as unknown as ExtensionContext;
		activate(context);

		vscode.fire('betterMarkdownPreview.rendering.footnotes');
		await Promise.resolve();
		expect(report).toHaveBeenCalledWith(
			'Better Markdown Preview could not reload Markdown plugins.',
			failure,
		);
	});
});
