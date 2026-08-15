import type MarkdownIt from 'markdown-it';
import type Token from 'markdown-it/lib/token.mjs';
import { LinkifyIt } from 'linkify-it';
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
const colonClose = /^(:{3,})[ \t]*$/;
const gfmLinkifier = new LinkifyIt({ fuzzyLink: true });
let nestedBlockParseDepth = 0;
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
	md.core.ruler.after(
		'linkify',
		'better_markdown_preview_gfm_autolink',
		(state) => {
			for (const blockToken of state.tokens) {
				if (
					blockToken.type !== 'inline' ||
					!blockToken.children ||
					!gfmLinkifier.test(blockToken.content)
				) {
					continue;
				}
				const tokens = blockToken.children;
				let htmlLinkLevel = 0;
				for (let index = tokens.length - 1; index >= 0; index -= 1) {
					const current = tokens[index];
					if (current.type === 'link_close') {
						index -= 1;
						while (
							index >= 0 &&
							(tokens[index].level !== current.level ||
								tokens[index].type !== 'link_open')
						) {
							index -= 1;
						}
						continue;
					}
					if (current.type === 'html_inline') {
						if (/^<a[>\s]/i.test(current.content) && htmlLinkLevel > 0) {
							htmlLinkLevel -= 1;
						}
						if (/^<\/a\s*>/i.test(current.content)) {
							htmlLinkLevel += 1;
						}
					}
					if (htmlLinkLevel > 0 || current.type !== 'text') {
						continue;
					}
					let matches = (gfmLinkifier.match(current.content) ?? []).filter(
						(match) => {
							const schema = match.schema.toLowerCase();
							return (
								schema === 'http:' ||
								schema === 'https:' ||
								schema === 'mailto:' ||
								(schema === '' && /^www\./i.test(match.raw))
							);
						},
					);
					if (
						matches[0]?.index === 0 &&
						index > 0 &&
						tokens[index - 1].type === 'text_special'
					) {
						matches = matches.slice(1);
					}
					if (matches.length === 0) {
						continue;
					}
					const replacement: Token[] = [];
					let level = current.level;
					let lastPosition = 0;
					for (const match of matches) {
						const url = state.md.normalizeLink(match.url);
						if (!state.md.validateLink(url)) {
							continue;
						}
						if (match.index > lastPosition) {
							const text = new state.Token('text', '', 0);
							text.content = current.content.slice(lastPosition, match.index);
							text.level = level;
							replacement.push(text);
						}
						const open = new state.Token('link_open', 'a', 1);
						open.attrs = [['href', url]];
						open.level = level;
						level += 1;
						open.markup = 'linkify';
						open.info = 'auto';
						replacement.push(open);
						const text = new state.Token('text', '', 0);
						if (match.schema === '') {
							text.content = state.md
								.normalizeLinkText(`http://${match.text}`)
								.replace(/^http:\/\//, '');
						} else if (
							match.schema.toLowerCase() === 'mailto:' &&
							!/^mailto:/i.test(match.text)
						) {
							text.content = state.md
								.normalizeLinkText(`mailto:${match.text}`)
								.replace(/^mailto:/, '');
						} else {
							text.content = state.md.normalizeLinkText(match.text);
						}
						text.level = level;
						replacement.push(text);
						const close = new state.Token('link_close', 'a', -1);
						level -= 1;
						close.level = level;
						close.markup = 'linkify';
						close.info = 'auto';
						replacement.push(close);
						lastPosition = match.lastIndex;
					}
					if (lastPosition === 0) {
						continue;
					}
					if (lastPosition < current.content.length) {
						const text = new state.Token('text', '', 0);
						text.content = current.content.slice(lastPosition);
						text.level = level;
						replacement.push(text);
					}
					tokens.splice(index, 1, ...replacement);
				}
			}
		},
	);
}

