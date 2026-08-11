import type MarkdownIt from 'markdown-it';
import type Token from 'markdown-it/lib/token.mjs';
import definitionList from 'markdown-it-deflist';
import footnote from 'markdown-it-footnote';
import githubAlerts from 'markdown-it-github-alerts';
import taskLists from 'markdown-it-task-lists';
import { parse as parseToml } from 'smol-toml';

const blockedGfmTags =
	/<(?=\/?(?:title|textarea|style|xmp|iframe|noembed|noframes|script|plaintext)(?:\s|>|\/))/gi;
const columnsOpen = /^(:{4,})[ \t]+\{\.columns\}[ \t]*$/;
const columnOpen =
	/^(:{3,})[ \t]+\{\.column(?:[ \t]+width=(?:"((?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+))%"|'((?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+))%'|((?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+))%))?\}[ \t]*$/;
type FenceRenderRule = NonNullable<MarkdownIt['renderer']['rules']['fence']>;

export function extendMarkdownIt(md: MarkdownIt): MarkdownIt {
	md.use(taskLists, { enabled: false });
	md.use(definitionList);
	md.use(footnote);
	md.use(githubAlerts, {
		classPrefix: 'better-markdown-preview-alert',
		matchCaseSensitive: true,
		icons: {},
	});
	installTomlFrontmatter(md);
	installColumns(md);
	installGfmAutolinks(md);
	installGfmTagFilter(md);
	installFenceRenderer(md);
	return md;
}

function installGfmAutolinks(md: MarkdownIt): void {
	const linkify = md.linkify;
	md.core.ruler.after(
		'inline',
		'better_markdown_preview_autolinks',
		(state) => {
			for (const block of state.tokens) {
				if (!block.children) {
					continue;
				}
				let linkDepth = 0;
				const children: Token[] = [];
				for (const child of block.children) {
					if (child.type === 'link_open') {
						linkDepth += 1;
					}
					if (child.type !== 'text' || linkDepth > 0) {
						children.push(child);
					} else {
						children.push(...linkifyText(child, state.Token, linkify));
					}
					if (child.type === 'link_close') {
						linkDepth -= 1;
					}
				}
				block.children = children;
			}
		},
	);
}

function linkifyText(
	token: Token,
	TokenConstructor: typeof Token,
	linkify: MarkdownIt['linkify'],
): Token[] {
	const matches = linkify.match(token.content);
	if (!matches) {
		return [token];
	}
	const output: Token[] = [];
	let offset = 0;
	for (const match of matches) {
		if (match.index > offset) {
			output.push(
				textToken(TokenConstructor, token.content.slice(offset, match.index)),
			);
		}
		const open = new TokenConstructor('link_open', 'a', 1);
		open.attrSet('href', match.url);
		output.push(open, textToken(TokenConstructor, match.text));
		output.push(new TokenConstructor('link_close', 'a', -1));
		offset = match.lastIndex;
	}
	if (offset < token.content.length) {
		output.push(textToken(TokenConstructor, token.content.slice(offset)));
	}
	return output;
}

function textToken(TokenConstructor: typeof Token, content: string): Token {
	const token = new TokenConstructor('text', '', 0);
	token.content = content;
	return token;
}

function installGfmTagFilter(md: MarkdownIt): void {
	md.core.ruler.after(
		'better_markdown_preview_autolinks',
		'better_markdown_preview_tagfilter',
		(state) => {
			const visit = (tokens: Token[]): void => {
				for (const token of tokens) {
					if (token.type === 'html_block' || token.type === 'html_inline') {
						token.content = token.content.replace(blockedGfmTags, '&lt;');
					}
					if (token.children) {
						visit(token.children);
					}
				}
			};
			visit(state.tokens);
		},
	);
}

