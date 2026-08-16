export const renderCompatibilityFixture = `+++
title = "Host compatibility"
+++

# Host compatibility

- [x] task list

Term
: Definition

Footnote[^1].

[^1]: Footnote detail

> [!NOTE]
> Known alert

Emoji :joy:, escaped \\:joy:, internal :woman\\_technologist: and :\\+1:, emoticon :), and \`inline :joy:\`.

https://secure.example/path http://plain.example dev@example.com www.example.com example.com

<script>blocked()</script>

:::: {.columns}
::: {.column width=40%}
Left
:::
::: {.column}
Right
:::
::::

\`\`\`mermaid
graph TD
A-->B
\`\`\`

\`\`\`Mermaid
graph TD
B-->C
\`\`\`

\`\`\`ts title="host.ts" {1} /const/ showLineNumbers
const value = true; // [!code ++]
\`\`\`
`;

export const yamlFrontmatterCompatibilityFixture = `---
title: Host compatibility
enabled: true
---

# YAML body
`;

const configurationRoundTripFixture = `# Configuration round trip

Named :joy:. Shortcut :). Escaped \\:). Internal :\\).

:::: {.columns}
::: {.column width=40%}
Left
:::
::: {.column}
Right
:::
::::
`;

type RenderMarkdown = (source: string) => PromiseLike<string | undefined>;

type UpdateConfiguration = (
	key:
		| 'rendering.columns'
		| 'rendering.emojiShortcodes'
		| 'rendering.emoticonShortcuts'
		| 'mermaid.viewer',
	value: boolean | undefined,
) => PromiseLike<void>;

interface OriginalConfiguration {
	'rendering.columns': boolean | undefined;
	'rendering.emojiShortcodes': boolean | undefined;
	'rendering.emoticonShortcuts': boolean | undefined;
	'mermaid.viewer': boolean | undefined;
}

async function waitForRender(
	render: RenderMarkdown,
	accept: (html: string) => boolean,
	description: string,
): Promise<string> {
	const deadline = Date.now() + 5_000;
	let html: string;
	do {
		const result = await render(configurationRoundTripFixture);
		if (typeof result !== 'string') {
			throw new Error('markdown.api.render did not return HTML.');
		}
		html = result;
		if (accept(html)) {
			return html;
		}
		await new Promise((resolve) => setTimeout(resolve, 50));
	} while (Date.now() < deadline);

	throw new Error(`Host render did not ${description}. Last HTML: ${html}`);
}

export async function assertConfigurationRoundTrip(
	render: RenderMarkdown,
	update: UpdateConfiguration,
	original: OriginalConfiguration,
): Promise<void> {
	let failure: { reason: unknown } | undefined;
	try {
		await update('mermaid.viewer', undefined);
		await update('rendering.columns', undefined);
		await update('rendering.emojiShortcodes', undefined);
		await update('rendering.emoticonShortcuts', undefined);
		await waitForRender(
			render,
			(html) =>
				html.includes('better-markdown-preview-columns') &&
				html.includes('Named 😂. Shortcut :). Escaped :). Internal :).') &&
				html.includes('&quot;mermaidViewer&quot;:true'),
			'start from default rendering settings',
		);

		await update('rendering.emoticonShortcuts', true);
		await waitForRender(
			render,
			(html) =>
				html.includes('Named 😂. Shortcut 😃. Escaped :). Internal :).'),
			'enable emoticon shortcuts',
		);

		await update('rendering.emojiShortcodes', false);
		await waitForRender(
			render,
			(html) =>
				html.includes('Named :joy:. Shortcut :). Escaped :). Internal :).'),
			'delegate named emoji and emoticon shortcuts together',
		);

		await update('rendering.emojiShortcodes', undefined);
		await update('rendering.emoticonShortcuts', undefined);

		await update('rendering.columns', false);
		await waitForRender(
			render,
			(html) => !html.includes('better-markdown-preview-columns'),
			'delegate columns after disabling the renderer',
		);

		await update('mermaid.viewer', false);
		await waitForRender(
			render,
			(html) => html.includes('&quot;mermaidViewer&quot;:false'),
			'emit a disabled Mermaid viewer marker',
		);

		await update('mermaid.viewer', undefined);
		await update('rendering.columns', undefined);
		await waitForRender(
			render,
			(html) =>
				html.includes('better-markdown-preview-columns') &&
				html.includes('Named 😂. Shortcut :). Escaped :). Internal :).') &&
				html.includes('&quot;mermaidViewer&quot;:true'),
			'restore default rendering after resetting settings',
		);
	} catch (error) {
		failure = { reason: error };
	} finally {
		const restoreResults = await Promise.allSettled([
			update('mermaid.viewer', original['mermaid.viewer']),
			update('rendering.columns', original['rendering.columns']),
			update(
				'rendering.emojiShortcodes',
				original['rendering.emojiShortcodes'],
			),
			update(
				'rendering.emoticonShortcuts',
				original['rendering.emoticonShortcuts'],
			),
		]);
		const restoreFailures = restoreResults.flatMap((result) =>
			result.status === 'rejected' ? [result.reason] : [],
		);
		if (restoreFailures.length > 0) {
			const restorationError = new AggregateError(
				restoreFailures,
				'Failed to restore global preview configuration.',
			);
			if (failure) {
				console.error(
					'Configuration restoration also failed:',
					restorationError,
				);
			} else {
				failure = { reason: restorationError };
			}
		}
	}
	if (failure) {
		throw failure.reason;
	}
}

