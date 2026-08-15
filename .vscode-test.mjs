import { defineConfig } from '@vscode/test-cli';
import { DESKTOP_FLOOR_VERSION } from './scripts/lib/host-tests.mts';

export default defineConfig([
	{
		label: 'desktop-floor',
		files: 'out/test/desktop/**/*.test.js',
		version: DESKTOP_FLOOR_VERSION,
	},
	{
		label: 'desktop-stable',
		files: 'out/test/desktop/**/*.test.js',
		version: 'stable',
	},
]);