function installGfmTagFilter(md: MarkdownIt): void {
	md.core.ruler.after(
		'better_markdown_preview_gfm_autolink',
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
			if (
				startLine !== 0 ||
				nestedBlockParseDepth > 0 ||
				state.parentType !== 'root'
			) {
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
	md.renderer.rules.better_markdown_preview_frontmatter = (
		tokens,
		index,
		_options,
		_env,
		renderer,
	) => {
		const token = tokens[index];
		token.attrJoin('class', 'better-markdown-preview-frontmatter');
		const source = md.utils.escapeHtml(token.content);
		return `<details${renderer.renderAttrs(token)}><summary>Frontmatter</summary><pre>${source}</pre></details>\n`;
	};
}

interface Column {
	openLine: number;
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
			const parsed = parseColumns(state, startLine + 1, endLine, outer.length);
			if (!parsed) {
				return false;
			}
			if (silent) {
				return true;
			}
			const open = state.push('better_markdown_preview_columns_open', 'div', 1);
			open.block = true;
			open.map = [startLine, startLine + 1];
			for (const column of parsed.columns) {
				const columnOpen = state.push(
					'better_markdown_preview_column_open',
					'div',
					1,
				);
				columnOpen.block = true;
				columnOpen.map = [column.openLine, column.openLine + 1];
				columnOpen.meta = { width: column.width };
				const childTokens: Token[] = [];
				const content = state.getLines(
					column.contentStart,
					column.contentEnd,
					0,
					false,
				);
				nestedBlockParseDepth += 1;
				try {
					state.md.block.parse(content, state.md, state.env, childTokens);
				} finally {
					nestedBlockParseDepth -= 1;
				}
				for (const child of childTokens) {
					if (child.map) {
						child.map = child.map.map((line) => line + column.contentStart) as [
							number,
							number,
						];
					}
					state.tokens.push(child);
				}
				state.push('better_markdown_preview_column_close', 'div', -1).block =
					true;
			}
			state.push('better_markdown_preview_columns_close', 'div', -1).block =
				true;
			state.line = parsed.closeLine + 1;
			return true;
		},
	);
	md.renderer.rules.better_markdown_preview_columns_open = (
		tokens,
		index,
		_options,
		_env,
		renderer,
	) => {
		const token = tokens[index];
		token.attrJoin('class', 'better-markdown-preview-columns');
		return `<div${renderer.renderAttrs(token)}>\n`;
	};
	md.renderer.rules.better_markdown_preview_columns_close = () => '</div>\n';
	md.renderer.rules.better_markdown_preview_column_open = (
		tokens,
		index,
		_options,
		_env,
		renderer,
	) => {
		const token = tokens[index];
		const width = (token.meta as { width?: string } | null)?.width;
		token.attrJoin('class', 'better-markdown-preview-column');
		if (width) {
			token.attrSet('data-bmp-column-width', width);
			token.attrSet('style', `--bmp-column-width: ${width}%`);
		}
		return `<div${renderer.renderAttrs(token)}>\n`;
	};
	md.renderer.rules.better_markdown_preview_column_close = () => '</div>\n';
}

interface ParsedColumns {
	columns: Column[];
	closeLine: number;
}

function parseColumns(
	state: Parameters<Parameters<MarkdownIt['block']['ruler']['before']>[2]>[0],
	startLine: number,
	endLine: number,
	outerLength: number,
): ParsedColumns | undefined {
	const columns: Column[] = [];
	let line = startLine;
	while (line < endLine) {
		const rawLine = rawLineAt(state, line);
		if (/^[ \t]*$/.test(rawLine)) {
			line += 1;
			continue;
		}
		const outerClose = colonClose.exec(rawLine);
		if (outerClose && outerClose[1].length === outerLength) {
			return columns.length >= 2 ? { columns, closeLine: line } : undefined;
		}
		const opening = columnOpen.exec(rawLine);
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
		let fenceCharacter: '`' | '~' | undefined;
		let fenceLength = 0;
		for (let childLine = line + 1; childLine < endLine; childLine += 1) {
			const child = rawLineAt(state, childLine);
			const fence = markdownFence(child.replace(/^[ \t]+/, ''));
			if (fence) {
				if (!fenceCharacter) {
					fenceCharacter = fence.character;
					fenceLength = fence.length;
				} else if (
					fence.character === fenceCharacter &&
					fence.length >= fenceLength &&
					fence.remainder.trim() === ''
				) {
					fenceCharacter = undefined;
					fenceLength = 0;
				}
				continue;
			}
			if (fenceCharacter) {
				continue;
			}
			if (columnsOpen.test(child) || columnOpen.test(child)) {
				return undefined;
			}
			const childClose = colonClose.exec(child);
			if (childClose) {
				if (childClose[1].length === outerLength) {
					return undefined;
				}
				if (childClose[1].length === delimiter.length) {
					closeLine = childLine;
					break;
				}
			}
		}
		if (closeLine < 0) {
			return undefined;
		}
		columns.push({
			openLine: line,
			contentStart: line + 1,
			contentEnd: closeLine,
			width,
		});
		line = closeLine + 1;
	}
	return undefined;
}

function markdownFence(
	line: string,
): { character: '`' | '~'; length: number; remainder: string } | undefined {
	const character = line[0];
	if (character !== '`' && character !== '~') {
		return undefined;
	}
	let length = 0;
	while (line[length] === character) {
		length += 1;
	}
	return length >= 3
		? { character, length, remainder: line.slice(length) }
		: undefined;
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
			token.attrJoin('class', 'better-markdown-preview-mermaid');
			token.attrSet('data-bmp-mermaid-source', '');
			token.attrSet('data-bmp-mermaid-state', 'source');
			return `<pre${renderer.renderAttrs(token)}>${md.utils.escapeHtml(token.content)}</pre>\n`;
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
