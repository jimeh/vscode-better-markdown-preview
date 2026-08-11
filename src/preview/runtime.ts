export interface MermaidTheme {
	dark: boolean;
	background: string;
	foreground: string;
	border: string;
	accent: string;
}

export interface MermaidAdapter {
	render(
		element: HTMLElement,
		source: string,
		theme: MermaidTheme,
	): Promise<void>;
}

export interface PreviewOptions {
	loadMermaid?: () => Promise<MermaidAdapter>;
}

export interface PreviewController {
	ready: Promise<void>;
	dispose(): void;
}

interface SharedController {
	references: number;
	ready: Promise<void>;
	dispose(): void;
}

const controllers = new WeakMap<Document, SharedController>();

export function enhancePreview(
	document: Document,
	options: PreviewOptions = {},
): PreviewController {
	let shared = controllers.get(document);
	if (!shared) {
		shared = createController(document, options);
		controllers.set(document, shared);
	}
	shared.references += 1;
	let disposed = false;
	return {
		ready: shared.ready,
		dispose() {
			if (disposed) {
				return;
			}
			disposed = true;
			if (!shared) {
				return;
			}
			shared.references -= 1;
			if (shared.references === 0) {
				shared.dispose();
				controllers.delete(document);
			}
		},
	};
}

function createController(
	document: Document,
	options: PreviewOptions,
): SharedController {
	let disposed = false;
	let scheduled = false;
	let scrollFrame = 0;
	let mermaidAdapter: MermaidAdapter | undefined;
	let mermaidQueue = Promise.resolve();
	const mermaidSources = new WeakMap<HTMLElement, string>();
	const cleanups: Array<() => void> = [];
	const tocCleanups: Array<() => void> = [];
	const loadMermaid = options.loadMermaid ?? defaultMermaidLoader;

	const renderMermaidPass = async (force = false): Promise<void> => {
		const blocks = Array.from(
			document.querySelectorAll<HTMLElement>('[data-bmp-mermaid-source]'),
		);
		const pending = blocks.filter(
			(block) =>
				force ||
				(block.dataset.bmpMermaidState !== 'rendered' &&
					block.dataset.bmpMermaidState !== 'failed'),
		);
		if (pending.length === 0) {
			return;
		}
		try {
			mermaidAdapter ??= await loadMermaid();
		} catch {
			for (const block of pending) {
				block.dataset.bmpMermaidState = 'failed';
			}
			return;
		}
		const theme = readTheme(document);
		for (const block of pending) {
			if (block.dataset.bmpMermaidState === 'source') {
				mermaidSources.set(block, block.textContent ?? '');
			} else if (!mermaidSources.has(block)) {
				mermaidSources.set(block, block.textContent ?? '');
			}
			const source = mermaidSources.get(block) ?? '';
			block.dataset.bmpMermaidState = 'rendering';
			try {
				await mermaidAdapter?.render(block, source, theme);
				block.dataset.bmpMermaidState = 'rendered';
			} catch {
				block.textContent = source;
				block.dataset.bmpMermaidState = 'failed';
			}
		}
	};

	const renderMermaid = (force = false): Promise<void> => {
		const queued = mermaidQueue.then(() => renderMermaidPass(force));
		mermaidQueue = queued.catch(() => undefined);
		return queued;
	};

	const enhance = async (): Promise<void> => {
		if (disposed) {
			return;
		}
		const markdownBody = document.querySelector<HTMLElement>('.markdown-body');
		if (!markdownBody) {
			return;
		}
		const layout = ensureLayout(document, markdownBody);
		for (const cleanup of tocCleanups.splice(0)) {
			cleanup();
		}
		buildToc(document, layout, markdownBody, tocCleanups);
		enhanceCodeBlocks(document, markdownBody);
		updateActiveHeading();
		await renderMermaid();
	};

	const schedule = (): void => {
		if (scheduled || disposed) {
			return;
		}
		scheduled = true;
		queueMicrotask(() => {
			scheduled = false;
			void enhance();
		});
	};

	const containsMarkdownBody = (node: Node): boolean =>
		node.nodeType === Node.ELEMENT_NODE &&
		((node as Element).matches('.markdown-body') ||
			Boolean((node as Element).querySelector('.markdown-body')));
	const contentObserver = new MutationObserver((mutations) => {
		if (
			mutations.some(
				(mutation) =>
					mutation.type === 'childList' &&
					(Boolean((mutation.target as Element).closest?.('.markdown-body')) ||
						Array.from(mutation.addedNodes).some(containsMarkdownBody) ||
						Array.from(mutation.removedNodes).some(containsMarkdownBody)),
			)
		) {
			schedule();
		}
	});
	contentObserver.observe(document.body, { childList: true, subtree: true });

	const themeObserver = new MutationObserver(() => {
		void renderMermaid(true);
	});
	themeObserver.observe(document.body, {
		attributes: true,
		attributeFilter: ['class'],
	});

	const updateActiveHeading = (): void => {
		scrollFrame = 0;
		const trackedLinks = Array.from(
			document.querySelectorAll<HTMLAnchorElement>(
				'[data-bmp-toc] [data-bmp-heading-id]',
			),
		);
		const headings = trackedLinks
			.map((link) => document.getElementById(link.dataset.bmpHeadingId ?? ''))
			.filter((heading): heading is HTMLElement => heading !== null);
		let active: HTMLElement | undefined = headings[0];
		const scrollHeight = document.documentElement.scrollHeight;
		const atBottom =
			scrollHeight > 0 &&
			Math.ceil(window.scrollY + window.innerHeight) >= scrollHeight;
		if (atBottom) {
			active = headings.at(-1);
		} else {
			for (const heading of headings) {
				if (heading.getBoundingClientRect().top <= 96) {
					active = heading;
				}
			}
		}
		for (const link of document.querySelectorAll<HTMLAnchorElement>(
			'[data-bmp-heading-id]',
		)) {
			const selected = link.dataset.bmpHeadingId === active?.id;
			link.classList.toggle('better-markdown-preview-toc-active', selected);
			if (selected) {
				link.setAttribute('aria-current', 'location');
			} else {
				link.removeAttribute('aria-current');
			}
		}
	};
	const onScroll = (): void => {
		if (!scrollFrame) {
			scrollFrame = requestAnimationFrame(updateActiveHeading);
		}
	};
	window.addEventListener('scroll', onScroll, { passive: true });
	cleanups.push(() => window.removeEventListener('scroll', onScroll));

	const ready = enhance();
	return {
		references: 0,
		ready,
		dispose() {
			disposed = true;
			contentObserver.disconnect();
			themeObserver.disconnect();
			if (scrollFrame) {
				cancelAnimationFrame(scrollFrame);
			}
			for (const cleanup of cleanups.splice(0)) {
				cleanup();
			}
			for (const cleanup of tocCleanups.splice(0)) {
				cleanup();
			}
		},
	};
}

