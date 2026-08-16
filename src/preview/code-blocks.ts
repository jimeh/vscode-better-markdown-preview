export function enhanceCodeBlocks(
	document: Document,
	markdownBody: HTMLElement,
): void {
	for (const figure of markdownBody.querySelectorAll<HTMLElement>(
		'figure.better-markdown-preview-code:not([data-bmp-code-enhanced])',
	)) {
		figure.dataset.bmpCodeEnhanced = '';
		const code = figure.querySelector<HTMLElement>('pre > code');
		if (!code) {
			continue;
		}
		const lines = splitHighlightedLines(document, code);
		const highlighted = parseLineSet(figure.dataset.bmpLines, lines.length);
		const added = parseLineSet(figure.dataset.bmpAdded, lines.length);
		const removed = parseLineSet(figure.dataset.bmpRemoved, lines.length);
		const word = figure.dataset.bmpWord;
		for (let index = 0; index < lines.length; index += 1) {
			const number = index + 1;
			const line = lines[index];
			line.dataset.bmpCodeLine = String(number);
			line.classList.toggle(
				'better-markdown-preview-code-line-highlighted',
				highlighted.has(number),
			);
			line.classList.toggle(
				'better-markdown-preview-code-line-added',
				added.has(number),
			);
			line.classList.toggle(
				'better-markdown-preview-code-line-removed',
				removed.has(number),
			);
			if (word) {
				highlightLiteral(document, line, word);
			}
		}
	}
}

function splitHighlightedLines(
	document: Document,
	code: HTMLElement,
): HTMLElement[] {
	const endsWithNewline = code.textContent?.endsWith('\n') ?? false;
	const sourceNodes = Array.from(code.childNodes);
	const fragments: DocumentFragment[] = [document.createDocumentFragment()];
	let lineIndex = 0;
	const append = (node: Node, ancestors: Element[] = []): void => {
		if (node.nodeType === Node.TEXT_NODE) {
			const pieces = (node.textContent ?? '').split('\n');
			for (let index = 0; index < pieces.length; index += 1) {
				if (pieces[index]) {
					appendTextWithAncestors(
						document,
						fragments[lineIndex],
						pieces[index],
						ancestors,
					);
				}
				if (index < pieces.length - 1) {
					lineIndex += 1;
					fragments[lineIndex] = document.createDocumentFragment();
				}
			}
			return;
		}
		if (node instanceof Element) {
			if (node.tagName === 'BR') {
				lineIndex += 1;
				fragments[lineIndex] = document.createDocumentFragment();
				return;
			}
			for (const child of Array.from(node.childNodes)) {
				append(child, [...ancestors, node]);
			}
		}
	};
	for (const node of sourceNodes) {
		append(node);
	}
	if (
		endsWithNewline &&
		fragments.length > 1 &&
		fragments[fragments.length - 1].childNodes.length === 0
	) {
		fragments.pop();
	}
	code.replaceChildren();
	const lines = fragments.map((fragment, index) => {
		const line = document.createElement('span');
		line.className = 'better-markdown-preview-code-line';
		line.append(fragment);
		code.append(line);
		if (index < fragments.length - 1 || endsWithNewline) {
			code.append(document.createTextNode('\n'));
		}
		return line;
	});
	return lines;
}

function appendTextWithAncestors(
	document: Document,
	fragment: DocumentFragment,
	text: string,
	ancestors: Element[],
): void {
	let parent: Node = fragment;
	for (const ancestor of ancestors) {
		const clone = ancestor.cloneNode(false);
		parent.appendChild(clone);
		parent = clone;
	}
	parent.appendChild(document.createTextNode(text));
}

function highlightLiteral(
	document: Document,
	root: HTMLElement,
	literal: string,
): void {
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	const textNodes: Text[] = [];
	while (walker.nextNode()) {
		textNodes.push(walker.currentNode as Text);
	}
	for (const node of textNodes) {
		let current: Text | undefined = node;
		while (current) {
			const index = current.data.indexOf(literal);
			if (index < 0) {
				break;
			}
			const match = current.splitText(index);
			const rest = match.splitText(literal.length);
			const mark = document.createElement('mark');
			mark.className = 'better-markdown-preview-code-word';
			mark.textContent = match.data;
			match.replaceWith(mark);
			current = rest;
		}
	}
}

export function parseLineSet(
	value: string | undefined,
	maximum: number,
): Set<number> {
	const output = new Set<number>();
	for (const range of value?.split(',') ?? []) {
		const [startText, endText] = range.split('-');
		const start = Number(startText);
		const end = endText ? Number(endText) : start;
		if (
			!Number.isInteger(start) ||
			!Number.isInteger(end) ||
			start < 1 ||
			end < start
		) {
			continue;
		}
		if (start > maximum) {
			continue;
		}
		for (let line = start; line <= Math.min(end, maximum); line += 1) {
			output.add(line);
		}
	}
	return output;
}
