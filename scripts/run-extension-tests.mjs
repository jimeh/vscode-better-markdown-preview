import { spawn } from 'node:child_process';
import { pnpmInvocation } from './lib/commands.mjs';

const needsVirtualDisplay =
	process.platform === 'linux' && !process.env.DISPLAY;
const invocation = needsVirtualDisplay
	? {
			command: 'xvfb-run',
			args: ['-a', 'pnpm', 'exec', 'vscode-test'],
			options: { stdio: 'inherit' },
		}
	: pnpmInvocation(['exec', 'vscode-test']);

const child = spawn(invocation.command, invocation.args, invocation.options);

child.on('error', (error) => {
	console.error(`Failed to start Extension Host tests: ${error.message}`);
	process.exitCode = 1;
});

child.on('exit', (code, signal) => {
	if (signal) {
		console.error(`Extension Host tests exited after signal ${signal}`);
		process.exitCode = 1;
		return;
	}

	process.exitCode = code ?? 1;
});