function installTomlFrontmatter(md: MarkdownIt): void {
	md.block.ruler.before(
		'fence',
		'better_markdown_preview_toml_frontmatter',
		(state, startLine, endLine, silent) => {
			if (startLine !== 0) {
				return false;
			}
			const opening = rawLineAt(state, startLine).replace(/^\uFEFF/, '');
			if (opening !== '+++') {
				return false;
			}
			let closeLine = -1;
			for (let line = 1; line < endLine; line += 1) {
				if (rawLineAt(state, line) === '+++') {
					closeLine = line;
					break;
				}
			}
			if (closeLine < 0) {
				return false;
			}
			try {
				parseToml(state.getLines(1, closeLine, 0, false));
			} catch {
				return false;
			}
			if (silent) {
				return true;
			}
			const raw = state
				.getLines(0, closeLine + 1, 0, false)
				.replace(/^\uFEFF/, '');
			const token = state.push('better_markdown_preview_frontmatter', '', 0);
			token.block = true;
			token.map = [0, closeLine + 1];
			token.content = raw;
			state.line = closeLine + 1;
			return true;
		},
	);
	md.renderer.rules.better_markdown_preview_frontmatter = (tokens, index) => {
		const source = md.utils.escapeHtml(tokens[index].content);
		return `<details class="better-markdown-preview-frontmatter"><summary>Frontmatter</summary><pre>${source}</pre></details>\n`;
	};
}

interface Column {
	contentStart: number;
	contentEnd: number;
	width?: string;
}

function installColumns(md: MarkdownIt): void {
	md.block.ruler.before(
		'fence',
		'better_markdown_preview_columns',
		(state, startLine, endLine, silent) => {
			const opener = columnsOpen.exec(rawLineAt(state, startLine));
			if (!opener) {
				return false;
			}
			const outer = opener[1];
			let closeLine = -1;
			for (let line = startLine + 1; line < endLine; line += 1) {
				if (rawLineAt(state, line) === outer) {
					closeLine = line;
					break;
				}
			}
			if (closeLine < 0) {
				return false;
			}
			const columns = parseColumns(
				state,
				startLine + 1,
				closeLine,
				outer.length,
			);
			if (!columns || columns.length < 2) {
				return false;
			}
			if (silent) {
				return true;
			}
			const open = state.push('html_block', '', 0);
			open.content = '<div class="better-markdown-preview-columns">\n';
			open.map = [startLine, startLine + 1];
			for (const column of columns) {
				const style = column.width
					? ` style="--bmp-column-width: ${column.width}%"`
					: '';
				const columnOpen = state.push('html_block', '', 0);
				columnOpen.content = `<div class="better-markdown-preview-column"${style}>\n`;
				const childTokens: Token[] = [];
				const content = state.getLines(
					column.contentStart,
					column.contentEnd,
					0,
					false,
				);
				state.md.block.parse(content, state.md, state.env, childTokens);
				for (const child of childTokens) {
					if (child.map) {
						child.map = child.map.map((line) => line + column.contentStart) as [
							number,
							number,
						];
					}
					state.tokens.push(child);
				}
				const columnClose = state.push('html_block', '', 0);
				columnClose.content = '</div>\n';
			}
			const close = state.push('html_block', '', 0);
			close.content = '</div>\n';
			close.map = [closeLine, closeLine + 1];
			state.line = closeLine + 1;
			return true;
		},
	);
}

function parseColumns(
	state: Parameters<Parameters<MarkdownIt['block']['ruler']['before']>[2]>[0],
	startLine: number,
	endLine: number,
	outerLength: number,
): Column[] | undefined {
	const columns: Column[] = [];
	let line = startLine;
	while (line < endLine) {
		if (/^[ \t]*$/.test(rawLineAt(state, line))) {
			line += 1;
			continue;
		}
		const opening = columnOpen.exec(rawLineAt(state, line));
		if (!opening || opening[1].length >= outerLength) {
			return undefined;
		}
		const width = opening[2] ?? opening[3] ?? opening[4];
		const numericWidth = width === undefined ? undefined : Number(width);
		if (
			numericWidth !== undefined &&
			(numericWidth <= 0 || numericWidth > 100)
		) {
			return undefined;
		}
		const delimiter = opening[1];
		let closeLine = -1;
		for (let childLine = line + 1; childLine < endLine; childLine += 1) {
			const child = rawLineAt(state, childLine);
			if (columnsOpen.test(child) || columnOpen.test(child)) {
				return undefined;
			}
			if (child === delimiter) {
				closeLine = childLine;
				break;
			}
		}
		if (closeLine < 0) {
			return undefined;
		}
		columns.push({ contentStart: line + 1, contentEnd: closeLine, width });
		line = closeLine + 1;
	}
	return columns;
}