function requireMatch(
	html: string,
	pattern: RegExp,
	description: string,
): void {
	if (!pattern.test(html)) {
		throw new Error(`Host render is missing ${description}.`);
	}
}

function requireCountAtLeast(
	html: string,
	pattern: RegExp,
	minimum: number,
	description: string,
): void {
	const matches = html.match(pattern)?.length ?? 0;
	if (matches < minimum) {
		throw new Error(
			`Host render has ${matches} ${description}; expected at least ${minimum}.`,
		);
	}
}

function requireCount(
	html: string,
	pattern: RegExp,
	expected: number,
	description: string,
): void {
	const matches = html.match(pattern)?.length ?? 0;
	if (matches !== expected) {
		throw new Error(
			`Host render has ${matches} ${description}; expected exactly ${expected}.`,
		);
	}
}

export function assertRenderCompatibility(html: string): void {
	requireMatch(
		html,
		/data-bmp-preview-config="\{&quot;tableOfContents&quot;:true,&quot;smoothScrolling&quot;:true,&quot;mermaidViewer&quot;:true,&quot;mermaidTheme&quot;:\{&quot;primary&quot;:12,&quot;secondary&quot;:18,&quot;tertiary&quot;:10,&quot;border&quot;:45\}\}"/,
		'default preview configuration marker',
	);
	requireMatch(html, /task-list-item/, 'task-list semantics');
	requireMatch(html, /<dl[ >]/, 'definition-list semantics');
	requireMatch(html, /footnote-ref/, 'footnote semantics');
	requireMatch(
		html,
		/better-markdown-preview-alert-note/,
		'known GitHub alert semantics',
	);
	requireMatch(html, /Emoji 😂,/, 'named emoji shortcodes');
	requireMatch(html, /escaped :joy:/, 'escaped emoji shortcodes');
	requireMatch(
		html,
		/internal :woman_technologist: and :\+1:/,
		'internally escaped emoji shortcodes',
	);
	requireMatch(html, /emoticon :\),/, 'default-off emoticon shortcuts');
	requireMatch(html, /<code>inline :joy:<\/code>/, 'inline code exclusion');
	requireMatch(html, /href="https:\/\/secure\.example\/path"/, 'HTTPS link');
	requireMatch(html, /href="http:\/\/plain\.example"/, 'HTTP link');
	requireMatch(html, /href="mailto:dev@example\.com"/, 'email link');
	requireMatch(html, /href="http:\/\/www\.example\.com"/, 'www link');
	if (/href="http:\/\/example\.com"/.test(html)) {
		throw new Error('Host render unexpectedly fuzzy-linked a bare domain.');
	}
	requireMatch(
		html,
		/&lt;script>blocked\(\)&lt;\/script>/,
		'GFM tag filtering',
	);
	requireMatch(html, /better-markdown-preview-frontmatter/, 'TOML frontmatter');
	requireMatch(
		html,
		/<details(?=[^>]*better-markdown-preview-frontmatter)(?=[^>]*\bopen\b)[^>]*>/,
		'expanded TOML frontmatter',
	);
	requireMatch(html, /language-toml/, 'native TOML syntax highlighting');
	if (html.includes('+++')) {
		throw new Error('Host render retained TOML frontmatter delimiters.');
	}
	requireMatch(html, /better-markdown-preview-columns/, 'column container');
	requireMatch(html, /data-bmp-column-width="40"/, 'column width');
	requireCount(html, /data-bmp-mermaid-source/g, 1, 'exact Mermaid blocks');
	requireMatch(
		html,
		/graph TD\s+B--&gt;C/,
		'non-exact Mermaid source delegated to a native fence',
	);
	requireMatch(html, /better-markdown-preview-code/, 'rich fence wrapper');
	requireMatch(html, /data-bmp-lines="1"/, 'rich fence line selection');
	requireMatch(html, /data-bmp-line-numbers="true"/, 'rich fence line numbers');
	requireMatch(html, /language-ts/, 'native fence delegation');
	if (html.includes('[!code ++]')) {
		throw new Error('Host render retained a consumed diff annotation.');
	}
	requireCountAtLeast(
		html,
		/better-markdown-preview-(?:alert|frontmatter|columns|mermaid|code)/g,
		5,
		'Better Markdown Preview-owned output markers',
	);
	requireMatch(
		html,
		/<(?:details|pre|div|figure)(?=[^>]*better-markdown-preview-)(?=[^>]*data-line="\d+")[^>]*>/,
		'native source-map attributes on owned output',
	);
}

export function assertYamlFrontmatterCompatibility(html: string): void {
	requireMatch(
		html,
		/<details(?=[^>]*better-markdown-preview-frontmatter)(?=[^>]*\bopen\b)(?=[^>]*data-line="0")[^>]*>/,
		'expanded YAML frontmatter',
	);
	requireMatch(html, /language-yaml/, 'native YAML syntax highlighting');
	if (html.includes('<table class="frontmatter"')) {
		throw new Error(
			'Host render delegated YAML frontmatter to the native table.',
		);
	}
	if (html.includes('---')) {
		throw new Error('Host render retained YAML frontmatter delimiters.');
	}
}