function ensureLayout(
	document: Document,
	markdownBody: HTMLElement,
): HTMLElement {
	const existing = markdownBody.closest<HTMLElement>('[data-bmp-layout]');
	if (existing) {
		return existing;
	}
	const layout = document.createElement('div');
	layout.className = 'better-markdown-preview-layout';
	layout.dataset.bmpLayout = '';
	markdownBody.before(layout);
	layout.append(markdownBody);
	return layout;
}

function buildToc(
	document: Document,
	layout: HTMLElement,
	markdownBody: HTMLElement,
	cleanups: Array<() => void>,
): void {
	for (const owned of layout.querySelectorAll(
		':scope > [data-bmp-toc], :scope > [data-bmp-toc-trigger], :scope > [data-bmp-toc-dialog]',
	)) {
		owned.remove();
	}
	const allHeadings = Array.from(
		markdownBody.querySelectorAll<HTMLElement>('h1[id], h2[id], h3[id]'),
	);
	const headings =
		allHeadings[0]?.tagName === 'H1' ? allHeadings.slice(1) : allHeadings;
	if (headings.length < 2) {
		return;
	}
	const nav = document.createElement('nav');
	nav.className = 'better-markdown-preview-toc';
	nav.dataset.bmpToc = '';
	nav.setAttribute('aria-label', 'Table of contents');
	nav.append(createTocList(document, headings));
	layout.prepend(nav);

	const trigger = document.createElement('button');
	trigger.type = 'button';
	trigger.className = 'better-markdown-preview-toc-trigger';
	trigger.dataset.bmpTocTrigger = '';
	trigger.textContent = 'Contents';
	trigger.setAttribute('aria-haspopup', 'dialog');
	trigger.setAttribute('aria-expanded', 'false');
	layout.append(trigger);

	const dialog = document.createElement('dialog');
	dialog.className = 'better-markdown-preview-toc-dialog';
	dialog.dataset.bmpTocDialog = '';
	dialog.setAttribute('aria-label', 'Table of contents');
	dialog.append(createTocList(document, headings));
	layout.append(dialog);

	const close = (): void => {
		if (dialog.hasAttribute('open')) {
			if (typeof dialog.close === 'function') {
				dialog.close();
			} else {
				dialog.removeAttribute('open');
			}
		}
		trigger.setAttribute('aria-expanded', 'false');
		trigger.focus();
	};
	const open = (): void => {
		if (!dialog.hasAttribute('open')) {
			if (typeof dialog.showModal === 'function') {
				try {
					dialog.showModal();
				} catch {
					dialog.setAttribute('open', '');
				}
			} else {
				dialog.setAttribute('open', '');
			}
		}
		trigger.setAttribute('aria-expanded', 'true');
		dialog.querySelector<HTMLAnchorElement>('a')?.focus();
	};
	trigger.addEventListener('click', open);
	dialog.addEventListener('cancel', (event) => {
		event.preventDefault();
		close();
	});
	dialog.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') {
			event.preventDefault();
			close();
		}
	});
	dialog.addEventListener('click', (event) => {
		const bounds = dialog.getBoundingClientRect();
		const outside =
			event.clientX < bounds.left ||
			event.clientX > bounds.right ||
			event.clientY < bounds.top ||
			event.clientY > bounds.bottom;
		if (event.target === dialog && outside) {
			close();
		}
	});
	for (const link of dialog.querySelectorAll('a')) {
		link.addEventListener('click', close);
	}
	const updateFloatingTrigger = (): void => {
		trigger.classList.toggle(
			'better-markdown-preview-toc-trigger-visible',
			nav.getBoundingClientRect().bottom < 0,
		);
	};
	window.addEventListener('scroll', updateFloatingTrigger, { passive: true });
	updateFloatingTrigger();
	cleanups.push(() =>
		window.removeEventListener('scroll', updateFloatingTrigger),
	);
}

