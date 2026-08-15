import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { pnpmInvocation } from './lib/commands.mts';

await mkdir('artifacts', { recursive: true });

const invocation = pnpmInvocation([
	'exec',
	'vsce',
	'package',
	'--no-dependencies',
	'--out',
	'artifacts/better-markdown-preview.vsix',
]);
const child = spawn(invocation.command, invocation.args, invocation.options);

child.on('error', (error) => {
	console.error(`Failed to package extension: ${error.message}`);
	process.exitCode = 1;
});

child.on('exit', (code, signal) => {
	if (signal) {
		console.error(`Extension packaging exited after signal ${signal}`);
		process.exitCode = 1;
		return;
	}

	process.exitCode = code ?? 1;
});
