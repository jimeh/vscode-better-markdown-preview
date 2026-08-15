import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const css = await readFile(
	new URL('../media/preview.css', import.meta.url),
	'utf8',
);

test('preview presentation follows native Markdown and alert variables', () => {
	assert.match(css, /font-size: var\(--markdown-font-size, 14px\)/);
	assert.match(css, /line-height: var\(--markdown-line-height, 22px\)/);
	assert.doesNotMatch(css, /--vscode-markdown-preview-/);
	for (const alert of ['note', 'tip', 'important', 'warning', 'caution']) {
		assert.ok(css.includes(`--vscode-markdownAlert-${alert}\\.foreground`));
		assert.match(
			css,
			new RegExp(
				`--vscode-markdownAlert-${alert}-foreground[\\s\\S]*?--vscode-editor-foreground`,
			),
		);
	}
	assert.match(
		css,
		/\.better-markdown-preview-alert \{[\s\S]*?border: 0;[\s\S]*?border-left: 3px solid var\(--bmp-alert-color\);[\s\S]*?background: color-mix\([\s\S]*?var\(--vscode-editor-background\)[\s\S]*?var\(--bmp-alert-color\)[\s\S]*?color: var\(--vscode-editor-foreground\);/,
	);
	assert.doesNotMatch(css, /border: 1px solid currentcolor/);
});

test('lists and task lists share a compact aligned layout', () => {
	assert.match(
		css,
		/\.markdown-body :where\(ul, ol\) \{\s*padding-inline-start: 1\.5em;/,
	);
	assert.match(css, /\.markdown-body \.task-list-item::marker/);
	assert.doesNotMatch(
		css,
		/\.markdown-body \.contains-task-list[^}]*list-style:\s*none/,
	);
	assert.match(
		css,
		/\.markdown-body \.task-list-item-checkbox \{[\s\S]*?width: 1em;[\s\S]*?height: 1em;[\s\S]*?margin-inline: -1\.45em 0\.2em;/,
	);
});

test('rich code lines preserve the owned layout contract', () => {
	assert.match(
		css,
		/\.better-markdown-preview-code-line \{[\s\S]*?display: inline-block;[\s\S]*?min-width: 100%/,
	);
	assert.match(css, /@media \(max-width: 64rem\)/);
});

test('explicit and implicit columns retain distinct Airplan flex semantics', () => {
	assert.match(css, /\.better-markdown-preview-column \{[\s\S]*?flex: 1 1 0;/);
	assert.match(
		css,
		/\.better-markdown-preview-column\[data-bmp-column-width\] \{[\s\S]*?flex: 0 1 var\(--bmp-column-width\);/,
	);
});

test('wide tables use the Airplan overflow contract', () => {
	assert.match(
		css,
		/\.markdown-body table \{[\s\S]*?display: block;[\s\S]*?width: max-content;[\s\S]*?max-width: 100%;[\s\S]*?overflow-x: auto;/,
	);
});

test('Mermaid viewer owns a near-viewport, theme-aware interaction surface', () => {
	assert.match(
		css,
		/\.better-markdown-preview-mermaid-dialog \{[\s\S]*?width: calc\(100vw - 2rem\);[\s\S]*?height: calc\(100vh - 2rem\);/,
	);
	assert.match(
		css,
		/\.better-markdown-preview-mermaid-canvas \{[\s\S]*?touch-action: none;[\s\S]*?cursor: grab;/,
	);
	assert.match(
		css,
		/@media print \{[\s\S]*?\.better-markdown-preview-mermaid-dialog[\s\S]*?display: none !important;/,
	);
	assert.match(
		css,
		/\.better-markdown-preview-mermaid-dialog::backdrop \{\s*background: rgb\(0 0 0 \/ 18%\);\s*\}/,
	);
	assert.match(
		css,
		/\.better-markdown-preview-toc-dialog::backdrop \{\s*background: rgb\(0 0 0 \/ 18%\);/,
	);
});

test('TOC links replace the native focus rectangle with a text cue', () => {
	assert.match(
		css,
		/\.better-markdown-preview-toc a:focus,[\s\S]*?\.better-markdown-preview-toc-dialog a:focus \{\s*outline: none;/,
	);
	assert.match(
		css,
		/\.better-markdown-preview-toc a:focus-visible,[\s\S]*?\.better-markdown-preview-toc-dialog a:focus-visible \{\s*text-decoration: underline;/,
	);
});

test('smooth navigation respects both its runtime class and reduced motion', () => {
	assert.match(
		css,
		/html\.better-markdown-preview-smooth-scroll \{\s*scroll-behavior: smooth;\s*\}/,
	);
	assert.match(
		css,
		/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?html\.better-markdown-preview-smooth-scroll \{\s*scroll-behavior: auto !important;\s*\}/,
	);
});
