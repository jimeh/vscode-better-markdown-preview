// @vitest-environment happy-dom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mermaidMock = vi.hoisted(() => ({
	initialize: vi.fn(),
	render: vi.fn(),
}));

vi.mock('mermaid', () => ({ default: mermaidMock }));

import { render } from './mermaid-runtime';

describe('Mermaid adapter', () => {
	beforeEach(() => {
		mermaidMock.initialize.mockReset();
		mermaidMock.render.mockReset();
	});

	test('initializes strict themed rendering, inserts SVG, binds, and uses unique IDs', async () => {
		const bindFunctions = vi.fn();
		mermaidMock.render
			.mockResolvedValueOnce({
				svg: '<svg data-diagram="one"></svg>',
				bindFunctions,
			})
			.mockResolvedValueOnce({ svg: '<svg data-diagram="two"></svg>' });
		const first = document.createElement('div');
		const second = document.createElement('div');
		const theme = {
			dark: true,
			background: '#111111',
			foreground: '#eeeeee',
			border: '#777777',
			accent: '#55aaff',
		};

		await render(first, 'graph TD\nA-->B', theme);
		await render(second, 'graph TD\nB-->C', theme);

		expect(mermaidMock.initialize).toHaveBeenCalledTimes(2);
		expect(mermaidMock.initialize).toHaveBeenLastCalledWith({
			startOnLoad: false,
			securityLevel: 'strict',
			theme: 'base',
			themeVariables: {
				background: '#111111',
				primaryColor: '#111111',
				primaryTextColor: '#eeeeee',
				primaryBorderColor: '#777777',
				lineColor: '#eeeeee',
				secondaryColor: '#111111',
				tertiaryColor: '#111111',
				fontFamily: 'var(--vscode-font-family)',
			},
		});
		const firstId = mermaidMock.render.mock.calls[0]?.[0];
		const secondId = mermaidMock.render.mock.calls[1]?.[0];
		expect(firstId).toMatch(/^better-markdown-preview-mermaid-\d+$/);
		expect(secondId).toMatch(/^better-markdown-preview-mermaid-\d+$/);
		expect(secondId).not.toBe(firstId);
		expect(first.innerHTML).toContain('data-diagram="one"');
		expect(second.innerHTML).toContain('data-diagram="two"');
		expect(bindFunctions).toHaveBeenCalledWith(first);
	});

	test('propagates Mermaid rendering failures without replacing fallback source', async () => {
		const element = document.createElement('div');
		element.textContent = 'graph TD\nA-->B';
		const failure = new Error('invalid diagram');
		mermaidMock.render.mockRejectedValue(failure);

		await expect(
			render(element, element.textContent, {
				dark: false,
				background: '#ffffff',
				foreground: '#000000',
				border: '#888888',
				accent: '#0000ff',
			}),
		).rejects.toBe(failure);
		expect(element.textContent).toBe('graph TD\nA-->B');
	});
});
