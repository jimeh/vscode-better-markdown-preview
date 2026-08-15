import { resolve } from 'node:path';
import { runTests } from '@vscode/test-web';

const repositoryRoot = resolve(import.meta.dirname, '..');

try {
	await runTests({
		browserType: 'chromium',
		extensionDevelopmentPath: repositoryRoot,
		extensionTestsPath: resolve(repositoryRoot, 'out/web-test/index.js'),
		headless: true,
		quality: 'stable',
		testRunnerDataDir: resolve(repositoryRoot, '.vscode-test-web'),
	});
} catch (error: unknown) {
	console.error('Failed to run stable VS Code web host tests:', error);
	process.exitCode = 1;
}
