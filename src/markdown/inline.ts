import { LinkifyIt } from 'linkify-it';
import type MarkdownIt from 'markdown-it';
import type Token from 'markdown-it/lib/token.mjs';

export const escapedMarkdownPunctuationToken =
	'better_markdown_preview_escaped_punctuation';
const blockedGfmTags =
	/<(?=\/?(?:title|textarea|style|xmp|iframe|noembed|noframes|script|plaintext)(?:\s|>|\/))/gi;
const gfmLinkifier = new LinkifyIt({ fuzzyLink: true });

export function installEscapedMarkdownProtection(md: MarkdownIt): void {
	// VS Code 1.125's escape rule otherwise merges escaped punctuation back into
	// adjacent text before the emoji core rule can distinguish authored syntax.
	md.inline.ruler.before(
		'escape',
		escapedMarkdownPunctuationToken,
		(state, silent) => {
			const position = state.pos;
			if (
				position + 1 >= state.posMax ||
				state.src.charCodeAt(position) !== 0x5c ||
				!md.utils.isMdAsciiPunct(state.src.charCodeAt(position + 1))
			) {
				return false;
			}
			if (!silent) {
				const token = state.push(escapedMarkdownPunctuationToken, '', 0);
				token.content = state.src[position + 1];
				token.markup = '\\';
			}
			state.pos = position + 2;
			return true;
		},
	);
	md.renderer.rules[escapedMarkdownPunctuationToken] = (tokens, index) =>
		md.utils.escapeHtml(tokens[index].content);
}

export function installGfmAutolinks(md: MarkdownIt): void {
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
						(tokens[index - 1].type === 'text_special' ||
							tokens[index - 1].type === escapedMarkdownPunctuationToken)
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

export function installGfmTagFilter(md: MarkdownIt, afterRule: string): void {
	md.core.ruler.after(
		afterRule,
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
