import * as assert from 'assert';
import * as vscode from 'vscode';
import MarkdownIt from 'markdown-it';

interface MarkdownExtensionApi {
	extendMarkdownIt(markdownIt: MarkdownIt): MarkdownIt;
}

suite('Better Markdown Preview extension', () => {
	test('activates and exports the Markdown-It extension contract', async () => {
		const extension = vscode.extensions.all.find(
			(candidate) => candidate.packageJSON.name === 'better-markdown-preview',
		);

		assert.ok(extension, 'the extension is available in the development host');
		assert.strictEqual(
			extension.packageJSON.contributes['markdown.markdownItPlugins'],
			true,
		);

		const api = (await extension.activate()) as MarkdownExtensionApi;

		assert.strictEqual(extension.isActive, true);
		const html = api
			.extendMarkdownIt(new MarkdownIt({ html: true, linkify: false }))
			.render('- [x] native preview extension\n');
		assert.match(html, /task-list-item/);
	});
});
