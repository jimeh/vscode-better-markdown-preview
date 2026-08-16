export const CONFIGURATION_SECTION = 'betterMarkdownPreview';

export const configurationKeys = [
	'rendering.taskLists',
	'rendering.definitionLists',
	'rendering.footnotes',
	'rendering.githubAlerts',
	'rendering.emojiShortcodes',
	'rendering.emoticonShortcuts',
	'rendering.tomlFrontmatter',
	'rendering.yamlFrontmatter',
	'rendering.columns',
	'rendering.enhancedAutolinks',
	'rendering.richCodeBlocks',
	'rendering.mermaid',
	'navigation.tableOfContents',
	'navigation.smoothScrolling',
	'mermaid.viewer',
	'mermaid.theme.primaryColorShift',
	'mermaid.theme.secondaryColorShift',
	'mermaid.theme.tertiaryColorShift',
	'mermaid.theme.borderColorShift',
] as const;

export interface MermaidColorShifts {
	primary: number;
	secondary: number;
	tertiary: number;
	border: number;
}

export interface BetterMarkdownPreviewConfiguration {
	rendering: {
		taskLists: boolean;
		definitionLists: boolean;
		footnotes: boolean;
		githubAlerts: boolean;
		emojiShortcodes: boolean;
		emoticonShortcuts: boolean;
		tomlFrontmatter: boolean;
		yamlFrontmatter: boolean;
		columns: boolean;
		enhancedAutolinks: boolean;
		richCodeBlocks: boolean;
		mermaid: boolean;
	};
	navigation: {
		tableOfContents: boolean;
		smoothScrolling: boolean;
	};
	mermaid: {
		viewer: boolean;
		theme: MermaidColorShifts;
	};
}

export interface PreviewConfiguration {
	tableOfContents: boolean;
	smoothScrolling: boolean;
	mermaidViewer: boolean;
	mermaidTheme: MermaidColorShifts;
}

export interface ConfigurationReader {
	get<T>(section: string, defaultValue: T): T;
}

export const defaultMermaidColorShifts: MermaidColorShifts = {
	primary: 12,
	secondary: 18,
	tertiary: 10,
	border: 45,
};

export const defaultConfiguration: BetterMarkdownPreviewConfiguration = {
	rendering: {
		taskLists: true,
		definitionLists: true,
		footnotes: true,
		githubAlerts: true,
		emojiShortcodes: true,
		emoticonShortcuts: false,
		tomlFrontmatter: true,
		yamlFrontmatter: true,
		columns: true,
		enhancedAutolinks: true,
		richCodeBlocks: true,
		mermaid: true,
	},
	navigation: {
		tableOfContents: true,
		smoothScrolling: true,
	},
	mermaid: {
		viewer: true,
		theme: defaultMermaidColorShifts,
	},
};

export function readConfiguration(
	configuration: ConfigurationReader,
): BetterMarkdownPreviewConfiguration {
	const readBoolean = (
		key: (typeof configurationKeys)[number],
		defaultValue: boolean,
	): boolean => configuration.get(key, defaultValue);
	const enabled = (key: (typeof configurationKeys)[number]): boolean =>
		readBoolean(key, true);
	const readColorShift = (
		key: (typeof configurationKeys)[number],
		defaultValue: number,
	): number =>
		normalizeColorShift(
			configuration.get<unknown>(key, defaultValue),
			defaultValue,
		);
	return {
		rendering: {
			taskLists: enabled('rendering.taskLists'),
			definitionLists: enabled('rendering.definitionLists'),
			footnotes: enabled('rendering.footnotes'),
			githubAlerts: enabled('rendering.githubAlerts'),
			emojiShortcodes: enabled('rendering.emojiShortcodes'),
			emoticonShortcuts: readBoolean('rendering.emoticonShortcuts', false),
			tomlFrontmatter: enabled('rendering.tomlFrontmatter'),
			yamlFrontmatter: enabled('rendering.yamlFrontmatter'),
			columns: enabled('rendering.columns'),
			enhancedAutolinks: enabled('rendering.enhancedAutolinks'),
			richCodeBlocks: enabled('rendering.richCodeBlocks'),
			mermaid: enabled('rendering.mermaid'),
		},
		navigation: {
			tableOfContents: enabled('navigation.tableOfContents'),
			smoothScrolling: enabled('navigation.smoothScrolling'),
		},
		mermaid: {
			viewer: enabled('mermaid.viewer'),
			theme: {
				primary: readColorShift(
					'mermaid.theme.primaryColorShift',
					defaultMermaidColorShifts.primary,
				),
				secondary: readColorShift(
					'mermaid.theme.secondaryColorShift',
					defaultMermaidColorShifts.secondary,
				),
				tertiary: readColorShift(
					'mermaid.theme.tertiaryColorShift',
					defaultMermaidColorShifts.tertiary,
				),
				border: readColorShift(
					'mermaid.theme.borderColorShift',
					defaultMermaidColorShifts.border,
				),
			},
		},
	};
}

export function previewConfiguration(
	configuration: BetterMarkdownPreviewConfiguration,
): PreviewConfiguration {
	return {
		tableOfContents: configuration.navigation.tableOfContents,
		smoothScrolling: configuration.navigation.smoothScrolling,
		mermaidViewer: configuration.mermaid.viewer,
		mermaidTheme: configuration.mermaid.theme,
	};
}

export function normalizeColorShift(
	value: unknown,
	defaultValue: number,
): number {
	return typeof value === 'number' && Number.isFinite(value)
		? Math.min(100, Math.max(0, value))
		: defaultValue;
}
