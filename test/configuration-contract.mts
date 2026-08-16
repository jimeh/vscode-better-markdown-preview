import assert from 'node:assert/strict';

export const expectedConfigurationKeys = [
	'betterMarkdownPreview.rendering.taskLists',
	'betterMarkdownPreview.rendering.definitionLists',
	'betterMarkdownPreview.rendering.footnotes',
	'betterMarkdownPreview.rendering.githubAlerts',
	'betterMarkdownPreview.rendering.emojiShortcodes',
	'betterMarkdownPreview.rendering.emoticonShortcuts',
	'betterMarkdownPreview.rendering.tomlFrontmatter',
	'betterMarkdownPreview.rendering.yamlFrontmatter',
	'betterMarkdownPreview.rendering.columns',
	'betterMarkdownPreview.rendering.enhancedAutolinks',
	'betterMarkdownPreview.rendering.richCodeBlocks',
	'betterMarkdownPreview.rendering.mermaid',
	'betterMarkdownPreview.navigation.tableOfContents',
	'betterMarkdownPreview.navigation.smoothScrolling',
	'betterMarkdownPreview.mermaid.viewer',
];

export function assertConfigurationDocumentation(readme: string): void {
	const start = readme.indexOf('## Settings');
	assert.notEqual(start, -1, 'README must contain a Settings section');
	const end = readme.indexOf('\n## ', start + 1);
	assert.notEqual(
		end,
		-1,
		'README Settings section must have a closing heading',
	);

	const section = readme.slice(start, end);
	const documentedKeys = Array.from(
		section.matchAll(/`(betterMarkdownPreview\.[^`]+)`/g),
		(match) => match[1],
	);
	assert.deepEqual(
		documentedKeys,
		expectedConfigurationKeys,
		'README Settings must list every public configuration key exactly once and in manifest order',
	);
}

export function assertConfigurationContribution(value: unknown): void {
	assert.ok(typeof value === 'object' && value !== null);
	const contribution = value as Record<string, unknown>;
	assert.equal(contribution.title, 'Better Markdown Preview');
	assert.ok(
		typeof contribution.properties === 'object' &&
			contribution.properties !== null,
	);
	const properties = contribution.properties as Record<string, unknown>;
	assert.deepEqual(Object.keys(properties), expectedConfigurationKeys);
	const defaults: Record<string, boolean> = {
		'betterMarkdownPreview.rendering.emoticonShortcuts': false,
	};
	for (const key of expectedConfigurationKeys) {
		assert.ok(typeof properties[key] === 'object' && properties[key] !== null);
		const property = properties[key] as Record<string, unknown>;
		assert.equal(property.type, 'boolean', `${key} type`);
		assert.equal(property.default, defaults[key] ?? true, `${key} default`);
		assert.equal(property.scope, 'window', `${key} scope`);
		assert.equal(typeof property.description, 'string');
		assert.ok(
			(property.description as string).length > 0,
			`${key} description`,
		);
	}
}
