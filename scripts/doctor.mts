import { spawnSync } from 'node:child_process';
import { desktopHostPrerequisites } from './lib/host-tests.mts';

type CommandProbe = (command: string) => boolean;

function commandAvailable(command: string): boolean {
	const result = spawnSync(command, ['--help'], { stdio: 'ignore' });
	return result.error === undefined && result.status === 0;
}

export function checkDesktopHostPrerequisites(
	commands = desktopHostPrerequisites(),
	probe: CommandProbe = commandAvailable,
): string[] {
	const missing = commands.filter((command) => !probe(command));
	if (missing.length > 0) {
		throw new Error(
			`Missing desktop host prerequisite: ${missing.join(', ')}. Install Xvfb or set DISPLAY before running desktop host tests.`,
		);
	}
	return commands;
}

if (import.meta.main) {
	const commands = checkDesktopHostPrerequisites();
	if (commands.length === 0) {
		console.log('No additional desktop host prerequisites are required.');
	} else {
		console.log(
			`Desktop host prerequisites available: ${commands.join(', ')}.`,
		);
	}
}
