import path from 'node:path';

interface PathOperations {
	readonly sep: string;
	isAbsolute(path: string): boolean;
	relative(from: string, to: string): string;
}

export function isPathWithin(
	root: string,
	candidate: string,
	operations: PathOperations = path,
): boolean {
	const relative = operations.relative(root, candidate);
	return (
		relative !== '' &&
		relative !== '..' &&
		!relative.startsWith(`..${operations.sep}`) &&
		!operations.isAbsolute(relative)
	);
}
