import { createMermaidViewer, type MermaidViewer } from './mermaid-viewer';
import type { MermaidColorShifts } from '../config';

export interface MermaidTheme {
	dark: boolean;
	background: string;
	foreground: string;
	accent: string;
	contrastBorder?: string;
	colorShifts: MermaidColorShifts;
}

export interface MermaidAdapter {
	render(
		element: HTMLElement,
		source: string,
		theme: MermaidTheme,
	): Promise<void>;
}

export interface MermaidRenderer {
	render(colorShifts: MermaidColorShifts, force?: boolean): Promise<void>;
	syncViewer(enabled: boolean): void;
	dispose(): void;
}

interface MermaidBlockRevision {
	source: string;
	revision: number;
}

const authoredSources = new WeakMap<HTMLElement, string>();

export function createMermaidRenderer(
	document: Document,
	loadMermaid: () => Promise<MermaidAdapter>,
): MermaidRenderer {
	let disposed = false;
	let mermaidAdapter: MermaidAdapter | undefined;
	let mermaidViewer: MermaidViewer | undefined;
	let queue = Promise.resolve();
	const revisions = new WeakMap<HTMLElement, MermaidBlockRevision>();

	const readRevision = (block: HTMLElement): MermaidBlockRevision => {
		const previous = revisions.get(block);
		const sourceState = block.dataset.bmpMermaidState === 'source';
		let source = authoredSources.get(block);
		if (sourceState || source === undefined) {
			source = block.textContent ?? '';
			authoredSources.set(block, source);
		}
		if (!previous || previous.source !== source) {
			const current = {
				source,
				revision: (previous?.revision ?? 0) + 1,
			};
			revisions.set(block, current);
			return current;
		}
		return previous;
	};

	const revisionIsCurrent = (
		block: HTMLElement,
		revision: MermaidBlockRevision,
	): boolean => {
		if (block.dataset.bmpMermaidState === 'source') {
			readRevision(block);
		}
		return !disposed && block.isConnected && revisions.get(block) === revision;
	};

	const renderPass = async (
		colorShifts: MermaidColorShifts,
		force: boolean,
	): Promise<void> => {
		if (disposed) {
			return;
		}
		const pending = Array.from(
			document.querySelectorAll<HTMLElement>('[data-bmp-mermaid-source]'),
		)
			.filter(
				(block) =>
					force ||
					(block.dataset.bmpMermaidState !== 'rendered' &&
						block.dataset.bmpMermaidState !== 'failed'),
			)
			.map((block) => ({ block, revision: readRevision(block) }));
		if (pending.length === 0) {
			return;
		}
		try {
			mermaidAdapter ??= await loadMermaid();
		} catch {
			for (const { block, revision } of pending) {
				if (revisionIsCurrent(block, revision)) {
					block.dataset.bmpMermaidState = 'failed';
				}
			}
			return;
		}
		if (disposed) {
			return;
		}
		const theme = readTheme(document, colorShifts);
		for (const { block, revision } of pending) {
			if (!revisionIsCurrent(block, revision)) {
				continue;
			}
			block.dataset.bmpMermaidState = 'rendering';
			const staging = document.createElement(block.tagName.toLowerCase());
			try {
				await mermaidAdapter.render(staging, revision.source, theme);
				if (!revisionIsCurrent(block, revision)) {
					continue;
				}
				block.replaceChildren(...Array.from(staging.childNodes));
				block.dataset.bmpMermaidState = 'rendered';
			} catch {
				if (revisionIsCurrent(block, revision)) {
					block.textContent = revision.source;
					block.dataset.bmpMermaidState = 'failed';
				}
			}
		}
	};

	const renderer: MermaidRenderer = {
		render(colorShifts, force = false) {
			const queued = queue.then(async () => {
				if (!disposed) {
					await renderPass(colorShifts, force);
				}
			});
			queue = queued.catch(() => undefined);
			return queued;
		},
		syncViewer(enabled) {
			if (disposed) {
				return;
			}
			if (!enabled) {
				mermaidViewer?.dispose();
				mermaidViewer = undefined;
				removeViewerTriggers(document);
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
		},
		dispose() {
			disposed = true;
			mermaidViewer?.dispose();
			mermaidViewer = undefined;
			removeViewerTriggers(document);
		},
	};
	return renderer;
}

function removeViewerTriggers(document: Document): void {
	for (const trigger of document.querySelectorAll('[data-bmp-mermaid-open]')) {
		trigger.remove();
	}
}

function readTheme(
	document: Document,
	colorShifts: MermaidColorShifts,
): MermaidTheme {
	const styles = getComputedStyle(document.body);
	const read = (name: string, fallback: string): string =>
		styles.getPropertyValue(name).trim() || fallback;
	const contrastBorder = styles
		.getPropertyValue('--vscode-contrastBorder')
		.trim();
	return {
		dark:
			document.body.classList.contains('vscode-dark') ||
			(document.body.classList.contains('vscode-high-contrast') &&
				!document.body.classList.contains('vscode-high-contrast-light')),
		background: read('--vscode-editor-background', '#ffffff'),
		foreground: read('--vscode-editor-foreground', '#1f2328'),
		accent: read('--vscode-textLink-foreground', '#0969da'),
		contrastBorder: contrastBorder || undefined,
		colorShifts,
	};
}
