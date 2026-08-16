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
] as const;

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
	};
}

export interface PreviewConfiguration {
	tableOfContents: boolean;
	smoothScrolling: boolean;
	mermaidViewer: boolean;
}

export interface ConfigurationReader {
	get<T>(section: string, defaultValue: T): T;
}

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
	};
}
