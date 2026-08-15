import { spawn } from 'node:child_process';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pnpmInvocation } from './commands.mts';

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));
const semanticVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const extensionIdentifierPattern = /^[a-z0-9][a-z0-9-]*$/i;

interface ExtensionManifest {
	name: string;
	publisher: string;
	version: string;
}

export interface PackageArtifact {
	filename: string;
	path: string;
	version: string;
}

export function assertSemanticVersion(version: string): void {
	if (!semanticVersionPattern.test(version)) {
		throw new Error(`Expected a stable semantic version, received: ${version}`);
	}
}

export function packageFilename(
	publisher: string,
	name: string,
	version: string,
): string {
	if (
		!extensionIdentifierPattern.test(publisher) ||
		!extensionIdentifierPattern.test(name)
	) {
		throw new Error('Extension publisher and name must be safe identifiers');
	}
	assertSemanticVersion(version);

	return `${publisher}.${name}-${version}.vsix`;
}

async function readManifest(): Promise<ExtensionManifest> {
	const manifest = JSON.parse(
		await readFile(path.join(repositoryRoot, 'package.json'), 'utf8'),
	) as Partial<ExtensionManifest>;

	if (!manifest.name || !manifest.publisher || !manifest.version) {
		throw new Error(
			'Extension manifest is missing name, publisher, or version',
		);
	}

	return manifest as ExtensionManifest;
}

async function runVsce(args: readonly string[]): Promise<void> {
	const invocation = pnpmInvocation(['exec', 'vsce', ...args]);

	await new Promise<void>((resolve, reject) => {
		const child = spawn(invocation.command, invocation.args, {
			...invocation.options,
			cwd: repositoryRoot,
		});

		child.once('error', (error) => {
			reject(new Error(`Failed to package extension: ${error.message}`));
		});
		child.once('exit', (code, signal) => {
			if (signal) {
				reject(new Error(`Extension packaging exited after signal ${signal}`));
				return;
			}
			if (code !== 0) {
				reject(new Error(`Extension packaging exited with code ${code ?? 1}`));
				return;
			}

			resolve();
		});
	});
}

export async function packageExtension(
	explicitVersion?: string,
): Promise<PackageArtifact> {
	const manifest = await readManifest();
	const version = explicitVersion ?? manifest.version;
	const filename = packageFilename(manifest.publisher, manifest.name, version);
	const artifactDirectory = path.join(repositoryRoot, 'artifacts');
	const artifactPath = path.join(artifactDirectory, filename);

	await mkdir(artifactDirectory, { recursive: true });
	await rm(artifactPath, { force: true });
	await rm(`${artifactPath}.sha256`, { force: true });

	const versionArgument = explicitVersion
		? [explicitVersion, '--no-git-tag-version', '--no-update-package-json']
		: [];
	await runVsce([
		'package',
		...versionArgument,
		'--no-dependencies',
		'--out',
		artifactPath,
	]);

	return {
		filename,
		path: path.relative(repositoryRoot, artifactPath),
		version,
	};
}
