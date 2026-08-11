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
});

test('task lists and rich code lines preserve the owned layout contract', () => {
	assert.match(css, /\.markdown-body \.task-list-item::marker/);
	assert.match(css, /\.markdown-body \.task-list-item-checkbox/);
	assert.match(
		css,
		/\.better-markdown-preview-code-line \{[\s\S]*?display: inline-block;[\s\S]*?min-width: 100%/,
	);
	assert.match(css, /@media \(max-width: 82rem\)/);
});
