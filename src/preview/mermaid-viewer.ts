export interface MermaidViewer {
	enhance(block: HTMLElement): void;
	reconcile(): void;
	dispose(): void;
}

let mermaidCloneId = 0;

export function createMermaidViewer(document: Document): MermaidViewer {
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
