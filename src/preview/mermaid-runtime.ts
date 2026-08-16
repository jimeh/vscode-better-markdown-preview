import mermaid from 'mermaid';
import type { MermaidTheme } from './runtime';

let diagramId = 0;

export async function render(
	element: HTMLElement,
	source: string,
	theme: MermaidTheme,
): Promise<void> {
	const themeVariables = deriveThemeVariables(theme);
	mermaid.initialize({
		startOnLoad: false,
		securityLevel: 'strict',
		theme: 'base',
		themeVariables: {
			...themeVariables,
			fontFamily: 'var(--vscode-font-family)',
		},
	});
	const id = `better-markdown-preview-mermaid-${diagramId++}`;
	const result = await mermaid.render(id, source);
	element.innerHTML = result.svg;
	result.bindFunctions?.(element);
}

interface RgbaColor {
	red: number;
	green: number;
	blue: number;
	alpha: number;
}

interface MermaidThemeVariables {
	background: string;
	darkMode: boolean;
	primaryColor: string;
	primaryTextColor: string;
	primaryBorderColor: string;
	secondaryColor: string;
	secondaryTextColor: string;
	secondaryBorderColor: string;
	tertiaryColor: string;
	tertiaryTextColor: string;
	tertiaryBorderColor: string;
	lineColor: string;
	textColor: string;
	edgeLabelBackground: string;
}

function deriveThemeVariables(theme: MermaidTheme): MermaidThemeVariables {
	const backdrop = theme.dark ? '#000000' : '#ffffff';
	const background = resolveColor(theme.background, backdrop, backdrop);
	const foreground = resolveColor(theme.foreground, '#1f2328', background);
	const accent = resolveColor(theme.accent, '#0969da', background);
	const contrastBorder = theme.contrastBorder
		? resolveColor(theme.contrastBorder, foreground, background)
		: undefined;
	const accentBorder =
		contrastBorder ?? mixColors(background, accent, theme.colorShifts.border);
	const neutralBorder =
		contrastBorder ??
		mixColors(background, foreground, theme.colorShifts.border);

	return {
		background,
		darkMode: theme.dark,
		primaryColor: mixColors(background, accent, theme.colorShifts.primary),
		primaryTextColor: foreground,
		primaryBorderColor: accentBorder,
		secondaryColor: mixColors(background, accent, theme.colorShifts.secondary),
		secondaryTextColor: foreground,
		secondaryBorderColor: accentBorder,
		tertiaryColor: mixColors(
			background,
			foreground,
			theme.colorShifts.tertiary,
		),
		tertiaryTextColor: foreground,
		tertiaryBorderColor: neutralBorder,
		lineColor: foreground,
		textColor: foreground,
		edgeLabelBackground: background,
	};
}

function resolveColor(
	value: string,
	fallback: string,
	backdrop: string,
): string {
	const parsed = parseHexColor(value) ?? parseHexColor(fallback);
	const parsedBackdrop = parseHexColor(backdrop);
	if (!parsed || !parsedBackdrop) {
		return fallback;
	}
	return formatHexColor({
		red: blendChannel(parsedBackdrop.red, parsed.red, parsed.alpha),
		green: blendChannel(parsedBackdrop.green, parsed.green, parsed.alpha),
		blue: blendChannel(parsedBackdrop.blue, parsed.blue, parsed.alpha),
		alpha: 1,
	});
}

function parseHexColor(value: string): RgbaColor | undefined {
	const match = /^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.exec(value.trim());
	if (!match) {
		return undefined;
	}
	const hex = match[1]!;
	const expanded =
		hex.length <= 4
			? Array.from(hex, (character) => `${character}${character}`).join('')
			: hex;
	return {
		red: Number.parseInt(expanded.slice(0, 2), 16),
		green: Number.parseInt(expanded.slice(2, 4), 16),
		blue: Number.parseInt(expanded.slice(4, 6), 16),
		alpha:
			expanded.length === 8
				? Number.parseInt(expanded.slice(6, 8), 16) / 255
				: 1,
	};
}

function mixColors(
	background: string,
	foreground: string,
	shift: number,
): string {
	const from = parseHexColor(background)!;
	const to = parseHexColor(foreground)!;
	const amount = Math.min(100, Math.max(0, shift)) / 100;
	return formatHexColor({
		red: blendChannel(from.red, to.red, amount),
		green: blendChannel(from.green, to.green, amount),
		blue: blendChannel(from.blue, to.blue, amount),
		alpha: 1,
	});
}

function blendChannel(from: number, to: number, amount: number): number {
	return Math.round(from + (to - from) * amount);
}

function formatHexColor(color: RgbaColor): string {
	const channel = (value: number): string =>
		Math.min(255, Math.max(0, value)).toString(16).padStart(2, '0');
	return `#${channel(color.red)}${channel(color.green)}${channel(color.blue)}`;
}
