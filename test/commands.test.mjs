import assert from 'node:assert/strict';
import test from 'node:test';
import { pnpmInvocation } from '../scripts/lib/commands.mjs';

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
