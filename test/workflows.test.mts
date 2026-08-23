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
const dependabotConfig = await readFile(
	new URL('../.github/dependabot.yml', import.meta.url),
	'utf8',
);

function occurrences(source: string, pattern: RegExp): number {
	return [...source.matchAll(pattern)].length;
}

test('CI names every repository quality gate explicitly', () => {
	assert.match(
		ciWorkflow,
		/name: Format, lint, typecheck, test, and prepare hosts/,
	);
	for (const [step, task] of [
		['Check formatting', 'format:check'],
		['Lint code, CSS, and Markdown', 'lint'],
		['Typecheck all TypeScript projects', 'typecheck'],
		['Run Node contract tests', 'test:contracts'],
		['Run unit tests with coverage', 'test:coverage'],
		['Validate package contents', 'package:validate'],
		['Validate GitHub Actions workflows', 'ci:workflows'],
	]) {
		assert.match(
			ciWorkflow,
			new RegExp(`name: ${step}\\n\\s+run: mise run ${task}`),
		);
	}
});

test('CI runs the production preview bundles in Chromium before release', () => {
	assert.match(
		ciWorkflow,
		/^  preview-browser:\n    name: Preview browser \(Chromium\)$/m,
	);
	assert.match(
		ciWorkflow,
		/name: Run preview browser contract\n\s+run: mise run test:preview-browser/,
	);
	assert.match(
		ciWorkflow,
		/release:\n\s{4}name: Release[\s\S]*?needs:\n\s{6}- validate\n\s{6}- preview-browser\n\s{6}- desktop-host\n\s{6}- web-host/,
	);
});

test('Dependabot batches low-risk weekly updates without enabling auto-merge', () => {
	assert.match(dependabotConfig, /^version: 2$/m);
	assert.equal(occurrences(dependabotConfig, /^  - package-ecosystem:/gm), 2);
	for (const ecosystem of ['npm', 'github-actions']) {
		assert.match(
			dependabotConfig,
			new RegExp(`package-ecosystem: ${ecosystem}`),
		);
	}
	assert.equal(occurrences(dependabotConfig, /interval: weekly/g), 2);
	assert.equal(occurrences(dependabotConfig, /timezone: Europe\/London/g), 2);
	assert.match(dependabotConfig, /default-days: 7/);
	assert.match(dependabotConfig, /prefix: fix\(deps\)/);
	assert.match(dependabotConfig, /prefix-development: chore\(deps-dev\)/);
	assert.match(dependabotConfig, /prefix: ci\(deps\)/);
	for (const group of [
		'runtime-minor-and-patch',
		'development-minor-and-patch',
		'release-tooling-minor-and-patch',
		'host-compatibility-minor-and-patch',
		'actions-all',
	]) {
		assert.match(dependabotConfig, new RegExp(`^      ${group}:$`, 'm'));
	}
	assert.match(
		dependabotConfig,
		/actions-all:\n\s+patterns:\n\s+- '\*'\n\s+update-types:\n\s+- major\n\s+- minor\n\s+- patch/,
	);
	assert.doesNotMatch(dependabotConfig, /auto-merge|automerge/i);
});

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
	assert.match(
		semanticPrWorkflow,
		/subjectPatternError: The subject must not start with an uppercase character\./,
	);
	assert.match(
		semanticPrWorkflow,
		/if: \$\{\{ !cancelled\(\) && steps\.lint_pr_title\.outputs\.error_message != null \}\}/,
	);
	assert.match(
		semanticPrWorkflow,
		/name: Remove PR title lint comment\n\s{8}if:[\s\S]*?\n\s{8}continue-on-error: true/,
	);
	assert.match(semanticPrWorkflow, /delete: true/);
});

test('main release waits for every host gate and cannot be cancelled', () => {
	assert.match(
		ciWorkflow,
		/cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/,
	);
	assert.match(
		ciWorkflow,
		/group: \$\{\{ github\.workflow \}\}-\$\{\{ github\.event_name == 'push' && github\.ref == 'refs\/heads\/main' && 'main-release' \|\| github\.ref \}\}/,
	);
	assert.match(
		ciWorkflow,
		/release:\n\s{4}name: Release[\s\S]*?needs:\n\s{6}- validate\n\s{6}- preview-browser\n\s{6}- desktop-host\n\s{6}- web-host/,
	);
	assert.match(
		ciWorkflow,
		/if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/,
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
	assert.equal(
		occurrences(ciWorkflow, /if: needs\.release\.outputs\.released == 'true'/g),
		3,
	);
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
	assert.match(ciWorkflow, /GH_REPO: \$\{\{ github\.repository \}\}/);
});
