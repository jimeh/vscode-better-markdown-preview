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
			accent: '#55aaff',
			colorShifts: {
				primary: 12,
				secondary: 18,
				tertiary: 10,
				border: 45,
			},
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
				darkMode: true,
				primaryColor: '#19232e',
				primaryTextColor: '#eeeeee',
				primaryBorderColor: '#30567c',
				lineColor: '#eeeeee',
				secondaryColor: '#1d2d3c',
				secondaryTextColor: '#eeeeee',
				secondaryBorderColor: '#30567c',
				tertiaryColor: '#272727',
				tertiaryTextColor: '#eeeeee',
				tertiaryBorderColor: '#747474',
				textColor: '#eeeeee',
				edgeLabelBackground: '#111111',
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
				accent: '#0000ff',
				colorShifts: {
					primary: 12,
					secondary: 18,
					tertiary: 10,
					border: 45,
				},
			}),
		).rejects.toBe(failure);
		expect(element.textContent).toBe('graph TD\nA-->B');
	});

	test('normalizes alpha theme colors to opaque Mermaid hex values', async () => {
		mermaidMock.render.mockResolvedValue({ svg: '<svg></svg>' });
		const element = document.createElement('div');

		await render(element, 'graph TD\nA-->B', {
			dark: false,
			background: '#fff',
			foreground: '#222',
			accent: '#06c8',
			contrastBorder: '#0f08',
			colorShifts: {
				primary: 100,
				secondary: 0,
				tertiary: 100,
				border: 45,
			},
		});

		expect(mermaidMock.initialize).toHaveBeenCalledWith({
			startOnLoad: false,
			securityLevel: 'strict',
			theme: 'base',
			themeVariables: expect.objectContaining({
				background: '#ffffff',
				primaryColor: '#77ade4',
				secondaryColor: '#ffffff',
				tertiaryColor: '#222222',
				primaryBorderColor: '#77ff77',
				secondaryBorderColor: '#77ff77',
				tertiaryBorderColor: '#77ff77',
				edgeLabelBackground: '#ffffff',
			}),
		});
	});
});
