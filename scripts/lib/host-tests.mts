import type { CommandInvocation } from './commands.mts';
import { pnpmInvocation } from './commands.mts';

export const DESKTOP_FLOOR_VERSION = '1.125.0';
export const DESKTOP_TEST_LABELS = ['desktop-floor', 'desktop-stable'] as const;

export type DesktopTestLabel = (typeof DESKTOP_TEST_LABELS)[number];

export function isDesktopTestLabel(value: string): value is DesktopTestLabel {
	return DESKTOP_TEST_LABELS.some((label) => label === value);
}

export function desktopTestInvocation(
	label: DesktopTestLabel,
	platform: NodeJS.Platform = process.platform,
	display = process.env.DISPLAY,
): CommandInvocation {
	const args = ['exec', 'vscode-test', '--label', label];
	if (platform === 'linux' && !display) {
		return {
			command: 'xvfb-run',
			args: ['-a', 'pnpm', ...args],
			options: { stdio: 'inherit' },
		};
	}
	return pnpmInvocation(args, platform);
}
