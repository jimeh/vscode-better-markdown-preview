import { rm } from 'node:fs/promises';

const generatedPaths = ['artifacts', 'dist', 'out', '.vscode-test'];

await Promise.all(
	generatedPaths.map((path) => rm(path, { force: true, recursive: true })),
);
