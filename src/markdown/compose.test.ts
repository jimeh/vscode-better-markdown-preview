import MarkdownIt from 'markdown-it';
import { describe, expect, test, vi } from 'vitest';
import {
	defaultConfiguration,
	type BetterMarkdownPreviewConfiguration,
} from '../config';
import { extendMarkdownIt } from './compose';

function render(
	source: string,
	configure?: (md: MarkdownIt) => void,
	configuration: BetterMarkdownPreviewConfiguration = defaultConfiguration,
): string {
	const md = new MarkdownIt({ html: true, linkify: false });
	configure?.(md);
	extendMarkdownIt(md, configuration);
	return md.render(source);
}

function disableRendering(
	feature: keyof BetterMarkdownPreviewConfiguration['rendering'],
): BetterMarkdownPreviewConfiguration {
	return configureRendering({ [feature]: false });
}

function configureRendering(
	overrides: Partial<BetterMarkdownPreviewConfiguration['rendering']>,
): BetterMarkdownPreviewConfiguration {
	return {
		...defaultConfiguration,
		rendering: {
			...defaultConfiguration.rendering,
			...overrides,
		},
	};
}

describe('Markdown composition', () => {
	test('keeps every rendering feature enabled by default', () => {
		const html = render(
			'+++\ntitle = "Test"\n+++\n\n- [x] Task\n\nTerm\n: Definition\n\nFootnote[^1].\n\n[^1]: Note\n\n> [!NOTE]\n> Alert\n\nEmoji :joy:\n\n:::: {.columns}\n::: {.column}\nLeft\n:::\n::: {.column}\nRight\n:::\n::::\n\nhttps://example.com\n\n```mermaid\ngraph TD\nA-->B\n```\n\n```ts title="test.ts"\nvalue\n```\n',
		);
		for (const marker of [
			'task-list-item',
			'<dl>',
			'footnote-ref',
			'better-markdown-preview-alert-note',
			'😂',
			'better-markdown-preview-frontmatter',
			'better-markdown-preview-columns',
			'href="https://example.com"',
			'data-bmp-mermaid-source',
			'better-markdown-preview-code',
		]) {
			expect(html, marker).toContain(marker);
		}
	});

	test.each([
		['taskLists', 'task-list-item'],
		['definitionLists', '<dl>'],
		['footnotes', 'footnote-ref'],
		['githubAlerts', 'better-markdown-preview-alert-note'],
		['emojiShortcodes', '😂'],
		['tomlFrontmatter', 'better-markdown-preview-frontmatter'],
		['columns', 'better-markdown-preview-columns'],
		['enhancedAutolinks', 'href="https://example.com"'],
	] as const)('disables only the %s parser feature', (feature, marker) => {
		const parserMarkers = [
			'task-list-item',
			'<dl>',
			'footnote-ref',
			'better-markdown-preview-alert-note',
			'😂',
			'better-markdown-preview-frontmatter',
			'better-markdown-preview-columns',
			'href="https://example.com"',
		];
		const html = render(
			'+++\ntitle = "Test"\n+++\n\n- [x] Task\n\nTerm\n: Definition\n\nFootnote[^1].\n\n[^1]: Note\n\n> [!NOTE]\n> Alert\n\nEmoji :joy:\n\n:::: {.columns}\n::: {.column}\nLeft\n:::\n::: {.column}\nRight\n:::\n::::\n\nhttps://example.com\n\n<script>blocked()</script>\n',
			undefined,
			disableRendering(feature),
		);
		expect(html).not.toContain(marker);
		for (const otherMarker of parserMarkers.filter(
			(candidate) => candidate !== marker,
		)) {
			expect(html, otherMarker).toContain(otherMarker);
		}
		expect(html).toContain('&lt;script>blocked()&lt;/script>');
	});

	test('gates Mermaid and rich fences independently', () => {
		const source =
			'```mermaid\ngraph TD\nA-->B\n```\n\n```ts title="test.ts"\nvalue\n```\n';
		const noMermaid = render(source, undefined, disableRendering('mermaid'));
		expect(noMermaid).not.toContain('data-bmp-mermaid-source');
		expect(noMermaid).toContain('better-markdown-preview-code');

		const noRichCode = render(
			source,
			undefined,
			disableRendering('richCodeBlocks'),
		);
		expect(noRichCode).toContain('data-bmp-mermaid-source');
		expect(noRichCode).not.toContain('better-markdown-preview-code');
	});

	test('emits one valid marker containing only preview settings', () => {
		const configuration: BetterMarkdownPreviewConfiguration = {
			...defaultConfiguration,
			navigation: { tableOfContents: false, smoothScrolling: true },
			mermaid: { viewer: false },
		};
		const html = render('# Configured\n', undefined, configuration);
		const raw = /data-bmp-preview-config="([^"]+)"/.exec(html)?.[1];

		expect(html.match(/data-bmp-preview-config=/g)).toHaveLength(1);
		expect(raw).toBeDefined();
		expect(JSON.parse(raw!.replaceAll('&quot;', '"'))).toEqual({
			tableOfContents: false,
			smoothScrolling: true,
			mermaidViewer: false,
		});
		expect(raw).not.toContain('taskLists');
	});

	test('does not append the block configuration marker to inline renders', () => {
		const md = new MarkdownIt({ html: true, linkify: false });
		extendMarkdownIt(md);
		expect(md.renderInline('plain *inline* text')).toBe(
			'plain <em>inline</em> text',
		);
	});

	test('renders named emoji shortcodes without changing code, escapes, unknown names, or link destinations', () => {
		const html = render(
			'Named :joy:, unknown :bmp_unknown:, escaped \\:joy:, and internal :woman\\_technologist: and :\\+1:.\n\n[Label :joy:](https://example.com/:joy:/more) and https://example.com/:joy:/more.\n\n`inline :joy:`\n\n```text\nfenced :joy:\n```\n\n    indented :joy:\n',
		);

		expect(html).toContain(
			'Named 😂, unknown :bmp_unknown:, escaped :joy:, and internal :woman_technologist: and :+1:.',
		);
		expect(html).toContain(
			'<a href="https://example.com/:joy:/more">Label 😂</a>',
		);
		expect(html).toContain(
			'<a href="https://example.com/:joy:/more">https://example.com/:joy:/more</a>',
		);
		expect(html).toContain('<code>inline :joy:</code>');
		expect(html).toContain('fenced :joy:');
		expect(html).toContain('indented :joy:');
	});

	test('keeps emoticon shortcuts opt-in and subordinate to emoji shortcodes', () => {
		expect(render(':joy: :)\n')).toContain('<p>😂 :)</p>');
		expect(
			render(
				':joy: :)\n',
				undefined,
				configureRendering({ emoticonShortcuts: true }),
			),
		).toContain('<p>😂 😃</p>');
		expect(
			render(
				'\\:) \\<3 \\;) :\\)\n',
				undefined,
				configureRendering({ emoticonShortcuts: true }),
			),
		).toContain('<p>:) &lt;3 ;) :)</p>');
		expect(
			render(
				':joy: :)\n',
				undefined,
				configureRendering({
					emojiShortcodes: false,
					emoticonShortcuts: true,
				}),
			),
		).toContain('<p>:joy: :)</p>');
	});

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

	test('fills all GFM literal autolinks when native linkify is disabled', () => {
		const md = new MarkdownIt({ html: true, linkify: false });
		extendMarkdownIt(md);
		md.options.linkify = false;
		const html = md.render(
			'https://example.com/a_(b) http://plain.example dev@example.com www.example.com ftp://excluded.example example.com\n',
		);
		expect(html).toContain('href="https://example.com/a_(b)"');
		expect(html).toContain('href="http://plain.example"');
		expect(html).toContain('href="mailto:dev@example.com"');
		expect(html).toContain('href="http://www.example.com"');
		expect(html).not.toContain('href="ftp://excluded.example"');
		expect(html).not.toContain('href="http://example.com"');
	});

	test('does not duplicate GFM literal autolinks when native linkify is enabled', () => {
		const html = render(
			'https://example.com dev@example.com www.example.com\n',
			(md) => {
				md.options.linkify = true;
				md.linkify.set({ fuzzyLink: false });
			},
		);
		expect(html.match(/<a /g)).toHaveLength(3);
		expect(html.match(/href="https:\/\/example\.com"/g)).toHaveLength(1);
		expect(html.match(/href="mailto:dev@example\.com"/g)).toHaveLength(1);
		expect(html.match(/href="http:\/\/www\.example\.com"/g)).toHaveLength(1);
	});

	test('normalizes autolinks and leaves validator-rejected protocols literal', () => {
		expect(render('Visit https://münich.example/path.\n')).toContain(
			'href="https://xn--mnich-kva.example/path"',
		);

		const rejected = render(
			'Keep blocked://unsafe.example literal.\n',
			(md) => {
				md.linkify.add('blocked:', { validate: /^\/\/[a-z.]+/ });
				const validateLink = md.validateLink.bind(md);
				md.validateLink = (url) =>
					!url.startsWith('blocked:') && validateLink(url);
			},
		);
		expect(rejected).toContain('blocked://unsafe.example');
		expect(rejected).not.toContain('<a');
	});

	test('uses native linkify guards for escapes and existing anchors', () => {
		const html = render(
			'Escaped http\\://escaped.example, \\:www.example.com, and [existing](https://existing.example).\n\n<a href="/raw">https://inside.example</a>\n',
		);
		expect(html).not.toContain('href="http://escaped.example"');
		expect(html).not.toContain('href="http://www.example.com"');
		expect(html).toContain(':www.example.com');
		expect(html).toContain('href="https://existing.example"');
		expect(html).toContain('<a href="/raw">https://inside.example</a>');
		expect(html.match(/<a /g)).toHaveLength(2);
	});

	test('preserves GFM boundaries when VS Code disables fuzzy links', () => {
		const html = render(
			'www.example.com www.münich.com https://scheme.example dev@example.com example.com www\\.escaped.com [www.linked.com](https://target.example)\n\n<a href="/raw">www.inside.com</a>\n',
			(md) => md.linkify.set({ fuzzyLink: false }),
		);
		expect(html).toContain('href="http://www.example.com"');
		expect(html).toContain('href="http://www.xn--mnich-kva.com"');
		expect(html).toContain('href="https://scheme.example"');
		expect(html).toContain('href="mailto:dev@example.com"');
		expect(html).not.toContain('href="http://example.com"');
		expect(html).not.toContain('href="http://www.escaped.com"');
		expect(html).toContain(
			'<a href="https://target.example">www.linked.com</a>',
		);
		expect(html).toContain('<a href="/raw">www.inside.com</a>');

		const rejected = render('www.blocked.com\n', (md) => {
			md.linkify.set({ fuzzyLink: false });
			const validateLink = md.validateLink.bind(md);
			md.validateLink = (url) =>
				url !== 'http://www.blocked.com' && validateLink(url);
		});
		expect(rejected).not.toContain('<a');
		expect(rejected).toContain('www.blocked.com');
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
		expect(escaped).toMatch(/<details(?=[^>]*\bopen\b)[^>]*>/);
		expect(escaped).toContain('language-toml');
		expect(escaped).toContain('&lt;unsafe&gt;');
		expect(escaped).not.toContain('+++');
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
	});

	test('renders YAML frontmatter as expanded highlighted code without delimiters', () => {
		const html = render(
			'---\ntitle: YAML frontmatter\nnested:\n  enabled: true\n---\n\n# Body\n',
		);
		expect(html).toContain('better-markdown-preview-frontmatter');
		expect(html).toMatch(/<details(?=[^>]*\bopen\b)[^>]*>/);
		expect(html).toContain('language-yaml');
		expect(html).toContain('title: YAML frontmatter');
		expect(html).not.toContain('---');
		expect(html).not.toContain('<table class="frontmatter"');
		expect(render('\uFEFF---\ntitle: BOM\n---\n')).toContain(
			'better-markdown-preview-frontmatter',
		);
		expect(render('---  \ntitle: spaced\n---\t\n')).toContain(
			'better-markdown-preview-frontmatter',
		);
		expect(render('\n---\ntitle: late\n---\n')).not.toContain(
			'better-markdown-preview-frontmatter',
		);
		expect(render('---\ntitle: unclosed\n')).not.toContain(
			'better-markdown-preview-frontmatter',
		);
	});

	test('delegates YAML frontmatter when its renderer is disabled', () => {
		const html = render(
			'---\ntitle: delegated\n---\n',
			undefined,
			disableRendering('yamlFrontmatter'),
		);
		expect(html).not.toContain('better-markdown-preview-frontmatter');
		expect(html).toContain('<hr>');
		expect(html).toContain('title: delegated');
	});

	test('delegates frontmatter syntax highlighting to the supplied fence renderer', () => {
		const languages: string[] = [];
		const contents: string[] = [];
		const sentinel = vi.fn(
			(tokens: Array<{ info: string; content: string }>, index: number) => {
				languages.push(tokens[index].info);
				contents.push(tokens[index].content);
				return `<pre data-language="${tokens[index].info}"><code>highlighted</code></pre>`;
			},
		);
		for (const source of [
			'+++\ntitle = "TOML"\n+++\n',
			'---\ntitle: YAML\n---\n',
		]) {
			const html = render(source, (md) => {
				md.renderer.rules.fence = sentinel;
			});
			expect(html).toContain('highlighted');
		}
		expect(languages).toEqual(['toml', 'yaml']);
		expect(contents).toEqual(['title = "TOML"', 'title: YAML']);
	});

	test('does not recognize frontmatter in nested Markdown parses', () => {
		for (const nested of [
			'> +++\n> title = "quote"\n> +++\n',
			'> ---\n> title: quote\n> ---\n',
			'- +++\n  title = "list"\n  +++\n',
			':::: {.columns}\n::: {.column}\n+++\ntitle = "column"\n+++\n:::\n::: {.column}\nOther\n:::\n::::\n',
		]) {
			expect(render(nested)).not.toContain(
				'better-markdown-preview-frontmatter',
			);
		}
	});

	test('renders valid columns and leaves malformed structures literal', () => {
		const validSource =
			':::: {.columns}\n::: {.column width=40%}\n**Left**\n:::\n::: {.column}\nRight\n:::\n::::\n';
		const valid = render(validSource);
		expect(valid).toContain('better-markdown-preview-columns');
		expect(valid).toContain('data-bmp-column-width="40"');
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
			':::: {.columns}\n::: {.column}\nA\n:::: \nStill A\n:::\n::: {.column}\nB\n:::\n::::\n',
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

	test('accepts spaced closers and ignores container syntax inside code fences', () => {
		for (const fence of ['```', '~~~']) {
			const html = render(
				`:::: {.columns}\n::: {.column width=40%}\n${fence}text\n::: {.column}\n::::\n${fence}\nA\n::: \t\n::: {.column}\nB\n:::  \n::::\t\n`,
			);
			expect(html).toContain('better-markdown-preview-columns');
			expect(html).toContain('<code class="language-text">');
			expect(html).toContain('::: {.column}');
		}
	});

	test('does not treat indented fence-like code as a Markdown fence', () => {
		for (const indent of ['    ', '\t']) {
			const html = render(
				`:::: {.columns}\n::: {.column}\n${indent}\`\`\`\nIndented code\n:::\n::: {.column}\nB\n:::\n::::\n`,
			);
			expect(html).toContain('better-markdown-preview-columns');
			expect(html).toContain('<pre><code>```');
		}
	});

	test('does not treat invalid backtick fence info as an opener', () => {
		const html = render(
			':::: {.columns}\n::: {.column}\n```bad`info\nNot a fence\n:::\n::: {.column}\nB\n:::\n::::\n',
		);
		expect(html).toContain('better-markdown-preview-columns');
		expect(html).not.toContain('<code class="language-bad`info">');
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

	test('preserves VS Code source-map attributes on owned block wrappers', () => {
		const html = render(
			'+++\ntitle = "Mapped"\n+++\n\n```mermaid\ngraph TD\nA-->B\n```\n\n:::: {.columns}\n::: {.column}\nLeft\n:::\n::: {.column}\nRight\n:::\n::::\n',
			(md) => {
				md.core.ruler.push('source_map_like_vscode', (state) => {
					for (const token of state.tokens) {
						if (token.map && token.type !== 'inline') {
							token.attrSet('data-line', String(token.map[0]));
							token.attrJoin('class', 'code-line');
							token.attrJoin('dir', 'auto');
						}
					}
				});
			},
		);
		expect(html).toMatch(
			/<details(?=[^>]*better-markdown-preview-frontmatter)(?=[^>]*data-line="0")[^>]*>/,
		);
		expect(html).toMatch(
			/<pre(?=[^>]*better-markdown-preview-mermaid)(?=[^>]*data-line="4")[^>]*>/,
		);
		expect(html).toMatch(
			/<div(?=[^>]*better-markdown-preview-columns)(?=[^>]*data-line="9")[^>]*>/,
		);
		expect(html).toMatch(
			/<div(?=[^>]*better-markdown-preview-column)(?=[^>]*data-line="10")[^>]*>/,
		);
		expect(html).toMatch(/<p[^>]*data-line="11"[^>]*>Left<\/p>/);
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
