import {
	defaultConfiguration,
	previewConfiguration,
	type PreviewConfiguration,
} from '../config';

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

interface MermaidViewer {
	enhance(block: HTMLElement): void;
	reconcile(): void;
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
	let mermaidViewer: MermaidViewer | undefined;
	let settings = previewConfiguration(defaultConfiguration);
	let smoothScrollCleanup: (() => void) | undefined;
	let mermaidQueue = Promise.resolve();
	const mermaidSources = new WeakMap<HTMLElement, string>();
	const cleanups: Array<() => void> = [];
	const loadMermaid = options.loadMermaid ?? defaultMermaidLoader;
	const beginSmoothTocNavigation = (): void => {
		if (
			!settings.smoothScrolling ||
			window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
		) {
			return;
		}
		smoothScrollCleanup?.();
		const root = document.documentElement;
		let animationFrame = 0;
		let timeout = 0;
		const cleanup = (): void => {
			root.classList.remove('better-markdown-preview-smooth-scroll');
			if (animationFrame) {
				window.cancelAnimationFrame(animationFrame);
			}
			window.clearTimeout(timeout);
			if (smoothScrollCleanup === cleanup) {
				smoothScrollCleanup = undefined;
			}
		};
		root.classList.add('better-markdown-preview-smooth-scroll');
		animationFrame = window.requestAnimationFrame(() => {
			animationFrame = 0;
			cleanup();
		});
		timeout = window.setTimeout(cleanup, 1_000);
		smoothScrollCleanup = cleanup;
	};
	const syncMermaidViewer = (): void => {
		if (!settings.mermaidViewer) {
			mermaidViewer?.dispose();
			mermaidViewer = undefined;
			for (const trigger of document.querySelectorAll(
				'[data-bmp-mermaid-open]',
			)) {
				trigger.remove();
			}
			return;
		}
		mermaidViewer?.reconcile();
		for (const block of document.querySelectorAll<HTMLElement>(
			'[data-bmp-mermaid-source][data-bmp-mermaid-state="rendered"]',
		)) {
			if (!block.querySelector('svg')) {
				continue;
			}
			mermaidViewer ??= createMermaidViewer(document);
			mermaidViewer.enhance(block);
		}
	};

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
		const queued = mermaidQueue.then(async () => {
			await renderMermaidPass(force);
			syncMermaidViewer();
		});
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
		settings = readPreviewConfiguration(markdownBody);
		if (!settings.smoothScrolling) {
			smoothScrollCleanup?.();
		}
		if (settings.tableOfContents) {
			buildToc(document, layout, markdownBody, beginSmoothTocNavigation);
		} else {
			clearToc(layout);
			if (scrollFrame) {
				cancelAnimationFrame(scrollFrame);
				scrollFrame = 0;
			}
		}
		enhanceCodeBlocks(document, markdownBody);
		if (settings.tableOfContents) {
			updateActiveHeading();
		}
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
			mutations.some((mutation) =>
				mutation.type === 'attributes'
					? (mutation.target as Element).matches?.('[data-bmp-preview-config]')
					: Boolean((mutation.target as Element).closest?.('.markdown-body')) ||
						Array.from(mutation.addedNodes).some(containsMarkdownBody) ||
						Array.from(mutation.removedNodes).some(containsMarkdownBody),
			)
		) {
			schedule();
		}
	});
	contentObserver.observe(document.body, {
		attributes: true,
		attributeFilter: ['data-bmp-preview-config'],
		childList: true,
		subtree: true,
	});

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
		if (settings.tableOfContents && !scrollFrame) {
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
			mermaidViewer?.dispose();
			smoothScrollCleanup?.();
		},
	};
}

