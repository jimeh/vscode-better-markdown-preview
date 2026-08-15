import { spawn } from 'node:child_process';
import {
	desktopTestInvocation,
	isDesktopTestLabel,
} from './lib/host-tests.mts';

const label = process.argv[2];
if (!label || !isDesktopTestLabel(label)) {
	throw new Error(
		'Expected a desktop test label: desktop-floor or desktop-stable',
	);
}

const invocation = desktopTestInvocation(label);
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
