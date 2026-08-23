import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from '@vscode/test-cli';
import { DESKTOP_FLOOR_VERSION } from './scripts/lib/host-tests.mts';

/** @param {string} label */
function isolatedUserDataDir(label) {
	return `--user-data-dir=${join(tmpdir(), `bmp-${label}-${process.pid}`)}`;
}

export default defineConfig([
	{
		label: 'desktop-floor',
		files: 'out/test/desktop/**/*.test.js',
		version: DESKTOP_FLOOR_VERSION,
		launchArgs: [isolatedUserDataDir('floor')],
	},
	{
		label: 'desktop-stable',
		files: 'out/test/desktop/**/*.test.js',
		version: 'stable',
		launchArgs: [isolatedUserDataDir('stable')],
	},
]);
