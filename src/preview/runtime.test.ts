// @vitest-environment happy-dom

import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
	enhancePreview,
	parseLineSet,
	readPreviewConfiguration,
	type MermaidAdapter,
} from './runtime';

function setDocument(html: string): void {
	document.body.innerHTML = `<div class="markdown-body">${html}</div>`;
}

describe('preview runtime', () => {
	beforeEach(() => {
		document.body.className = '';
		setDocument('');
		vi.restoreAllMocks();
	});

	test('defaults malformed or absent preview configuration to enabled', () => {
		setDocument('<span data-bmp-preview-config="not json"></span>');
		const body = document.querySelector<HTMLElement>('.markdown-body')!;
		expect(readPreviewConfiguration(body)).toEqual({
			tableOfContents: true,
			smoothScrolling: true,
			mermaidViewer: true,
		});
		body.querySelector('[data-bmp-preview-config]')?.remove();
		expect(readPreviewConfiguration(body)).toEqual({
			tableOfContents: true,
			smoothScrolling: true,
			mermaidViewer: true,
		});
	});

	test('uses the final BMP configuration marker after authored lookalikes', () => {
		const spoofed = JSON.stringify({
			tableOfContents: true,
			smoothScrolling: true,
			mermaidViewer: true,
		});
		const authoritative = JSON.stringify({
			tableOfContents: false,
			smoothScrolling: false,
			mermaidViewer: false,
		});
		setDocument(
			`<span data-bmp-preview-config='${spoofed}'></span><p>Authored content</p><span hidden data-bmp-preview-config='${authoritative}'></span>`,
		);

		expect(
			readPreviewConfiguration(
				document.querySelector<HTMLElement>('.markdown-body')!,
			),
		).toEqual({
			tableOfContents: false,
			smoothScrolling: false,
			mermaidViewer: false,
		});
	});

	test('applies marker updates without stale TOC or Mermaid viewer UI', async () => {
		const disabled = JSON.stringify({
			tableOfContents: false,
			smoothScrolling: false,
			mermaidViewer: false,
		});
		setDocument(
			`<span hidden data-bmp-preview-config='${disabled}'></span><h2 id="one">One</h2><h2 id="two">Two</h2><pre data-bmp-mermaid-source data-bmp-mermaid-state="source">graph TD\nA--&gt;B</pre>`,
		);
		const render = vi.fn(async (element: HTMLElement) => {
			element.innerHTML = '<svg viewBox="0 0 100 50"></svg>';
		});
		const controller = enhancePreview(document, {
			loadMermaid: async () => ({ render }),
		});
		await controller.ready;

		expect(render).toHaveBeenCalledOnce();
		expect(document.querySelector('[data-bmp-toc]')).toBeNull();
		expect(document.querySelector('[data-bmp-mermaid-open]')).toBeNull();
		expect(document.querySelector('[data-bmp-mermaid-dialog]')).toBeNull();
		expect(document.documentElement.classList).not.toContain(
			'better-markdown-preview-smooth-scroll',
		);

		const marker = document.querySelector<HTMLElement>(
			'[data-bmp-preview-config]',
		)!;
		marker.dataset.bmpPreviewConfig = JSON.stringify({
			tableOfContents: true,
			smoothScrolling: true,
			mermaidViewer: true,
		});
		await vi.waitFor(() => {
			expect(document.querySelectorAll('[data-bmp-toc]')).toHaveLength(1);
			expect(document.querySelectorAll('[data-bmp-mermaid-open]')).toHaveLength(
				1,
			);
		});
		expect(document.documentElement.classList).not.toContain(
			'better-markdown-preview-smooth-scroll',
		);

		const trigger = document.querySelector<HTMLButtonElement>(
			'[data-bmp-mermaid-open]',
		)!;
		const dialog = document.querySelector<HTMLDialogElement>(
			'[data-bmp-mermaid-dialog]',
		)!;
		dialog.showModal = vi.fn(() => dialog.setAttribute('open', ''));
		dialog.close = vi.fn(() => dialog.removeAttribute('open'));
		trigger.click();
		expect(dialog.hasAttribute('open')).toBe(true);

		marker.dataset.bmpPreviewConfig = disabled;
		await vi.waitFor(() => {
			expect(document.querySelector('[data-bmp-toc]')).toBeNull();
			expect(document.querySelector('[data-bmp-mermaid-open]')).toBeNull();
			expect(document.querySelector('[data-bmp-mermaid-dialog]')).toBeNull();
		});
		expect(dialog.hasAttribute('open')).toBe(false);
		expect(document.documentElement.classList).not.toContain(
			'better-markdown-preview-smooth-scroll',
		);
		controller.dispose();
	});

	test('scopes smooth scrolling to owned TOC activation and cleans it up', async () => {
		setDocument('<h2 id="one">One</h2><h2 id="two">Two</h2>');
		const originalMatchMedia = window.matchMedia;
		const controller = enhancePreview(document);
		await controller.ready;
		const root = document.documentElement;
		const link = (): HTMLAnchorElement =>
			document.querySelector<HTMLAnchorElement>('[data-bmp-toc] a')!;
		let nextFrame: FrameRequestCallback | undefined;
		let fallback: (() => void) | undefined;
		const requestFrame = vi
			.spyOn(window, 'requestAnimationFrame')
			.mockImplementation((callback) => {
				nextFrame = callback;
				return 17;
			});
		const cancelFrame = vi.spyOn(window, 'cancelAnimationFrame');
		vi.spyOn(window, 'setTimeout').mockImplementation((handler) => {
			if (typeof handler === 'function') {
				fallback = handler;
			}
			return 23 as unknown as NodeJS.Timeout;
		});

		expect(root.classList).not.toContain(
			'better-markdown-preview-smooth-scroll',
		);
		Object.defineProperty(window, 'matchMedia', {
			configurable: true,
			value: undefined,
		});
		link().click();
		expect(root.classList).toContain('better-markdown-preview-smooth-scroll');
		nextFrame?.(0);
		expect(root.classList).not.toContain(
			'better-markdown-preview-smooth-scroll',
		);
		expect(cancelFrame).not.toHaveBeenCalled();

		Object.defineProperty(window, 'matchMedia', {
			configurable: true,
			value: () => ({ matches: true }) as MediaQueryList,
		});
		link().click();
		expect(root.classList).not.toContain(
			'better-markdown-preview-smooth-scroll',
		);

		Object.defineProperty(window, 'matchMedia', {
			configurable: true,
			value: undefined,
		});
		link().click();
		expect(root.classList).toContain('better-markdown-preview-smooth-scroll');
		fallback?.();
		expect(root.classList).not.toContain(
			'better-markdown-preview-smooth-scroll',
		);
		expect(cancelFrame).toHaveBeenCalledWith(17);

		link().click();
		expect(root.classList).toContain('better-markdown-preview-smooth-scroll');
		controller.dispose();
		expect(root.classList).not.toContain(
			'better-markdown-preview-smooth-scroll',
		);
		expect(cancelFrame).toHaveBeenCalledWith(17);
		expect(requestFrame).toHaveBeenCalledTimes(3);
		Object.defineProperty(window, 'matchMedia', {
			configurable: true,
			value: originalMatchMedia,
		});
	});

	test('does not smooth owned TOC navigation when the setting is disabled', async () => {
		const configuration = JSON.stringify({
			tableOfContents: true,
			smoothScrolling: false,
			mermaidViewer: true,
		});
		setDocument(
			`<h2 id="one">One</h2><h2 id="two">Two</h2><span hidden data-bmp-preview-config='${configuration}'></span>`,
		);
		const controller = enhancePreview(document);
		await controller.ready;

		document.querySelector<HTMLAnchorElement>('[data-bmp-toc] a')?.click();
		expect(document.documentElement.classList).not.toContain(
			'better-markdown-preview-smooth-scroll',
		);
		controller.dispose();
	});

	test('builds an idempotent TOC, omits the leading H1, and hides for fewer than two entries', async () => {
		setDocument(
			'<h1 id="title">Title</h1><h2 id="one">One</h2><h3 id="two">Two</h3>',
		);
		const first = enhancePreview(document);
		const second = enhancePreview(document);
		await first.ready;
		await second.ready;
		expect(document.querySelectorAll('[data-bmp-layout]')).toHaveLength(1);
		expect(document.querySelectorAll('[data-bmp-toc]')).toHaveLength(1);
		expect(document.querySelector('[data-bmp-toc]')?.textContent).not.toContain(
			'Title',
		);
		expect(document.querySelectorAll('[data-bmp-toc] a')).toHaveLength(2);
		first.dispose();
		second.dispose();

		setDocument('<h1 id="title">Title</h1><h2 id="one">One</h2>');
		const sparse = enhancePreview(document);
		await sparse.ready;
		expect(document.querySelector('[data-bmp-toc]')).toBeNull();
		sparse.dispose();
	});

	test('presents and closes the narrow TOC dialog with focus restoration', async () => {
		setDocument(
			'<h1 id="title">Title</h1><h2 id="one">One</h2><h2 id="two">Two</h2>',
		);
		const controller = enhancePreview(document);
		await controller.ready;
		const trigger = document.querySelector<HTMLButtonElement>(
			'[data-bmp-toc-trigger]',
		)!;
		expect(trigger.getAttribute('aria-label')).toBe('Open table of contents');
		expect(trigger.textContent).toBe('');
		const triggerIcon = trigger.querySelector('svg');
		expect(triggerIcon?.getAttribute('viewBox')).toBe('0 0 16 16');
		expect(triggerIcon?.getAttribute('aria-hidden')).toBe('true');
		expect(triggerIcon?.querySelector('path')?.getAttribute('d')).toBe(
			'M5 4h9M5 8h9M5 12h9',
		);
		expect(triggerIcon?.querySelectorAll('circle')).toHaveLength(3);
		const dialog = document.querySelector<HTMLDialogElement>(
			'[data-bmp-toc-dialog]',
		)!;
		const closeButton = dialog.querySelector<HTMLButtonElement>(
			'[data-bmp-toc-close]',
		)!;
		expect(closeButton.getAttribute('aria-label')).toBe(
			'Close table of contents',
		);
		const showModal = vi.fn(() => dialog.setAttribute('open', ''));
		const close = vi.fn(() => dialog.removeAttribute('open'));
		dialog.showModal = showModal;
		dialog.close = close;
		expect(trigger.getAttribute('aria-expanded')).toBe('false');
		trigger.focus();
		trigger.click();
		expect(showModal).toHaveBeenCalledOnce();
		expect(dialog.hasAttribute('open')).toBe(true);
		expect(document.activeElement?.tagName).toBe('A');
		dialog.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
		);
		expect(dialog.hasAttribute('open')).toBe(false);
		expect(document.activeElement).toBe(trigger);
		trigger.click();
		closeButton.click();
		expect(close).toHaveBeenCalledTimes(2);
		expect(dialog.hasAttribute('open')).toBe(false);
		expect(document.activeElement).toBe(trigger);
		trigger.click();
		vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({
			left: 10,
			right: 100,
			top: 10,
			bottom: 100,
		} as DOMRect);
		dialog.dispatchEvent(
			new MouseEvent('click', { bubbles: true, clientX: 5, clientY: 5 }),
		);
		expect(close).toHaveBeenCalledTimes(3);
		expect(dialog.hasAttribute('open')).toBe(false);
		expect(document.activeElement).toBe(trigger);
		controller.dispose();
	});

	test('tracks the active heading in both TOC presentations', async () => {
		setDocument('<h2 id="one">One</h2><h2 id="two">Two</h2>');
		const headings = document.querySelectorAll<HTMLElement>('h2');
		vi.spyOn(headings[0], 'getBoundingClientRect').mockReturnValue({
			top: -10,
			bottom: 10,
		} as DOMRect);
		vi.spyOn(headings[1], 'getBoundingClientRect').mockReturnValue({
			top: 300,
			bottom: 320,
		} as DOMRect);
		const controller = enhancePreview(document);
		await controller.ready;
		window.dispatchEvent(new Event('scroll'));
		await new Promise((resolve) => requestAnimationFrame(resolve));
		expect(
			document
				.querySelector('[data-bmp-heading-id="one"]')
				?.getAttribute('aria-current'),
		).toBe('location');
		expect(
			document.querySelector('[data-bmp-toc-dialog] [aria-current="location"]')
				?.textContent,
		).toBe('One');
		controller.dispose();
	});

	test('selects the first visible TOC link above the first section after a leading title', async () => {
		setDocument(
			'<h1 id="title">Title</h1><h2 id="one">One</h2><h2 id="two">Two</h2>',
		);
		const headings = document.querySelectorAll<HTMLElement>('h1, h2');
		vi.spyOn(headings[0], 'getBoundingClientRect').mockReturnValue({
			top: -10,
		} as DOMRect);
		vi.spyOn(headings[1], 'getBoundingClientRect').mockReturnValue({
			top: 300,
		} as DOMRect);
		vi.spyOn(headings[2], 'getBoundingClientRect').mockReturnValue({
			top: 600,
		} as DOMRect);
		const controller = enhancePreview(document);
		await controller.ready;
		const current = document
			.querySelector('[data-bmp-heading-id="one"]')
			?.getAttribute('aria-current');
		controller.dispose();
		expect(current).toBe('location');
	});

	test('selects the final TOC link at the document bottom', async () => {
		setDocument('<h2 id="one">One</h2><h2 id="two">Two</h2>');
		for (const heading of document.querySelectorAll<HTMLElement>('h2')) {
			vi.spyOn(heading, 'getBoundingClientRect').mockReturnValue({
				top: 300,
			} as DOMRect);
		}
		vi.spyOn(window, 'scrollY', 'get').mockReturnValue(900);
		vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(100);
		vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(
			1000,
		);
		const controller = enhancePreview(document);
		await controller.ready;
		const current = document
			.querySelector('[data-bmp-heading-id="two"]')
			?.getAttribute('aria-current');
		controller.dispose();
		expect(current).toBe('location');
	});

	test('re-enhances replaced body content without duplicate controls', async () => {
		setDocument('<h2 id="one">One</h2><h2 id="two">Two</h2>');
		const controller = enhancePreview(document);
		await controller.ready;
		const body = document.querySelector('.markdown-body')!;
		body.innerHTML = '<h2 id="three">Three</h2><h2 id="four">Four</h2>';
		const replacement = body.querySelectorAll<HTMLElement>('h2');
		vi.spyOn(replacement[0], 'getBoundingClientRect').mockReturnValue({
			top: -10,
		} as DOMRect);
		vi.spyOn(replacement[1], 'getBoundingClientRect').mockReturnValue({
			top: 300,
		} as DOMRect);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(document.querySelectorAll('[data-bmp-toc]')).toHaveLength(1);
		expect(document.querySelector('[data-bmp-toc]')?.textContent).toContain(
			'Four',
		);
		expect(
			document
				.querySelector('[data-bmp-heading-id="three"]')
				?.getAttribute('aria-current'),
		).toBe('location');
		controller.dispose();
	});

	test('retargets when VS Code replaces the markdown body element', async () => {
		setDocument('<h2 id="one">One</h2><h2 id="two">Two</h2>');
		const controller = enhancePreview(document);
		await controller.ready;
		const oldBody = document.querySelector<HTMLElement>('.markdown-body')!;
		const newBody = document.createElement('div');
		newBody.className = 'markdown-body';
		newBody.innerHTML = '<h2 id="three">Three</h2><h2 id="four">Four</h2>';
		oldBody.replaceWith(newBody);
		await vi.waitFor(() =>
			expect(document.querySelector('[data-bmp-toc]')?.textContent).toContain(
				'Four',
			),
		);
		expect(document.querySelectorAll('[data-bmp-toc]')).toHaveLength(1);
		expect(newBody.closest('[data-bmp-layout]')).not.toBeNull();
		controller.dispose();
	});

	test('loads Mermaid conditionally, keeps fallback on failure, and rerenders on theme change', async () => {
		setDocument('<p>No diagrams</p>');
		const loader = vi.fn<() => Promise<MermaidAdapter>>();
		const none = enhancePreview(document, { loadMermaid: loader });
		await none.ready;
		expect(loader).not.toHaveBeenCalled();
		none.dispose();

		setDocument('<pre data-bmp-mermaid-source>graph TD\nA--&gt;B</pre>');
		const render = vi.fn(async (element: HTMLElement) => {
			element.innerHTML = '<svg aria-label="diagram"></svg>';
		});
		loader.mockResolvedValue({ render });
		const success = enhancePreview(document, { loadMermaid: loader });
		await success.ready;
		expect(loader).toHaveBeenCalledOnce();
		expect(render).toHaveBeenCalledOnce();
		document.body.classList.add('vscode-dark');
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(render).toHaveBeenCalledTimes(2);
		success.dispose();

		setDocument('<pre data-bmp-mermaid-source>broken source</pre>');
		const failing = enhancePreview(document, {
			loadMermaid: async () => ({
				render: async () => Promise.reject(new Error('invalid')),
			}),
		});
		await failing.ready;
		const fallback = document.querySelector<HTMLElement>(
			'[data-bmp-mermaid-source]',
		)!;
		expect(fallback.textContent).toBe('broken source');
		expect(fallback.dataset.bmpMermaidState).toBe('failed');
		failing.dispose();
	});

	test('preserves source when the Mermaid module loader rejects', async () => {
		setDocument('<pre data-bmp-mermaid-source>graph TD\nA--&gt;B</pre>');
		const controller = enhancePreview(document, {
			loadMermaid: async () => Promise.reject(new Error('chunk unavailable')),
		});

		await controller.ready;
		const block = document.querySelector<HTMLElement>(
			'[data-bmp-mermaid-source]',
		)!;
		expect(block.textContent).toBe('graph TD\nA-->B');
		expect(block.dataset.bmpMermaidState).toBe('failed');
		controller.dispose();
	});

	test('uses default light theme values when VS Code variables are absent', async () => {
		setDocument('<pre data-bmp-mermaid-source>graph TD\nA--&gt;B</pre>');
		const render = vi.fn<MermaidAdapter['render']>(async (element) => {
			element.innerHTML = '<svg viewBox="0 0 100 50"></svg>';
		});
		const controller = enhancePreview(document, {
			loadMermaid: async () => ({ render }),
		});

		await controller.ready;
		expect(render).toHaveBeenCalledWith(
			expect.any(HTMLElement),
			'graph TD\nA-->B',
			{
				dark: false,
				background: '#ffffff',
				foreground: '#1f2328',
				border: '#8c8c8c',
				accent: '#0969da',
			},
		);
		controller.dispose();
	});

	test('serializes Mermaid passes across theme changes', async () => {
		setDocument('<pre data-bmp-mermaid-source>graph TD\nA--&gt;B</pre>');
		let finishFirst: (() => void) | undefined;
		const firstRender = new Promise<void>((resolve) => {
			finishFirst = resolve;
		});
		const render = vi
			.fn<MermaidAdapter['render']>()
			.mockImplementationOnce(() => firstRender)
			.mockResolvedValue(undefined);
		const controller = enhancePreview(document, {
			loadMermaid: async () => ({ render }),
		});
		await vi.waitFor(() => expect(render).toHaveBeenCalledOnce());
		document.body.classList.add('vscode-dark');
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(render).toHaveBeenCalledOnce();
		finishFirst?.();
		await controller.ready;
		await vi.waitFor(() => expect(render).toHaveBeenCalledTimes(2));
		controller.dispose();
	});

	test('recaches Mermaid source when VS Code reuses a block for an edit', async () => {
		setDocument(
			'<pre data-bmp-mermaid-source data-bmp-mermaid-state="source">graph TD\nA--&gt;B</pre>',
		);
		const sources: string[] = [];
		const render = vi.fn(async (element: HTMLElement, source: string) => {
			sources.push(source);
			element.innerHTML = '<svg aria-label="diagram"></svg>';
		});
		const controller = enhancePreview(document, {
			loadMermaid: async () => ({ render }),
		});
		await controller.ready;
		const block = document.querySelector<HTMLElement>(
			'[data-bmp-mermaid-source]',
		)!;
		block.dataset.bmpMermaidState = 'source';
		block.textContent = 'graph TD\nA-->C';
		await vi.waitFor(() => expect(render).toHaveBeenCalledTimes(2));
		document.body.classList.add('vscode-dark');
		await vi.waitFor(() => expect(render).toHaveBeenCalledTimes(3));
		expect(sources).toEqual([
			'graph TD\nA-->B',
			'graph TD\nA-->C',
			'graph TD\nA-->C',
		]);
		controller.dispose();
	});

	test('opens a near-viewport Mermaid viewer with zoom, pan, fit, and focus restoration', async () => {
		setDocument('<pre data-bmp-mermaid-source>graph TD\nA--&gt;B</pre>');
		const controller = enhancePreview(document, {
			loadMermaid: async () => ({
				render: async (element: HTMLElement) => {
					element.innerHTML =
						'<svg id="diagram-root" viewBox="0 0 400 200" aria-labelledby="diagram-title"><title id="diagram-title">Diagram</title><defs><marker id="arrow"></marker></defs><path class="node" marker-end="url(#arrow)"></path><text>Rendered</text></svg>';
					const svg = element.querySelector('svg')!;
					const style = element.ownerDocument.createElementNS(
						'http://www.w3.org/2000/svg',
						'style',
					);
					style.textContent =
						'#diagram-root .node { fill: red; } #arrow path { fill: blue; }';
					svg.prepend(style);
				},
			}),
		});
		await controller.ready;

		const trigger = document.querySelector<HTMLButtonElement>(
			'[data-bmp-mermaid-open]',
		)!;
		const dialog = document.querySelector<HTMLDialogElement>(
			'[data-bmp-mermaid-dialog]',
		)!;
		const canvas = dialog.querySelector<HTMLElement>(
			'[data-bmp-mermaid-canvas]',
		)!;
		vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
			left: 0,
			top: 0,
			width: 800,
			height: 600,
			right: 800,
			bottom: 600,
		} as DOMRect);
		const showModal = vi.fn(() => dialog.setAttribute('open', ''));
		const close = vi.fn(() => dialog.removeAttribute('open'));
		dialog.showModal = showModal;
		dialog.close = close;

		expect(trigger.getAttribute('aria-label')).toBe('Open diagram viewer');
		trigger.focus();
		trigger.click();
		expect(showModal).toHaveBeenCalledOnce();
		expect(document.activeElement).toBe(canvas);
		expect(
			dialog.querySelectorAll('[data-bmp-mermaid-canvas] svg'),
		).toHaveLength(1);
		const clonedSvg = dialog.querySelector('[data-bmp-mermaid-canvas] svg');
		const clonedTitle = dialog.querySelector('[data-bmp-mermaid-canvas] title');
		expect(clonedSvg?.id).not.toBe('diagram-root');
		expect(clonedSvg?.getAttribute('aria-labelledby')).toBe(clonedTitle?.id);
		const clonedMarker = dialog.querySelector(
			'[data-bmp-mermaid-canvas] marker',
		);
		expect(clonedMarker?.id).not.toBe('arrow');
		const clonedStyle = dialog.querySelector(
			'[data-bmp-mermaid-canvas] style',
		)?.textContent;
		expect(clonedStyle).toContain(`#${clonedSvg?.id} .node`);
		expect(clonedStyle).toContain(`#${clonedMarker?.id} path`);
		expect(clonedStyle).not.toContain('#diagram-root');
		expect(
			dialog
				.querySelector('[data-bmp-mermaid-canvas] path')
				?.getAttribute('marker-end'),
		).toBe(`url(#${clonedMarker?.id})`);
		expect(
			dialog.querySelector('[data-bmp-mermaid-zoom-value]')?.textContent,
		).toBe('100%');

		dialog
			.querySelector<HTMLButtonElement>('[data-bmp-mermaid-zoom-in]')
			?.click();
		expect(
			dialog.querySelector('[data-bmp-mermaid-zoom-value]')?.textContent,
		).toBe('125%');
		canvas.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
		);
		expect(
			dialog.querySelector<HTMLElement>('[data-bmp-mermaid-surface]')?.style
				.transform,
		).toContain('translate(-40px, 0px)');
		canvas.dispatchEvent(
			new WheelEvent('wheel', {
				bubbles: true,
				cancelable: true,
				clientX: 400,
				clientY: 300,
				deltaY: -100,
			}),
		);
		expect(
			dialog.querySelector('[data-bmp-mermaid-zoom-value]')?.textContent,
		).toBe('150%');
		dialog.querySelector<HTMLButtonElement>('[data-bmp-mermaid-fit]')?.click();
		expect(
			dialog.querySelector<HTMLElement>('[data-bmp-mermaid-surface]')?.style
				.transform,
		).toContain('translate(0px, 0px)');
		canvas.dispatchEvent(
			new PointerEvent('pointerdown', {
				bubbles: true,
				button: 0,
				clientX: 100,
				clientY: 100,
				pointerId: 1,
			}),
		);
		canvas.dispatchEvent(
			new PointerEvent('pointermove', {
				bubbles: true,
				clientX: 125,
				clientY: 135,
				pointerId: 1,
			}),
		);
		canvas.dispatchEvent(
			new PointerEvent('pointerup', {
				bubbles: true,
				pointerId: 1,
			}),
		);
		expect(
			dialog.querySelector<HTMLElement>('[data-bmp-mermaid-surface]')?.style
				.transform,
		).toContain('translate(25px, 35px)');

		dialog.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
		);
		expect(close).toHaveBeenCalledOnce();
		expect(document.activeElement).toBe(trigger);
		controller.dispose();
	});

	test('keeps Mermaid viewer controls idempotent and refreshes an open diagram after rerender', async () => {
		setDocument('<pre data-bmp-mermaid-source>graph TD\nA--&gt;B</pre>');
		let renderCount = 0;
		const controller = enhancePreview(document, {
			loadMermaid: async () => ({
				render: async (element: HTMLElement) => {
					renderCount += 1;
					element.innerHTML = `<svg viewBox="0 0 400 200" data-render="${renderCount}"></svg>`;
				},
			}),
		});
		await controller.ready;
		const trigger = document.querySelector<HTMLButtonElement>(
			'[data-bmp-mermaid-open]',
		)!;
		const dialog = document.querySelector<HTMLDialogElement>(
			'[data-bmp-mermaid-dialog]',
		)!;
		dialog.showModal = vi.fn(() => dialog.setAttribute('open', ''));
		const close = vi.fn(() => dialog.removeAttribute('open'));
		dialog.close = close;
		trigger.click();

		document.body.classList.add('vscode-dark');
		await vi.waitFor(() => expect(renderCount).toBe(2));
		expect(document.querySelectorAll('[data-bmp-mermaid-open]')).toHaveLength(
			1,
		);
		expect(document.querySelectorAll('[data-bmp-mermaid-dialog]')).toHaveLength(
			1,
		);
		expect(
			dialog
				.querySelector('[data-bmp-mermaid-canvas] svg')
				?.getAttribute('data-render'),
		).toBe('2');

		const oldBody = document.querySelector('.markdown-body')!;
		const replacement = document.createElement('div');
		replacement.className = 'markdown-body';
		replacement.innerHTML = '<p>Different document</p>';
		oldBody.replaceWith(replacement);
		await vi.waitFor(() => expect(close).toHaveBeenCalledOnce());
		expect(dialog.hasAttribute('open')).toBe(false);
		controller.dispose();
		expect(document.querySelector('[data-bmp-mermaid-dialog]')).toBeNull();
	});

	test('falls back from malformed SVG sizing and unavailable dialog methods', async () => {
		setDocument('<pre data-bmp-mermaid-source>graph TD\nA--&gt;B</pre>');
		const controller = enhancePreview(document, {
			loadMermaid: async () => ({
				render: async (element) => {
					element.innerHTML =
						'<svg viewBox="invalid" width="320" height="nope"></svg>';
				},
			}),
		});
		await controller.ready;
		const dialog = document.querySelector<HTMLDialogElement>(
			'[data-bmp-mermaid-dialog]',
		)!;
		dialog.showModal = vi.fn(() => {
			throw new Error('unsupported');
		});
		document
			.querySelector<HTMLButtonElement>('[data-bmp-mermaid-open]')
			?.click();
		const svg = dialog.querySelector<SVGSVGElement>('svg')!;
		expect(dialog.hasAttribute('open')).toBe(true);
		expect(svg.style.width).toBe('320px');
		expect(svg.style.height).toBe('600px');

		dialog.close = undefined as unknown as typeof dialog.close;
		dialog.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
		);
		expect(dialog.hasAttribute('open')).toBe(false);
		controller.dispose();
	});

	test('adds code line presentation without changing authored copy text or source maps', async () => {
		setDocument(
			'<figure class="better-markdown-preview-code" data-bmp-lines="2" data-bmp-word="needle" data-bmp-line-numbers="true"><pre data-line="7"><code><span>first</span>\n<span>needle</span></code></pre></figure>',
		);
		const controller = enhancePreview(document);
		await controller.ready;
		const pre = document.querySelector('pre')!;
		expect(pre.dataset.line).toBe('7');
		expect(pre.textContent).toBe('first\nneedle');
		expect(document.querySelectorAll('[data-bmp-code-line]')).toHaveLength(2);
		expect(
			document.querySelector('[data-bmp-code-line="2"]')?.classList,
		).toContain('better-markdown-preview-code-line-highlighted');
		controller.dispose();
	});

	test('caps authored line ranges to the visual line count', () => {
		expect([...parseLineSet('1-10000', 2)]).toEqual([1, 2]);
		expect([...parseLineSet('9999-10000', 2)]).toEqual([]);
		expect([...parseLineSet('3-1,one,2-two,0-2,2-3', 3)]).toEqual([2, 3]);
	});
});
