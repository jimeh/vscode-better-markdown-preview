export function ensureLayout(
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

export function buildToc(
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

export function clearToc(layout: HTMLElement): void {
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