function rawLineAt(
	state: { bMarks: number[]; eMarks: number[]; src: string },
	line: number,
): string {
	return state.src.slice(state.bMarks[line], state.eMarks[line]);
}

interface FenceMetadata {
	info: string;
	title?: string;
	lines?: string;
	word?: string;
	lineNumbers: boolean;
}

function installFenceRenderer(md: MarkdownIt): void {
	const previous = md.renderer.rules.fence;
	md.renderer.rules.fence = (tokens, index, options, env, renderer) => {
		const token = tokens[index];
		if (token.info === 'mermaid') {
			return `<pre class="better-markdown-preview-mermaid" data-bmp-mermaid-source data-bmp-mermaid-state="source">${md.utils.escapeHtml(token.content)}</pre>\n`;
		}
		const metadata = parseFenceMetadata(token.info);
		const annotations = parseDiffAnnotations(token.content);
		if (
			!metadata.title &&
			!metadata.lines &&
			!metadata.word &&
			!metadata.lineNumbers &&
			!annotations.changed
		) {
			return renderPrevious(previous, tokens, index, options, env, renderer);
		}
		const clonedTokens = tokens.slice();
		const cloned = Object.assign(
			Object.create(Object.getPrototypeOf(token)) as Token,
			token,
		);
		cloned.info = metadata.info;
		cloned.content = annotations.content;
		clonedTokens[index] = cloned;
		const attributes = [
			metadata.lines ? ` data-bmp-lines="${metadata.lines}"` : '',
			metadata.word
				? ` data-bmp-word="${md.utils.escapeHtml(metadata.word)}"`
				: '',
			metadata.lineNumbers ? ' data-bmp-line-numbers="true"' : '',
			annotations.added.length
				? ` data-bmp-added="${annotations.added.join(',')}"`
				: '',
			annotations.removed.length
				? ` data-bmp-removed="${annotations.removed.join(',')}"`
				: '',
		].join('');
		const caption = metadata.title
			? `<figcaption>${md.utils.escapeHtml(metadata.title)}</figcaption>`
			: '';
		return `<figure class="better-markdown-preview-code"${attributes}>${caption}${renderPrevious(previous, clonedTokens, index, options, env, renderer)}</figure>\n`;
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
		: `<pre><code>${escapeHtml(tokens[index].content)}</code></pre>\n`;
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

function parseFenceMetadata(info: string): FenceMetadata {
	let remaining = info.trim();
	let title: string | undefined;
	let lines: string | undefined;
	let word: string | undefined;
	remaining = remaining.replace(
		/(?:^|\s)title="([^"\n]*)"/,
		(_match, value: string) => {
			title = value;
			return ' ';
		},
	);
	remaining = remaining.replace(
		/(?:^|\s)\{(\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*)\}/,
		(_match, value: string) => {
			lines = value;
			return ' ';
		},
	);
	remaining = remaining.replace(
		/(?:^|\s)\/([^/\n]+)\//,
		(_match, value: string) => {
			word = value;
			return ' ';
		},
	);
	const lineNumbers = /(?:^|\s)showLineNumbers(?:\s|$)/.test(remaining);
	remaining = remaining.replace(/(?:^|\s)showLineNumbers(?=\s|$)/, ' ');
	return {
		info: remaining.trim().replace(/\s+/g, ' '),
		title,
		lines,
		word,
		lineNumbers,
	};
}

function parseDiffAnnotations(content: string): {
	content: string;
	added: number[];
	removed: number[];
	changed: boolean;
} {
	const added: number[] = [];
	const removed: number[] = [];
	const lines = content.split('\n');
	for (let index = 0; index < lines.length; index += 1) {
		const match = /\s*(?:\/\/|#)\s*\[!code (\+\+|--)\]\s*$/.exec(lines[index]);
		if (!match) {
			continue;
		}
		(match[1] === '++' ? added : removed).push(index + 1);
		lines[index] = lines[index].slice(0, match.index).trimEnd();
	}
	return {
		content: lines.join('\n'),
		added,
		removed,
		changed: added.length + removed.length > 0,
	};
}
