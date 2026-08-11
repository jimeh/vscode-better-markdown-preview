import type MarkdownIt from 'markdown-it';
import { extendMarkdownIt } from './markdown/compose';

export interface MarkdownExtensionApi {
	extendMarkdownIt(markdownIt: MarkdownIt): MarkdownIt;
}

export function activate(): MarkdownExtensionApi {
	return { extendMarkdownIt };
}

export function deactivate(): void {}
