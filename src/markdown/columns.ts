import type MarkdownIt from 'markdown-it';
import type Token from 'markdown-it/lib/token.mjs';
import type { BlockParseContext } from './block-context';

const columnsOpen = /^(:{4,})[ \t]+\{\.columns\}[ \t]*$/;
const columnOpen =
	/^(:{3,})[ \t]+\{\.column(?:[ \t]+width=(?:"((?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+))%"|'((?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+))%'|((?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+))%))?\}[ \t]*$/;
const colonClose = /^(:{3,})[ \t]*$/;

interface Column {
	openLine: number;
	contentStart: number;
	contentEnd: number;
	width?: string;
}

interface ParsedColumns {
	columns: Column[];
	closeLine: number;
}

export function installColumns(
	md: MarkdownIt,
	context: BlockParseContext,
): void {
	md.block.ruler.before(
		'fence',
		'better_markdown_preview_columns',
		(state, startLine, endLine, silent) => {
			const opener = columnsOpen.exec(rawLineAt(state, startLine));
			if (!opener) {
				return false;
			}
			const parsed = parseColumns(
				state,
				startLine + 1,
				endLine,
				opener[1].length,
			);
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
				const columnToken = state.push(
					'better_markdown_preview_column_open',
					'div',
					1,
				);
				columnToken.block = true;
				columnToken.map = [column.openLine, column.openLine + 1];
				columnToken.meta = { width: column.width };
				const childTokens: Token[] = [];
				const content = state.getLines(
					column.contentStart,
					column.contentEnd,
					0,
					false,
				);
				context.nestedDepth += 1;
				try {
					state.md.block.parse(content, state.md, state.env, childTokens);
				} finally {
					context.nestedDepth -= 1;
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
			const fence =
				state.sCount[childLine] - state.blkIndent < 4
					? markdownFence(
							state.src.slice(
								state.bMarks[childLine] + state.tShift[childLine],
								state.eMarks[childLine],
							),
						)
					: undefined;
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
	const remainder = line.slice(length);
	return length >= 3 && (character !== '`' || !remainder.includes('`'))
		? { character, length, remainder }
		: undefined;
}

function rawLineAt(
	state: { bMarks: number[]; eMarks: number[]; src: string },
	line: number,
): string {
	return state.src.slice(state.bMarks[line], state.eMarks[line]);
}
