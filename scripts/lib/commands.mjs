export function pnpmInvocation(args, platform = process.platform) {
	return {
		command: 'pnpm',
		args,
		options: {
			shell: platform === 'win32',
			stdio: 'inherit',
		},
	};
}