function createTocList(
	document: Document,
	headings: HTMLElement[],
): HTMLElement {
	const container = document.createElement('div');
	const title = document.createElement('strong');
	title.className = 'better-markdown-preview-toc-title';
	title.textContent = 'On this page';
	container.append(title);
	const list = document.createElement('ol');
	for (const heading of headings) {
		const item = document.createElement('li');
		item.className = `better-markdown-preview-toc-level-${heading.tagName.slice(1)}`;
		const link = document.createElement('a');
		link.href = `#${encodeURIComponent(heading.id)}`;
		link.dataset.bmpHeadingId = heading.id;
		link.textContent = heading.textContent?.trim() || heading.id;
		item.append(link);
		list.append(item);
	}
	container.append(list);
	return container;
}

function enhanceCodeBlocks(
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

function readTheme(document: Document): MermaidTheme {
	const styles = getComputedStyle(document.body);
	const read = (name: string, fallback: string): string =>
		styles.getPropertyValue(name).trim() || fallback;
	return {
		dark: document.body.classList.contains('vscode-dark'),
		background: read('--vscode-editor-background', '#ffffff'),
		foreground: read('--vscode-editor-foreground', '#1f2328'),
		border: read('--vscode-panel-border', '#8c8c8c'),
		accent: read('--vscode-textLink-foreground', '#0969da'),
	};
}

async function defaultMermaidLoader(): Promise<MermaidAdapter> {
	return import('./mermaid-runtime.js');
}
