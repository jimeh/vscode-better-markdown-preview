import type { SpawnOptions } from 'node:child_process';

export interface CommandInvocation {
	command: string;
	args: string[];
	options: SpawnOptions;
}

export function pnpmInvocation(
	args: readonly string[],
	platform: NodeJS.Platform = process.platform,
): CommandInvocation {
	return {
		command: 'pnpm',
		args: [...args],
		options: {
			shell: platform === 'win32',
			stdio: 'inherit',
		},
	};
}
