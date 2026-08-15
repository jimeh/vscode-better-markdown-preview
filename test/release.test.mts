import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { Result } from 'semantic-release';
import { assertSha256, writeSha256 } from '../scripts/lib/checksum.mts';
import {
	assertReleaseChangelog,
	type PackageInspection,
} from '../scripts/lib/package-contract.mts';
import { packageFilename } from '../scripts/lib/package.mts';
import releaseConfig from '../scripts/lib/release-config.mts';
import {
	releaseOutputs,
	writeReleaseOutputs,
} from '../scripts/lib/release.mts';

interface Commit {
	hash: string;
	message: string;
}

type AnalyzeCommits = (
	pluginConfig: Record<string, unknown>,
	context: {
		commits: Commit[];
		cwd: string;
		logger: { log: () => void };
	},
) => Promise<string | null>;

type GenerateNotes = (
	pluginConfig: Record<string, unknown>,
	context: Record<string, unknown>,
) => Promise<string>;

type PrepareChangelog = (
	pluginConfig: Record<string, unknown>,
	context: {
		cwd: string;
		logger: { log: () => void };
		nextRelease: { notes: string };
	},
) => Promise<void>;

const commitAnalyzerModule = '@semantic-release/commit-analyzer';
const notesGeneratorModule = '@semantic-release/release-notes-generator';
const changelogModule = '@semantic-release/changelog';
const { analyzeCommits } = (await import(commitAnalyzerModule)) as {
	analyzeCommits: AnalyzeCommits;
};
const { generateNotes } = (await import(notesGeneratorModule)) as {
	generateNotes: GenerateNotes;
};
const { prepare: prepareChangelog } = (await import(changelogModule)) as {
	prepare: PrepareChangelog;
};

function pluginOptions(name: string): Record<string, unknown> {
	const specification = releaseConfig.plugins?.find(
		(plugin) => Array.isArray(plugin) && plugin[0] === name,
	);
	assert.ok(Array.isArray(specification));
	assert.equal(typeof specification[1], 'object');

	return specification[1] as Record<string, unknown>;
}

async function releaseType(message: string): Promise<string | null> {
	return analyzeCommits(pluginOptions(commitAnalyzerModule), {
		commits: [{ hash: 'abc1234', message }],
		cwd: process.cwd(),
		logger: { log: () => undefined },
	});
}

test('release policy maps conventional commits to intended versions', async () => {
	assert.deepEqual(releaseConfig.branches, ['main']);
	assert.equal(releaseConfig.tagFormat, 'v${version}');
	assert.equal(await releaseType('feat: add viewer'), 'minor');
	assert.equal(await releaseType('fix: restore preview'), 'patch');
	assert.equal(await releaseType('docs: explain columns'), 'patch');
	assert.equal(await releaseType('revert: remove broken change'), 'patch');
	assert.equal(await releaseType('chore: reorder tooling'), null);
	assert.equal(await releaseType('feat!: remove legacy setting'), 'major');
	assert.equal(
		await releaseType('docs!: replace configuration format'),
		'major',
	);
	assert.equal(await releaseType('chore!: drop old Node versions'), 'major');
	assert.deepEqual(
		releaseConfig.plugins?.map((plugin) =>
			Array.isArray(plugin) ? plugin[0] : plugin,
		),
		[
			'@semantic-release/commit-analyzer',
			'@semantic-release/release-notes-generator',
			'@semantic-release/changelog',
			'@semantic-release/exec',
			'@semantic-release/github',
		],
	);
});

