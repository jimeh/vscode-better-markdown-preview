import assert from 'node:assert/strict';
import test from 'node:test';
import { pnpmInvocation } from '../scripts/lib/commands.mts';
import { desktopTestInvocation } from '../scripts/lib/host-tests.mts';

test('pnpm invocation enables the shell only on Windows', () => {
	const args = ['exec', 'vscode-test'];

	assert.deepEqual(pnpmInvocation(args, 'win32'), {
		command: 'pnpm',
		args,
		options: {
			shell: true,
			stdio: 'inherit',
		},
	});
	assert.deepEqual(pnpmInvocation(args, 'darwin'), {
		command: 'pnpm',
		args,
		options: {
			shell: false,
			stdio: 'inherit',
		},
	});
	assert.deepEqual(pnpmInvocation(args, 'linux'), {
		command: 'pnpm',
		args,
		options: {
			shell: false,
			stdio: 'inherit',
		},
	});
});

test('desktop host invocation selects a virtual display only on headless Linux', () => {
	assert.deepEqual(desktopTestInvocation('desktop-floor', 'linux', undefined), {
		command: 'xvfb-run',
		args: ['-a', 'pnpm', 'exec', 'vscode-test', '--label', 'desktop-floor'],
		options: { stdio: 'inherit' },
	});
	assert.deepEqual(desktopTestInvocation('desktop-stable', 'linux', ':0'), {
		command: 'pnpm',
		args: ['exec', 'vscode-test', '--label', 'desktop-stable'],
		options: { shell: false, stdio: 'inherit' },
	});
});
