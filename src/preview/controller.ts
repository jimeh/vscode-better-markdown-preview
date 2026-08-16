import {
	defaultConfiguration,
	previewConfiguration,
	type PreviewConfiguration,
} from '../config';
import { enhanceCodeBlocks } from './code-blocks';
import { createMermaidRenderer, type MermaidAdapter } from './mermaid-renderer';
import { buildToc, clearToc, ensureLayout } from './toc';

export { parseLineSet } from './code-blocks';
export type { MermaidAdapter, MermaidTheme } from './mermaid-renderer';

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

const sharedControllers = new WeakMap<Document, SharedController>();

/**
 * Shares one controller per document. The first active caller owns its options
 * until the final shared reference is disposed.
 */
export function enhancePreview(
	document: Document,
	options: PreviewOptions = {},
): PreviewController {
	let shared = sharedControllers.get(document);
	if (!shared) {
		shared = createController(document, options);
		sharedControllers.set(document, shared);
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
				sharedControllers.delete(document);
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
	let settings = previewConfiguration(defaultConfiguration);
	let smoothScrollCleanup: (() => void) | undefined;
	const cleanups: Array<() => void> = [];
	const mermaid = createMermaidRenderer(
		document,
		options.loadMermaid ?? defaultMermaidLoader,
	);

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

	const renderMermaid = async (force = false): Promise<void> => {
		await mermaid.render(force);
		mermaid.syncViewer(settings.mermaidViewer);
	};

	const pruneOrphanedLayouts = (): void => {
		for (const layout of document.querySelectorAll<HTMLElement>(
			'[data-bmp-layout]',
		)) {
			if (!layout.querySelector('.markdown-body')) {
				clearToc(layout);
				layout.remove();
			}
		}
	};

	const clearOwnedUi = (): void => {
		if (scrollFrame) {
			cancelAnimationFrame(scrollFrame);
			scrollFrame = 0;
		}
		smoothScrollCleanup?.();
		mermaid.syncViewer(false);
	};

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

	const enhance = async (): Promise<void> => {
		if (disposed) {
			return;
		}
		pruneOrphanedLayouts();
		const markdownBody = document.querySelector<HTMLElement>('.markdown-body');
		if (!markdownBody) {
			clearOwnedUi();
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
		if (!disposed) {
			void renderMermaid(true);
		}
	});
	themeObserver.observe(document.body, {
		attributes: true,
		attributeFilter: ['class'],
	});

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
			mermaid.dispose();
			for (const layout of document.querySelectorAll<HTMLElement>(
				'[data-bmp-layout]',
			)) {
				clearToc(layout);
			}
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

async function defaultMermaidLoader(): Promise<MermaidAdapter> {
	return import('./mermaid-runtime.js');
}
