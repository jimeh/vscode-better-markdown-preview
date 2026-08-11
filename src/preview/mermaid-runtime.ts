import mermaid from 'mermaid';
import type { MermaidTheme } from './runtime';

let diagramId = 0;

export async function render(
	element: HTMLElement,
	source: string,
	theme: MermaidTheme,
): Promise<void> {
	mermaid.initialize({
		startOnLoad: false,
		securityLevel: 'strict',
		theme: 'base',
		themeVariables: {
			background: theme.background,
			primaryColor: theme.background,
			primaryTextColor: theme.foreground,
			primaryBorderColor: theme.border,
			lineColor: theme.foreground,
			secondaryColor: theme.background,
			tertiaryColor: theme.background,
			fontFamily: 'var(--vscode-font-family)',
		},
	});
	const id = `better-markdown-preview-mermaid-${diagramId++}`;
	const result = await mermaid.render(id, source);
	element.innerHTML = result.svg;
	result.bindFunctions?.(element);
}
