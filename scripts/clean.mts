import { rm } from 'node:fs/promises';

const generatedPaths = [
	'artifacts',
	'coverage',
	'dist',
	'out',
	'.vscode-test',
	'.vscode-test-web',
];

await Promise.all(
	generatedPaths.map((path) => rm(path, { force: true, recursive: true })),
);
