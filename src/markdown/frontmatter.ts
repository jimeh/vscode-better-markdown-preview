import type MarkdownIt from 'markdown-it';
import type Token from 'markdown-it/lib/token.mjs';
import { parse as parseToml } from 'smol-toml';
import type { BetterMarkdownPreviewConfiguration } from '../config';
import type { BlockParseContext } from './block-context';

type FenceRenderRule = NonNullable<MarkdownIt['renderer']['rules']['fence']>;

interface FrontmatterDefinition {
	language: 'toml' | 'yaml';
	delimiter: '+++' | '---';
	allowTrailingWhitespace: boolean;
}

export function installFrontmatter(
	md: MarkdownIt,
	configuration: BetterMarkdownPreviewConfiguration,
	context: BlockParseContext,
): void {
	const renderFence = md.renderer.rules.fence;
	const definitions: FrontmatterDefinition[] = [];
	if (configuration.rendering.tomlFrontmatter) {
		definitions.push({
			language: 'toml',
			delimiter: '+++',
			allowTrailingWhitespace: false,
		});
	}
	if (configuration.rendering.yamlFrontmatter) {
		definitions.push({
			language: 'yaml',
			delimiter: '---',
			allowTrailingWhitespace: true,
		});
	}
	for (const definition of definitions) {
		md.block.ruler.before(
			'fence',
			`better_markdown_preview_${definition.language}_frontmatter`,
			(state, startLine, endLine, silent) => {
				if (
					startLine !== 0 ||
					context.nestedDepth > 0 ||
					state.parentType !== 'root'
				) {
					return false;
				}
				const lineMatches = (line: string): boolean => {
					const value = definition.allowTrailingWhitespace
						? line.trimEnd()
						: line;
					return value === definition.delimiter;
				};
				const opening = rawLineAt(state, startLine).replace(/^\uFEFF/, '');
				if (!lineMatches(opening)) {
					return false;
				}
				let closeLine = -1;
				for (let line = 1; line < endLine; line += 1) {
					if (lineMatches(rawLineAt(state, line))) {
						closeLine = line;
						break;
					}
				}
				if (closeLine < 0) {
					return false;
				}
				const content = state.getLines(1, closeLine, 0, false);
				if (definition.language === 'toml') {
					try {
						parseToml(content);
					} catch {
						return false;
					}
				}
				if (silent) {
					return true;
				}
				const token = state.push('better_markdown_preview_frontmatter', '', 0);
				token.block = true;
				token.map = [0, closeLine + 1];
				token.info = definition.language;
				token.content = content;
				state.line = closeLine + 1;
				return true;
			},
		);
	}
	md.renderer.rules.better_markdown_preview_frontmatter = (
		tokens,
		index,
		options,
		env,
		renderer,
	) => {
		const token = tokens[index];
		token.attrJoin('class', 'better-markdown-preview-frontmatter');
		const fence = Object.assign(
			Object.create(Object.getPrototypeOf(token)) as Token,
			token,
		);
		fence.type = 'fence';
		fence.tag = 'code';
		fence.nesting = 0;
		fence.attrs = null;
		fence.map = null;
		return `<details open${renderer.renderAttrs(token)}><summary>Frontmatter</summary>${renderPrevious(renderFence, [fence], 0, options, env, renderer)}</details>\n`;
	};
}

function renderPrevious(
	previous: FenceRenderRule | undefined,
	tokens: Token[],
	index: number,
	options: Parameters<FenceRenderRule>[2],
	env: unknown,
	renderer: Parameters<FenceRenderRule>[4],
): string {
	return previous
		? previous(tokens, index, options, env, renderer)
		: `<pre><code>${tokens[index].content
				.replaceAll('&', '&amp;')
				.replaceAll('<', '&lt;')
				.replaceAll('>', '&gt;')
				.replaceAll('"', '&quot;')}</code></pre>\n`;
}

function rawLineAt(
	state: { bMarks: number[]; eMarks: number[]; src: string },
	line: number,
): string {
	return state.src.slice(state.bMarks[line], state.eMarks[line]);
}
