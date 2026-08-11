import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Better Markdown Preview extension', () => {
	test('activates without registering product behavior', async () => {
		const extension = vscode.extensions.all.find(
			(candidate) => candidate.packageJSON.name === 'better-markdown-preview',
		);

		assert.ok(extension, 'the extension is available in the development host');
		assert.deepStrictEqual(extension.packageJSON.contributes, {});

		await extension.activate();

		assert.strictEqual(extension.isActive, true);
	});
});
