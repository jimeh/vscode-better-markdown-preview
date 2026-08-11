import MarkdownIt from 'markdown-it';
import { describe, expect, test, vi } from 'vitest';
import { extendMarkdownIt } from './compose';

function render(source: string, configure?: (md: MarkdownIt) => void): string {
	const md = new MarkdownIt({ html: true, linkify: false });
	configure?.(md);
	extendMarkdownIt(md);
	return md.render(source);
}

describe('Markdown composition', () => {
	test('adds GFM task lists, literal autolinks, punctuation, and tag filtering', () => {
		const html = render(
			'- [x] done\n\nVisit https://example.com/a_(b). Email dev@example.com.\n\n<script>alert(1)</script>\n',
		);
		expect(html).toContain('task-list-item');
		expect(html).toContain('href="https://example.com/a_(b)"');
		expect(html).toContain('href="mailto:dev@example.com"');
		expect(html).toContain('&lt;script>');
		expect(html).not.toContain('<script>');
	});

	test('tag filtering escapes only disallowed tag starts inside mixed HTML blocks', () => {
		const html = render(
			'<section>Allowed</section>\n<script>alert(1)</script>\n<span>Still allowed</span>\n',
		);
		expect(html).toContain('<section>Allowed</section>');
		expect(html).toContain('&lt;script>alert(1)&lt;/script>');
		expect(html).toContain('<span>Still allowed</span>');
	});

	test('renders definition lists, footnotes, and only known alerts', () => {
		const html = render(
			'Term\n: Definition\n\nFootnote[^1].\n\n[^1]: Detail\n\n> [!NOTE]\n> **Known**\n\n> [!NOTICE]\n> Unknown\n',
		);
		expect(html).toContain('<dl>');
		expect(html).toContain('footnote-ref');
		expect(html).toContain('better-markdown-preview-alert-note');
		expect(html).toContain('<blockquote>');
		expect(html).toContain('[!NOTICE]');
	});

	test('recognizes byte-zero and BOM TOML but leaves malformed frontmatter literal', () => {
		const escaped = render('+++\ntitle = "<unsafe>"\n+++\n\n# Body\n');
		expect(escaped).toContain('better-markdown-preview-frontmatter');
		expect(escaped).toContain('&lt;unsafe&gt;');
		expect(escaped).not.toContain('<h1>title');
		expect(render('\uFEFF+++\ntitle = "BOM"\n+++\n')).toContain(
			'better-markdown-preview-frontmatter',
		);
		expect(render('\n+++\ntitle = "late"\n+++\n')).not.toContain(
			'better-markdown-preview-frontmatter',
		);
		expect(render('+++\nunclosed = true\n')).not.toContain(
			'better-markdown-preview-frontmatter',
		);
		for (const ordinary of [
			' +++\ntitle = "indented"\n+++\n',
			'+++\ntitle = "spaced closer"\n+++ \n',
			'+++\ntitle = [\n+++\n',
		]) {
			expect(render(ordinary)).not.toContain(
				'better-markdown-preview-frontmatter',
			);
		}
		expect(render('---\ntitle: native yaml\n---\n')).not.toContain(
			'better-markdown-preview-frontmatter',
		);
	});

	test('renders valid columns and leaves malformed structures literal', () => {
		const validSource =
			':::: {.columns}\n::: {.column width=40%}\n**Left**\n:::\n::: {.column}\nRight\n:::\n::::\n';
		const valid = render(validSource);
		expect(valid).toContain('better-markdown-preview-columns');
		expect(valid).toContain('--bmp-column-width: 40%');
		expect(valid).toContain('<strong>Left</strong>');
		const md = new MarkdownIt({ html: true });
		extendMarkdownIt(md);
		expect(
			md.parse(validSource, {}).find((token) => token.type === 'paragraph_open')
				?.map,
		).toEqual([2, 3]);

		for (const malformed of [
			':::: {.columns}\n::: {.column}\nOnly\n:::\n::::\n',
			':::: {.columns}\n::: {.column width=0%}\nA\n:::\n::: {.column}\nB\n:::\n::::\n',
			':::: {.columns}\n::: {.column nope=yes}\nA\n:::\n::: {.column}\nB\n:::\n::::\n',
			':::: {.columns}\n::: {.column}\n::: {.column}\nNested\n:::\n:::\n::: {.column}\nB\n:::\n::::\n',
			':::: {.columns}\n::: {.column}\nA\n::: \n::: {.column}\nB\n:::\n::::\n',
			':::: {.columns}\n::: {.column}\nA\n:::\n::: {.column}\nB\n:::\n:::: \n',
		]) {
			expect(render(malformed)).not.toContain(
				'better-markdown-preview-columns',
			);
		}

		const whitespaceAndWidths = render(
			'::::\t  {.columns}\t\n:::  {.column width=".5%"}\t\nTiny\n:::\n::: \t{.column width=99.5%}  \nWide\n:::\n::: {.column width=\'1%\'}\nQuoted\n:::\n::::\n',
		);
		expect(whitespaceAndWidths).toContain('better-markdown-preview-columns');
		expect(whitespaceAndWidths).toContain('--bmp-column-width: .5%');
		expect(whitespaceAndWidths).toContain('--bmp-column-width: 99.5%');
		expect(whitespaceAndWidths).toContain('--bmp-column-width: 1%');
		expect(
			render(
				' ::::\t{.columns}\n::: {.column}\nA\n:::\n::: {.column}\nB\n:::\n::::\n',
			),
		).not.toContain('better-markdown-preview-columns');
	});

	test('matches only exact lowercase Mermaid fences and escapes fallback source', () => {
		const html = render('```mermaid\ngraph TD\nA[<unsafe>]-->B\n```\n');
		expect(html).toContain('data-bmp-mermaid-source');
		expect(html).toContain('A[&lt;unsafe&gt;]');
		expect(html).not.toContain('<code');
		expect(render('```Mermaid\ngraph TD\n```\n')).not.toContain(
			'data-bmp-mermaid-source',
		);
		expect(render('```mermaid-js\ngraph TD\n```\n')).not.toContain(
			'data-bmp-mermaid-source',
		);
		expect(render('```mermaid \ngraph TD\n```\n')).not.toContain(
			'data-bmp-mermaid-source',
		);
		expect(render('```mermaid extra\ngraph TD\n```\n')).not.toContain(
			'data-bmp-mermaid-source',
		);
	});

	test('delegates highlighting and wraps recognized rich fence metadata safely', () => {
		let delegatedContent = '';
		const sentinel = vi.fn(
			(tokens: Array<{ content: string }>, index: number) => {
				delegatedContent = tokens[index].content;
				return '<pre data-sentinel="yes"><code class="language-ts">native</code></pre>';
			},
		);
		const html = render(
			'```ts title="safe.ts" {1,3-4} /needle/ showLineNumbers\nconst needle = 1; // [!code ++]\n```\n',
			(md) => {
				md.renderer.rules.fence = sentinel;
			},
		);
		expect(sentinel).toHaveBeenCalledOnce();
		expect(html).toContain('data-sentinel="yes"');
		expect(html).toContain('better-markdown-preview-code');
		expect(html).toContain('data-bmp-lines="1,3-4"');
		expect(html).toContain('data-bmp-line-numbers="true"');
		expect(html).not.toContain('[!code ++]');
		expect(html).not.toContain('onclick="bad"');
		expect(delegatedContent).not.toContain('[!code ++]');

		const escaped = render('```js title="<img src=x>"\nalert(1)\n```\n');
		expect(escaped).toContain('&lt;img src=x&gt;');
		expect(escaped).not.toContain('<img src=x>');
		expect(render('```js {not-lines}\nvalue\n```\n')).not.toContain(
			'better-markdown-preview-code',
		);
		expect(render('```js\nvalue [!code ++]\n```\n')).toContain(
			'value [!code ++]',
		);
	});
});
