import assert from 'node:assert/strict';
import test from 'node:test';
import { checkDesktopHostPrerequisites } from '../scripts/doctor.mts';
import { pnpmInvocation } from '../scripts/lib/commands.mts';
import {
	desktopHostPrerequisites,
	desktopTestInvocation,
} from '../scripts/lib/host-tests.mts';
import { runStableWebHostTests } from '../scripts/run-web-tests.mts';

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
	assert.deepEqual(desktopHostPrerequisites('linux', undefined), ['xvfb-run']);
	assert.deepEqual(desktopHostPrerequisites('linux', ':0'), []);
	assert.deepEqual(desktopHostPrerequisites('darwin', undefined), []);
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

test('doctor reports missing headless desktop host prerequisites', () => {
	assert.deepEqual(
		checkDesktopHostPrerequisites(
			['xvfb-run'],
			(command) => command === 'xvfb-run',
		),
		['xvfb-run'],
	);
	assert.throws(
		() => checkDesktopHostPrerequisites(['xvfb-run'], () => false),
		/Missing desktop host prerequisite: xvfb-run\. Install Xvfb or set DISPLAY/,
	);
});

test('web host runner reports success only after the host contract passes', async () => {
	const events: string[] = [];
	await runStableWebHostTests(
		async (options) => {
			assert.equal(options.browserType, 'chromium');
			assert.equal(options.quality, 'stable');
			events.push('contract passed');
		},
		(message) => events.push(message),
	);
	assert.deepEqual(events, [
		'contract passed',
		'Stable VS Code web host contract passed.',
	]);

	const messages: string[] = [];
	await assert.rejects(
		() =>
			runStableWebHostTests(
				async () => {
					throw new Error('host failed');
				},
				(message) => messages.push(message),
			),
		/host failed/,
	);
	assert.deepEqual(messages, []);
});
