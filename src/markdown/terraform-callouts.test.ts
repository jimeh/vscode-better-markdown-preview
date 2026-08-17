import MarkdownIt from 'markdown-it';
import { describe, expect, test } from 'vitest';
import {
	defaultConfiguration,
	type BetterMarkdownPreviewConfiguration,
} from '../config';
import { extendMarkdownIt } from './compose';

function render(
	source: string,
	configuration: BetterMarkdownPreviewConfiguration = defaultConfiguration,
): string {
	return extendMarkdownIt(
		new MarkdownIt({ html: true, linkify: false }),
		configuration,
	).render(source);
}

function configureRendering(
	overrides: Partial<BetterMarkdownPreviewConfiguration['rendering']>,
): BetterMarkdownPreviewConfiguration {
	return {
		...defaultConfiguration,
		rendering: { ...defaultConfiguration.rendering, ...overrides },
	};
}

describe('Terraform Registry callouts', () => {
	test('maps all sigils, injected titles, inline Markdown, and soft wrapping', () => {
		const html = render(
			'-> **Blue note**\ncontinued line\n\n~>Yellow *note*\n\n!> [Red warning](https://example.com)\n',
		);

		expect(
			html.match(/better-markdown-preview-terraform-callout/g),
		).toHaveLength(3);
		expect(html).toMatch(
			/better-markdown-preview-alert-note[^>]*>\s*<p class="better-markdown-preview-alert-title">Note<\/p>\s*<p><strong>Blue note<\/strong>\ncontinued line<\/p>/,
		);
		expect(html).toMatch(
			/better-markdown-preview-alert-warning[^>]*>\s*<p class="better-markdown-preview-alert-title">Note<\/p>\s*<p>Yellow <em>note<\/em><\/p>/,
		);
		expect(html).toMatch(
			/better-markdown-preview-alert-caution[^>]*>\s*<p class="better-markdown-preview-alert-title">Warning<\/p>\s*<p><a href="https:\/\/example\.com">Red warning<\/a><\/p>/,
		);
	});

	test('ends at the first paragraph boundary', () => {
		const html = render(
			'-> First paragraph\nsoft continuation\n\nOutside paragraph.\n',
		);

		expect(
			html.match(/better-markdown-preview-terraform-callout/g),
		).toHaveLength(1);
		expect(html).toMatch(
			/<p>First paragraph\nsoft continuation<\/p>\s*<\/div>\s*<p>Outside paragraph\.<\/p>/,
		);
	});

	test('accepts no delimiter whitespace, standard indentation, and Registry escaped sigils', () => {
		const html = render(
			'->No space\n\n ~> One space\n\n  !> Two spaces\n\n   -> Three spaces\n\n\\-> Escaped sigil\n',
		);

		expect(
			html.match(/better-markdown-preview-terraform-callout/g),
		).toHaveLength(5);
		expect(html).toContain('<p>No space</p>');
		expect(html).toContain('<p>Escaped sigil</p>');
	});

	test('recognizes blockquote callouts but leaves list items delegated', () => {
		const html = render(
			'> -> Nested note\n\n- -> Unordered item\n1. !> Ordered item\n',
		);

		expect(
			html.match(/better-markdown-preview-terraform-callout/g),
		).toHaveLength(1);
		expect(html).toMatch(
			/<blockquote>\s*<div class="better-markdown-preview-terraform-callout/,
		);
		expect(html).toContain('-&gt; Unordered item');
		expect(html).toContain('!&gt; Ordered item');
	});

	test('leaves mid-paragraph, heading, code, table, and indented-code sigils delegated', () => {
		const html = render(
			'Before -> mid-paragraph\n\n# -> Heading\n\n`-> Inline code`\n\n```text\n-> Fenced code\n```\n\n    -> Indented code\n\n| Value |\n| --- |\n| -> Table cell |\n',
		);

		expect(html).not.toContain('better-markdown-preview-terraform-callout');
		expect(html).toContain('Before -&gt; mid-paragraph');
		expect(html).toContain('<h1>-&gt; Heading</h1>');
		expect(html).toContain('<code>-&gt; Inline code</code>');
		expect(html).toContain('-&gt; Fenced code');
		expect(html).toContain('-&gt; Indented code');
		expect(html).toContain('<td>-&gt; Table cell</td>');
	});

	test('installs independently from GitHub alerts and delegates when disabled', () => {
		const source = '-> Terraform\n\n> [!NOTE]\n> GitHub\n';
		const noTerraform = render(
			source,
			configureRendering({ terraformCallouts: false }),
		);
		expect(noTerraform).not.toContain(
			'better-markdown-preview-terraform-callout',
		);
		expect(noTerraform).toContain('-&gt; Terraform');
		expect(noTerraform).toContain('better-markdown-preview-alert-note');

		const noGitHub = render(
			source,
			configureRendering({ githubAlerts: false }),
		);
		expect(noGitHub).toContain('better-markdown-preview-terraform-callout');
		expect(noGitHub).toContain('[!NOTE]');
	});
});
