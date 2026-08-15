import type { Options } from 'semantic-release';

export const releaseRules = [
	{ breaking: true, release: 'major' },
	{ type: 'docs', release: 'patch' },
	{ type: 'revert', release: 'patch' },
] as const;

export const changelogTypes = [
	{ type: 'feat', section: 'Features' },
	{ type: 'feature', section: 'Features' },
	{ type: 'fix', section: 'Bug Fixes' },
	{ type: 'perf', section: 'Performance Improvements' },
	{ type: 'revert', section: 'Reverts' },
	{ type: 'docs', section: 'Documentation' },
	{ type: 'style', section: 'Styles', hidden: true },
	{ type: 'chore', section: 'Miscellaneous Chores', hidden: true },
	{ type: 'refactor', section: 'Code Refactoring', hidden: true },
	{ type: 'test', section: 'Tests', hidden: true },
	{ type: 'build', section: 'Build System', hidden: true },
	{ type: 'ci', section: 'Continuous Integration', hidden: true },
] as const;

const releaseConfig = {
	branches: ['main'],
	tagFormat: 'v${version}',
	plugins: [
		[
			'@semantic-release/commit-analyzer',
			{
				preset: 'conventionalcommits',
				releaseRules,
			},
		],
		[
			'@semantic-release/release-notes-generator',
			{
				preset: 'conventionalcommits',
				presetConfig: { types: changelogTypes },
			},
		],
		[
			'@semantic-release/changelog',
			{
				changelogFile: 'CHANGELOG.md',
				changelogTitle:
					'# Changelog\n\nRelease history is available in\n[GitHub Releases](https://github.com/jimeh/vscode-better-markdown-preview/releases).',
			},
		],
		[
			'@semantic-release/exec',
			{
				prepareCmd: 'mise run release:package -- ${nextRelease.version}',
			},
		],
		[
			'@semantic-release/github',
			{
				releasedLabels: false,
				successCommentCondition: false,
			},
		],
	],
} satisfies Options;

export default releaseConfig;