export function readPreviewConfiguration(
	markdownBody: HTMLElement,
): PreviewConfiguration {
	const defaults = previewConfiguration(defaultConfiguration);
	const markers = markdownBody.querySelectorAll<HTMLElement>(
		'[data-bmp-preview-config]',
	);
	const raw = markers.item(markers.length - 1)?.dataset.bmpPreviewConfig;
	if (!raw) {
		return defaults;
	}
	try {
		const parsed = JSON.parse(raw) as Partial<PreviewConfiguration>;
		return {
			tableOfContents:
				typeof parsed.tableOfContents === 'boolean'
					? parsed.tableOfContents
					: defaults.tableOfContents,
			smoothScrolling:
				typeof parsed.smoothScrolling === 'boolean'
					? parsed.smoothScrolling
					: defaults.smoothScrolling,
			mermaidViewer:
				typeof parsed.mermaidViewer === 'boolean'
					? parsed.mermaidViewer
					: defaults.mermaidViewer,
		};
	} catch {
		return defaults;
	}
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

let mermaidCloneId = 0;

function createMermaidViewer(document: Document): MermaidViewer {
	const dialog = document.createElement('dialog');
	dialog.className = 'better-markdown-preview-mermaid-dialog';
	dialog.dataset.bmpMermaidDialog = '';
	dialog.setAttribute(
		'aria-labelledby',
		'better-markdown-preview-mermaid-title',
	);

	const shell = document.createElement('div');
	shell.className = 'better-markdown-preview-mermaid-dialog-shell';
	const header = document.createElement('header');
	header.className = 'better-markdown-preview-mermaid-dialog-header';
	const title = document.createElement('strong');
	title.id = 'better-markdown-preview-mermaid-title';
	title.textContent = 'Mermaid diagram';
	header.append(title);

	const toolbar = document.createElement('div');
	toolbar.className = 'better-markdown-preview-mermaid-toolbar';
	toolbar.setAttribute('role', 'toolbar');
	toolbar.setAttribute('aria-label', 'Diagram zoom controls');
	const zoomOut = createMermaidButton(document, 'Zoom out', 'zoom-out', '−');
	const zoomValue = document.createElement('output');
	zoomValue.className = 'better-markdown-preview-mermaid-zoom-value';
	zoomValue.dataset.bmpMermaidZoomValue = '';
	zoomValue.setAttribute('aria-live', 'polite');
	zoomValue.textContent = '100%';
	const zoomIn = createMermaidButton(document, 'Zoom in', 'zoom-in', '+');
	const fit = createMermaidButton(document, 'Fit diagram', 'fit', 'Fit');
	const closeButton = createMermaidButton(
		document,
		'Close diagram viewer',
		'close',
		'×',
	);
	toolbar.append(zoomOut, zoomValue, zoomIn, fit, closeButton);
	header.append(toolbar);

	const canvas = document.createElement('div');
	canvas.className = 'better-markdown-preview-mermaid-canvas';
	canvas.dataset.bmpMermaidCanvas = '';
	canvas.tabIndex = 0;
	canvas.setAttribute(
		'aria-label',
		'Zoomable Mermaid diagram. Scroll or use plus and minus to zoom. Drag or use arrow keys to pan.',
	);
	const surface = document.createElement('div');
	surface.className = 'better-markdown-preview-mermaid-surface';
	surface.dataset.bmpMermaidSurface = '';
	canvas.append(surface);

	const help = document.createElement('p');
	help.className = 'better-markdown-preview-mermaid-help';
	help.textContent = 'Scroll to zoom · Drag to pan · 0 to fit';
	shell.append(header, canvas, help);
	dialog.append(shell);
	document.body.append(dialog);

	let sourceBlock: HTMLElement | undefined;
	let returnFocus: HTMLElement | undefined;
	let viewerSvg: SVGSVGElement | undefined;
	let naturalWidth = 1;
	let naturalHeight = 1;
	let scale = 1;
	let panX = 0;
	let panY = 0;
	let activePointer: number | null = null;
	let pointerStartX = 0;
	let pointerStartY = 0;
	let pointerPanX = 0;
	let pointerPanY = 0;

	const applyTransform = (): void => {
		surface.style.transform = `translate(${panX}px, ${panY}px)`;
		if (viewerSvg) {
			viewerSvg.style.transform = `translate(-50%, -50%) scale(${scale})`;
		}
		zoomValue.textContent = `${Math.round(scale * 100)}%`;
	};

	const fitDiagram = (): void => {
		const bounds = canvas.getBoundingClientRect();
		const availableWidth = Math.max(bounds.width - 48, 1);
		const availableHeight = Math.max(bounds.height - 48, 1);
		scale = clamp(
			Math.min(
				availableWidth / naturalWidth,
				availableHeight / naturalHeight,
				1,
			),
			0.05,
			8,
		);
		panX = 0;
		panY = 0;
		applyTransform();
	};

	const setZoom = (
		nextScale: number,
		clientX?: number,
		clientY?: number,
	): void => {
		const clamped = clamp(nextScale, 0.05, 8);
		if (clamped === scale) {
			return;
		}
		if (clientX !== undefined && clientY !== undefined) {
			const bounds = canvas.getBoundingClientRect();
			const offsetX = clientX - (bounds.left + bounds.width / 2) - panX;
			const offsetY = clientY - (bounds.top + bounds.height / 2) - panY;
			const ratio = clamped / scale;
			panX += offsetX * (1 - ratio);
			panY += offsetY * (1 - ratio);
		}
		scale = clamped;
		applyTransform();
	};

	const showSvg = (svg: SVGSVGElement, reset: boolean): void => {
		viewerSvg = cloneMermaidSvg(svg);
		const size = readSvgSize(svg);
		naturalWidth = size.width;
		naturalHeight = size.height;
		viewerSvg.style.width = `${naturalWidth}px`;
		viewerSvg.style.height = `${naturalHeight}px`;
		viewerSvg.style.maxWidth = 'none';
		viewerSvg.style.maxHeight = 'none';
		surface.replaceChildren(viewerSvg);
		if (reset) {
			fitDiagram();
		} else {
			applyTransform();
		}
	};

	const close = (restoreFocus = true): void => {
		if (dialog.hasAttribute('open')) {
			if (typeof dialog.close === 'function') {
				dialog.close();
			} else {
				dialog.removeAttribute('open');
			}
		}
		if (restoreFocus && returnFocus?.isConnected) {
			returnFocus.focus();
		}
		sourceBlock = undefined;
		returnFocus = undefined;
	};

	const open = (block: HTMLElement, trigger: HTMLButtonElement): void => {
		const svg = block.querySelector<SVGSVGElement>('svg');
		if (!svg) {
			return;
		}
		sourceBlock = block;
		returnFocus = trigger;
		showSvg(svg, true);
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
		fitDiagram();
		canvas.focus();
	};

	zoomOut.addEventListener('click', () => setZoom(scale / 1.25));
	zoomIn.addEventListener('click', () => setZoom(scale * 1.25));
	fit.addEventListener('click', fitDiagram);
	closeButton.addEventListener('click', () => close());
	dialog.addEventListener('cancel', (event) => {
		event.preventDefault();
		close();
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
	dialog.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') {
			event.preventDefault();
			close();
			return;
		}
		if (event.key === '+' || event.key === '=') {
			event.preventDefault();
			setZoom(scale * 1.25);
			return;
		}
		if (event.key === '-') {
			event.preventDefault();
			setZoom(scale / 1.25);
			return;
		}
		if (event.key === '0') {
			event.preventDefault();
			fitDiagram();
			return;
		}
		if (event.target !== canvas) {
			return;
		}
		const panStep = event.shiftKey ? 120 : 40;
		const direction = {
			ArrowLeft: [panStep, 0],
			ArrowRight: [-panStep, 0],
			ArrowUp: [0, panStep],
			ArrowDown: [0, -panStep],
		}[event.key];
		if (direction) {
			event.preventDefault();
			panX += direction[0];
			panY += direction[1];
			applyTransform();
		}
	});
	canvas.addEventListener(
		'wheel',
		(event) => {
			event.preventDefault();
			setZoom(
				scale * (event.deltaY < 0 ? 1.2 : 1 / 1.2),
				event.clientX,
				event.clientY,
			);
		},
		{ passive: false },
	);
	canvas.addEventListener('pointerdown', (event) => {
		if (event.button !== 0) {
			return;
		}
		activePointer = event.pointerId;
		pointerStartX = event.clientX;
		pointerStartY = event.clientY;
		pointerPanX = panX;
		pointerPanY = panY;
		canvas.classList.add('better-markdown-preview-mermaid-canvas-panning');
		canvas.setPointerCapture?.(event.pointerId);
	});
	canvas.addEventListener('pointermove', (event) => {
		if (activePointer !== event.pointerId) {
			return;
		}
		panX = pointerPanX + event.clientX - pointerStartX;
		panY = pointerPanY + event.clientY - pointerStartY;
		applyTransform();
	});
	const stopPanning = (event: PointerEvent): void => {
		if (activePointer !== event.pointerId) {
			return;
		}
		canvas.releasePointerCapture?.(event.pointerId);
		activePointer = null;
		canvas.classList.remove('better-markdown-preview-mermaid-canvas-panning');
	};
	canvas.addEventListener('pointerup', stopPanning);
	canvas.addEventListener('pointercancel', stopPanning);

	return {
		enhance(block) {
			const svg = block.querySelector<SVGSVGElement>('svg');
			if (!svg) {
				return;
			}
			let trigger = block.querySelector<HTMLButtonElement>(
				':scope > [data-bmp-mermaid-open]',
			);
			if (!trigger) {
				const createdTrigger = createMermaidButton(
					document,
					'Open diagram viewer',
					'open',
					'↗',
				);
				createdTrigger.classList.add('better-markdown-preview-mermaid-open');
				createdTrigger.setAttribute('aria-haspopup', 'dialog');
				createdTrigger.addEventListener('click', () =>
					open(block, createdTrigger),
				);
				block.append(createdTrigger);
				trigger = createdTrigger;
			}
			if (sourceBlock === block && dialog.hasAttribute('open')) {
				returnFocus = trigger;
				showSvg(svg, false);
			}
		},
		reconcile() {
			if (sourceBlock && !sourceBlock.isConnected) {
				close(false);
			}
		},
		dispose() {
			close(false);
			dialog.remove();
		},
	};
}

