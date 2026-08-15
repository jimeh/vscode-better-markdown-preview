import { appendFile } from 'node:fs/promises';
import type { Result } from 'semantic-release';
import { packageFilename } from './package.mts';

export interface ReleaseOutputs {
	released: 'false' | 'true';
	version: string;
	git_tag: string;
	vsix_path: string;
	checksum_path: string;
}

export function releaseOutputs(result: Result): ReleaseOutputs {
	if (!result) {
		return {
			released: 'false',
			version: '',
			git_tag: '',
			vsix_path: '',
			checksum_path: '',
		};
	}

	const filename = packageFilename(
		'jimeh',
		'better-markdown-preview',
		result.nextRelease.version,
	);
	const vsixPath = `artifacts/${filename}`;

	return {
		released: 'true',
		version: result.nextRelease.version,
		git_tag: result.nextRelease.gitTag,
		vsix_path: vsixPath,
		checksum_path: `${vsixPath}.sha256`,
	};
}

export async function writeReleaseOutputs(
	outputPath: string,
	outputs: ReleaseOutputs,
): Promise<void> {
	const lines = Object.entries(outputs)
		.map(([name, value]) => `${name}=${value}`)
		.join('\n');
	await appendFile(outputPath, `${lines}\n`, 'utf8');
}
