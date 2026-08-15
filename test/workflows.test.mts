import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ciWorkflow = await readFile(
	new URL('../.github/workflows/ci.yml', import.meta.url),
	'utf8',
);
const semanticPrWorkflow = await readFile(
	new URL('../.github/workflows/semantic-pr.yml', import.meta.url),
	'utf8',
);

function occurrences(source: string, pattern: RegExp): number {
	return [...source.matchAll(pattern)].length;
}

test('semantic PR validation is metadata-only and enforces the release vocabulary', () => {
	assert.match(semanticPrWorkflow, /^\s{2}pull_request_target:/m);
	for (const event of ['opened', 'edited', 'reopened', 'synchronize']) {
		assert.match(semanticPrWorkflow, new RegExp(`^\\s{6}- ${event}$`, 'm'));
	}
	assert.match(semanticPrWorkflow, /^\s{2}pull-requests: write$/m);
	assert.doesNotMatch(semanticPrWorkflow, /actions\/checkout/);
	assert.match(
		semanticPrWorkflow,
		/amannn\/action-semantic-pull-request@48f256284bd46cdaab1048c3721360e808335d50/,
	);
	assert.match(
		semanticPrWorkflow,
		/marocchino\/sticky-pull-request-comment@5770ad5eb8f42dd2c4f34da00c94c5381e49af88/,
	);
	for (const type of [
		'build',
		'chore',
		'ci',
		'docs',
		'feat',
		'fix',
		'perf',
		'refactor',
		'revert',
		'style',
		'test',
	]) {
		assert.match(semanticPrWorkflow, new RegExp(`^\\s{12}${type}$`, 'm'));
	}
	assert.match(semanticPrWorkflow, /subjectPattern: \^\(\?!\[A-Z\]\)\.\+\$/);
	assert.match(semanticPrWorkflow, /delete: true/);
});

test('main release waits for every host gate and cannot be cancelled', () => {
	assert.match(
		ciWorkflow,
		/cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/,
	);
	assert.match(
		ciWorkflow,
		/release:\n\s{4}name: Release[\s\S]*?needs:\n\s{6}- validate\n\s{6}- desktop-host\n\s{6}- web-host/,
	);
	assert.match(ciWorkflow, /fetch-depth: 0/);
	assert.match(
		ciWorkflow,
		/client-id: \$\{\{ vars\.RELEASE_BOT_CLIENT_ID \}\}/,
	);
	assert.match(
		ciWorkflow,
		/private-key: \$\{\{ secrets\.RELEASE_BOT_PRIVATE_KEY \}\}/,
	);
	assert.match(ciWorkflow, /permission-contents: write/);
	assert.match(ciWorkflow, /permission-issues: write/);
	assert.doesNotMatch(ciWorkflow, /^\s{4}tags:/m);
});

test('publication jobs share one immutable package and isolate credentials', () => {
	for (const job of [
		'publish-vscode',
		'publish-openvsx',
		'upload-github-release',
	]) {
		assert.match(ciWorkflow, new RegExp(`^\\s{2}${job}:$`, 'm'));
	}
	assert.equal(occurrences(ciWorkflow, /secrets\.VSCE_PAT/g), 1);
	assert.equal(occurrences(ciWorkflow, /secrets\.OVSX_PAT/g), 1);
	assert.equal(occurrences(ciWorkflow, /actions\/upload-artifact@/g), 2);
	assert.equal(occurrences(ciWorkflow, /name: release-\$\{\{/g), 4);
	assert.equal(
		occurrences(
			ciWorkflow,
			/\(cd artifacts && sha256sum --check "jimeh\.better-markdown-preview-\$\{VERSION\}\.vsix\.sha256"\)/g,
		),
		3,
	);
	assert.match(ciWorkflow, /vsce publish --packagePath "\$VSIX_PATH"/);
	assert.match(ciWorkflow, /ovsx publish "\$VSIX_PATH"/);
	assert.match(
		ciWorkflow,
		/gh release upload "\$GIT_TAG" "\$VSIX_PATH" "\$CHECKSUM_PATH" --clobber/,
	);
});