function createMermaidButton(
	document: Document,
	label: string,
	action: string,
	text: string,
): HTMLButtonElement {
	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'better-markdown-preview-mermaid-button';
	button.setAttribute(`data-bmp-mermaid-${action}`, '');
	button.setAttribute('aria-label', label);
	button.title = label;
	button.textContent = text;
	return button;
}

function readSvgSize(svg: SVGSVGElement): { width: number; height: number } {
	const values = svg
		.getAttribute('viewBox')
		?.trim()
		.split(/[\s,]+/)
		.map(Number);
	if (
		values?.length === 4 &&
		Number.isFinite(values[2]) &&
		values[2] > 0 &&
		Number.isFinite(values[3]) &&
		values[3] > 0
	) {
		return { width: values[2], height: values[3] };
	}
	const width = Number.parseFloat(svg.getAttribute('width') ?? '');
	const height = Number.parseFloat(svg.getAttribute('height') ?? '');
	return {
		width: Number.isFinite(width) && width > 0 ? width : 800,
		height: Number.isFinite(height) && height > 0 ? height : 600,
	};
}

function cloneMermaidSvg(svg: SVGSVGElement): SVGSVGElement {
	const clone = svg.cloneNode(true) as SVGSVGElement;
	const prefix = `bmp-mermaid-viewer-${mermaidCloneId++}-`;
	const ids = new Map<string, string>();
	const elements = [clone, ...clone.querySelectorAll('*')];
	for (const element of elements) {
		const original = element.getAttribute('id');
		if (!original) {
			continue;
		}
		const replacement = `${prefix}${original}`;
		ids.set(original, replacement);
		element.setAttribute('id', replacement);
	}
	for (const element of elements) {
		for (const attribute of Array.from(element.attributes)) {
			let value = attribute.value;
			for (const [original, replacement] of ids) {
				value = value.replaceAll(`url(#${original})`, `url(#${replacement})`);
				if (value === `#${original}`) {
					value = `#${replacement}`;
				}
			}
			if (
				attribute.name === 'aria-labelledby' ||
				attribute.name === 'aria-describedby'
			) {
				value = value
					.split(/\s+/)
					.map((id) => ids.get(id) ?? id)
					.join(' ');
			}
			if (value !== attribute.value) {
				element.setAttribute(attribute.name, value);
			}
		}
	}
	const idsBySpecificity = [...ids].sort(
		([left], [right]) => right.length - left.length,
	);
	for (const style of clone.querySelectorAll('style')) {
		let css = style.textContent ?? '';
		for (const [original, replacement] of idsBySpecificity) {
			css = css.replaceAll(`#${original}`, `#${replacement}`);
		}
		style.textContent = css;
	}
	return clone;
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(Math.max(value, minimum), maximum);
}

