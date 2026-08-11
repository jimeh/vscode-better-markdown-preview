// @vitest-environment happy-dom

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { enhancePreview, parseLineSet, type MermaidAdapter } from './runtime';

function setDocument(html: string): void {
	document.body.innerHTML = `<div class="markdown-body">${html}</div>`;
}

describe('preview runtime', () => {
	beforeEach(() => {
		setDocument('');
		vi.restoreAllMocks();
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
		const dialog = document.querySelector<HTMLDialogElement>(
			'[data-bmp-toc-dialog]',
		)!;
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
		vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({
			left: 10,
			right: 100,
			top: 10,
			bottom: 100,
		} as DOMRect);
		dialog.dispatchEvent(
			new MouseEvent('click', { bubbles: true, clientX: 5, clientY: 5 }),
		);
		expect(close).toHaveBeenCalledTimes(2);
		expect(dialog.hasAttribute('open')).toBe(false);
		expect(document.activeElement).toBe(trigger);
		controller.dispose();
	});

	test('tracks the active heading and exposes the floating control after inline TOC scrolls away', async () => {
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
		const toc = document.querySelector<HTMLElement>('[data-bmp-toc]')!;
		vi.spyOn(toc, 'getBoundingClientRect').mockReturnValue({
			top: -300,
			bottom: -10,
		} as DOMRect);
		window.dispatchEvent(new Event('scroll'));
		await new Promise((resolve) => requestAnimationFrame(resolve));
		expect(
			document
				.querySelector('[data-bmp-heading-id="one"]')
				?.getAttribute('aria-current'),
		).toBe('location');
		expect(
			document
				.querySelector('[data-bmp-toc-trigger]')
				?.classList.contains('better-markdown-preview-toc-trigger-visible'),
		).toBe(true);
		controller.dispose();
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

	test('computes floating TOC visibility during initial enhancement', async () => {
		setDocument('<h2 id="one">One</h2><h2 id="two">Two</h2>');
		const geometry = vi
			.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
			.mockImplementation(function (this: HTMLElement) {
				return { bottom: this.dataset.bmpToc === '' ? -1 : 100 } as DOMRect;
			});
		const controller = enhancePreview(document);
		await controller.ready;
		expect(
			document
				.querySelector('[data-bmp-toc-trigger]')
				?.classList.contains('better-markdown-preview-toc-trigger-visible'),
		).toBe(true);
		geometry.mockRestore();
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
	});
});
