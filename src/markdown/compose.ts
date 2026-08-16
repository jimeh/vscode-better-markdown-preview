import type MarkdownIt from 'markdown-it';
import definitionList from 'markdown-it-deflist';
import { full as emoji } from 'markdown-it-emoji';
import footnote from 'markdown-it-footnote';
import githubAlerts from 'markdown-it-github-alerts';
import taskLists from 'markdown-it-task-lists';
import {
	defaultConfiguration,
	previewConfiguration,
	type BetterMarkdownPreviewConfiguration,
} from '../config';
import type { BlockParseContext } from './block-context';
import { installColumns } from './columns';
import { installFenceRenderer } from './fences';
import { installFrontmatter } from './frontmatter';
import {
	installEscapedMarkdownProtection,
	installGfmAutolinks,
	installGfmTagFilter,
} from './inline';

export function extendMarkdownIt(
	md: MarkdownIt,
	configuration: BetterMarkdownPreviewConfiguration = defaultConfiguration,
): MarkdownIt {
	if (configuration.rendering.taskLists) {
		md.use(taskLists, { enabled: false });
	}
	if (configuration.rendering.definitionLists) {
		md.use(definitionList);
	}
	if (configuration.rendering.footnotes) {
		md.use(footnote);
	}
	if (configuration.rendering.githubAlerts) {
		md.use(githubAlerts, {
			classPrefix: 'better-markdown-preview-alert',
			matchCaseSensitive: true,
			icons: {},
		});
	}
	const blockContext: BlockParseContext = { nestedDepth: 0 };
	if (
		configuration.rendering.tomlFrontmatter ||
		configuration.rendering.yamlFrontmatter
	) {
		installFrontmatter(md, configuration, blockContext);
	}
	if (configuration.rendering.columns) {
		installColumns(md, blockContext);
	}
	if (configuration.rendering.emojiShortcodes) {
		installEscapedMarkdownProtection(md);
		md.use(
			emoji,
			configuration.rendering.emoticonShortcuts ? {} : { shortcuts: {} },
		);
	}
	// Both rules insert after `linkify`; installing emoji first keeps the
	// extension's autolink pass ahead of emoji replacement in the final order.
	if (configuration.rendering.enhancedAutolinks) {
		installGfmAutolinks(md);
	}
	installGfmTagFilter(
		md,
		configuration.rendering.enhancedAutolinks
			? 'better_markdown_preview_gfm_autolink'
			: 'linkify',
	);
	if (
		configuration.rendering.mermaid ||
		configuration.rendering.richCodeBlocks
	) {
		installFenceRenderer(md, configuration);
	}
	installPreviewConfiguration(md, configuration);
	return md;
}

function installPreviewConfiguration(
	md: MarkdownIt,
	configuration: BetterMarkdownPreviewConfiguration,
): void {
	const value = md.utils.escapeHtml(
		JSON.stringify(previewConfiguration(configuration)),
	);
	md.core.ruler.push('better_markdown_preview_configuration', (state) => {
		if (state.inlineMode) {
			return;
		}
		const marker = new state.Token('html_block', '', 0);
		marker.block = true;
		marker.content = `<span hidden data-bmp-preview-config="${value}"></span>\n`;
		state.tokens.push(marker);
	});
}
