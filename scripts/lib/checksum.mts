import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function sha256(pathname: string): Promise<string> {
	return createHash('sha256')
		.update(await readFile(pathname))
		.digest('hex');
}

export async function writeSha256(pathname: string): Promise<string> {
	const checksumPath = `${pathname}.sha256`;
	const digest = await sha256(pathname);
	await writeFile(
		checksumPath,
		`${digest}  ${path.basename(pathname)}\n`,
		'utf8',
	);

	return checksumPath;
}

export async function assertSha256(
	pathname: string,
	checksumPath: string,
): Promise<void> {
	const line = await readFile(checksumPath, 'utf8');
	const expected = `${await sha256(pathname)}  ${path.basename(pathname)}\n`;
	assert.equal(line, expected);
}