function buildToc(
	document: Document,
	layout: HTMLElement,
	markdownBody: HTMLElement,
	onNavigate: () => void,
): void {
	clearToc(layout);
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
	nav.append(createTocList(document, headings, false));
	layout.prepend(nav);

	const trigger = document.createElement('button');
	trigger.type = 'button';
	trigger.className = 'better-markdown-preview-toc-trigger';
	trigger.dataset.bmpTocTrigger = '';
	trigger.setAttribute('aria-label', 'Open table of contents');
	trigger.setAttribute('aria-haspopup', 'dialog');
	trigger.setAttribute('aria-expanded', 'false');
	trigger.append(createTocIcon(document));
	layout.append(trigger);

	const dialog = document.createElement('dialog');
	dialog.className = 'better-markdown-preview-toc-dialog';
	dialog.dataset.bmpTocDialog = '';
	dialog.setAttribute('aria-label', 'Table of contents');
	dialog.append(createTocList(document, headings, true));
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
	dialog
		.querySelector<HTMLButtonElement>('[data-bmp-toc-close]')
		?.addEventListener('click', close);
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
	for (const link of layout.querySelectorAll<HTMLAnchorElement>(
		'[data-bmp-heading-id]',
	)) {
		link.addEventListener('click', (event) => {
			if (
				event.button === 0 &&
				!event.altKey &&
				!event.ctrlKey &&
				!event.metaKey &&
				!event.shiftKey
			) {
				onNavigate();
			}
		});
	}
}

