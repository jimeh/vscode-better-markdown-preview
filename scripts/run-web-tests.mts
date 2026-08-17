import { resolve } from 'node:path';
import { runTests } from '@vscode/test-web';

const repositoryRoot = resolve(import.meta.dirname, '..');

type WebTestRunner = typeof runTests;
type Reporter = (message: string) => void;

export async function runStableWebHostTests(
	runner: WebTestRunner = runTests,
	report: Reporter = console.log,
): Promise<void> {
	await runner({
		browserType: 'chromium',
		extensionDevelopmentPath: repositoryRoot,
		extensionTestsPath: resolve(repositoryRoot, 'out/web-test/index.js'),
		headless: true,
		quality: 'stable',
		testRunnerDataDir: resolve(repositoryRoot, '.vscode-test-web'),
	});
	report('Stable VS Code web host contract passed.');
}

if (import.meta.main) {
	try {
		await runStableWebHostTests();
	} catch (error: unknown) {
		console.error('Failed to run stable VS Code web host tests:', error);
		process.exitCode = 1;
	}
}