test('generated notes show documentation and hide maintenance commits', async () => {
	const notes = await generateNotes(pluginOptions(notesGeneratorModule), {
		commits: [
			{ hash: 'abc1234', message: 'docs: explain columns' },
			{ hash: 'def5678', message: 'chore: reorder tooling' },
		],
		cwd: process.cwd(),
		lastRelease: {
			channels: [],
			gitHead: '0000000',
			gitTag: 'v1.0.0',
			name: 'v1.0.0',
			version: '1.0.0',
		},
		logger: { log: () => undefined },
		nextRelease: {
			channel: '',
			gitHead: '1111111',
			gitTag: 'v1.0.1',
			name: 'v1.0.1',
			type: 'patch',
			version: '1.0.1',
		},
		options: {
			repositoryUrl:
				'https://github.com/jimeh/vscode-better-markdown-preview.git',
		},
	});

	assert.match(notes, /### Documentation/);
	assert.match(notes, /explain columns/);
	assert.doesNotMatch(notes, /reorder tooling/);
});

test('release artifacts use stable versioned filenames', () => {
	assert.equal(
		packageFilename('jimeh', 'better-markdown-preview', '1.2.3'),
		'jimeh.better-markdown-preview-1.2.3.vsix',
	);
	assert.throws(
		() => packageFilename('jimeh', 'better-markdown-preview', '../1.2.3'),
		/Expected a stable semantic version/,
	);
});

test('release package checks require current notes and a valid checksum', async () => {
	const temporaryDirectory = await mkdtemp(
		path.join(os.tmpdir(), 'better-markdown-preview-checksum-'),
	);
	try {
		const changelogPath = path.join(temporaryDirectory, 'CHANGELOG.md');
		await writeFile(
			changelogPath,
			await readFile(new URL('../CHANGELOG.md', import.meta.url), 'utf8'),
		);
		await prepareChangelog(pluginOptions(changelogModule), {
			cwd: temporaryDirectory,
			logger: { log: () => undefined },
			nextRelease: {
				notes: '## 1.2.3\n\n### Documentation\n\n- explain release automation',
			},
		});
		const inspection = {
			archive: {},
			changelog: await readFile(changelogPath, 'utf8'),
			manifest: { contributes: {} },
		} satisfies PackageInspection;
		assertReleaseChangelog(inspection, '1.2.3');
		assert.match(inspection.changelog, /GitHub Releases/);
		assert.equal(
			[...inspection.changelog.matchAll(/^# Changelog$/gm)].length,
			1,
		);
		assert.throws(
			() =>
				assertReleaseChangelog(
					{ ...inspection, changelog: '# Changelog\n\n## [Unreleased]\n' },
					'1.2.3',
				),
			/The input did not match|The input was expected not to match/,
		);

		const vsixPath = path.join(temporaryDirectory, 'extension.vsix');
		await writeFile(vsixPath, 'immutable package bytes');
		const checksumPath = await writeSha256(vsixPath);
		await assertSha256(vsixPath, checksumPath);
		await writeFile(vsixPath, 'mutated package bytes');
		await assert.rejects(assertSha256(vsixPath, checksumPath));
	} finally {
		await rm(temporaryDirectory, { force: true, recursive: true });
	}
});

test('release runner exposes no-op and published outputs', async () => {
	assert.deepEqual(releaseOutputs(false), {
		released: 'false',
		version: '',
		git_tag: '',
		vsix_path: '',
		checksum_path: '',
	});

	const outputs = releaseOutputs({
		commits: [],
		lastRelease: {
			channels: [],
			gitHead: '0000000',
			gitTag: 'v1.2.2',
			name: 'v1.2.2',
			version: '1.2.2',
		},
		nextRelease: {
			channel: '',
			gitHead: '1111111',
			gitTag: 'v1.2.3',
			name: 'v1.2.3',
			notes: 'notes',
			type: 'patch',
			version: '1.2.3',
		},
		releases: [],
	} as Result);
	assert.deepEqual(outputs, {
		released: 'true',
		version: '1.2.3',
		git_tag: 'v1.2.3',
		vsix_path: 'artifacts/jimeh.better-markdown-preview-1.2.3.vsix',
		checksum_path: 'artifacts/jimeh.better-markdown-preview-1.2.3.vsix.sha256',
	});

	const temporaryDirectory = await mkdtemp(
		path.join(os.tmpdir(), 'better-markdown-preview-release-'),
	);
	try {
		const outputPath = path.join(temporaryDirectory, 'github-output');
		await writeReleaseOutputs(outputPath, outputs);
		assert.equal(
			await readFile(outputPath, 'utf8'),
			[
				'released=true',
				'version=1.2.3',
				'git_tag=v1.2.3',
				'vsix_path=artifacts/jimeh.better-markdown-preview-1.2.3.vsix',
				'checksum_path=artifacts/jimeh.better-markdown-preview-1.2.3.vsix.sha256',
				'',
			].join('\n'),
		);
	} finally {
		await rm(temporaryDirectory, { force: true, recursive: true });
	}
});