function clearToc(layout: HTMLElement): void {
	for (const owned of layout.querySelectorAll(
		':scope > [data-bmp-toc], :scope > [data-bmp-toc-trigger], :scope > [data-bmp-toc-dialog]',
	)) {
		owned.remove();
	}
}

function createTocIcon(document: Document): SVGSVGElement {
	const namespace = 'http://www.w3.org/2000/svg';
	const icon = document.createElementNS(namespace, 'svg');
	icon.classList.add('better-markdown-preview-toc-icon');
	icon.setAttribute('aria-hidden', 'true');
	icon.setAttribute('viewBox', '0 0 16 16');
	icon.setAttribute('fill', 'none');
	icon.setAttribute('stroke', 'currentColor');
	icon.setAttribute('stroke-width', '1.5');
	icon.setAttribute('stroke-linecap', 'round');

	const lines = document.createElementNS(namespace, 'path');
	lines.setAttribute('d', 'M5 4h9M5 8h9M5 12h9');
	icon.append(lines);

	for (const y of ['4', '8', '12']) {
		const dot = document.createElementNS(namespace, 'circle');
		dot.setAttribute('cx', '2');
		dot.setAttribute('cy', y);
		dot.setAttribute('r', '.75');
		dot.setAttribute('fill', 'currentColor');
		dot.setAttribute('stroke', 'none');
		icon.append(dot);
	}

	return icon;
}

function createTocList(
	document: Document,
	headings: HTMLElement[],
	closable: boolean,
): HTMLElement {
	const container = document.createElement('div');
	container.className = 'better-markdown-preview-toc-content';
	const header = document.createElement('div');
	header.className = 'better-markdown-preview-toc-header';
	const title = document.createElement('strong');
	title.className = 'better-markdown-preview-toc-title';
	title.textContent = 'Contents';
	header.append(title);
	if (closable) {
		const closeButton = document.createElement('button');
		closeButton.type = 'button';
		closeButton.className = 'better-markdown-preview-toc-close';
		closeButton.dataset.bmpTocClose = '';
		closeButton.setAttribute('aria-label', 'Close table of contents');
		closeButton.textContent = '×';
		header.append(closeButton);
	}
	container.append(header);
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
