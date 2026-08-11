export function pnpmCommand(platform = process.platform) {
	return platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
}
