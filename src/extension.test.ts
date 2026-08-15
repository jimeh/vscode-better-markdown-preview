import MarkdownIt from 'markdown-it';
import { describe, expect, test } from 'vitest';
import { activate, deactivate } from './extension';

describe('extension entry point', () => {
	test('exposes the browser-safe Markdown contribution lifecycle', () => {
		const api = activate();
		const markdown = api.extendMarkdownIt(
			new MarkdownIt({ html: true, linkify: false }),
		);

		expect(markdown.render('- [x] entry point\n')).toContain('task-list-item');
		expect(deactivate()).toBeUndefined();
	});
});
