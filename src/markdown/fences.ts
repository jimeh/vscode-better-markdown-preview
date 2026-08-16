import type MarkdownIt from 'markdown-it';
import type Token from 'markdown-it/lib/token.mjs';
import type { BetterMarkdownPreviewConfiguration } from '../config';

type FenceRenderRule = NonNullable<MarkdownIt['renderer']['rules']['fence']>;

interface FenceMetadata {
	info: string;
	title?: string;
	lines?: string;
	word?: string;
	lineNumbers: boolean;
}

export function installFenceRenderer(
	md: MarkdownIt,
	configuration: BetterMarkdownPreviewConfiguration,
): void {
	const previous = md.renderer.rules.fence;
	md.renderer.rules.fence = (tokens, index, options, env, renderer) => {
		const token = tokens[index];
		if (configuration.rendering.mermaid && token.info === 'mermaid') {
			token.attrJoin('class', 'better-markdown-preview-mermaid');
			token.attrSet('data-bmp-mermaid-source', '');
			token.attrSet('data-bmp-mermaid-state', 'source');
			return `<pre${renderer.renderAttrs(token)}>${md.utils.escapeHtml(token.content)}</pre>\n`;
		}
		if (!configuration.rendering.richCodeBlocks) {
			return renderPrevious(previous, tokens, index, options, env, renderer);
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
		: `<pre><code>${tokens[index].content
				.replaceAll('&', '&amp;')
				.replaceAll('<', '&lt;')
				.replaceAll('>', '&gt;')
				.replaceAll('"', '&quot;')}</code></pre>\n`;
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
