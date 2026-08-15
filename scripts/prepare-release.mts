import path from 'node:path';
import { assertSha256, writeSha256 } from './lib/checksum.mts';
import {
	assertPackageInventory,
	assertReleaseChangelog,
	inspectPackage,
} from './lib/package-contract.mts';
import { assertSemanticVersion, packageExtension } from './lib/package.mts';

const version = process.argv[2];
if (!version) {
	throw new Error('Usage: node scripts/prepare-release.mts <version>');
}
assertSemanticVersion(version);

const artifact = await packageExtension(version);
const inspection = await inspectPackage(artifact.path);
assertPackageInventory(inspection, version);
assertReleaseChangelog(inspection, version);

const checksumPath = await writeSha256(artifact.path);
await assertSha256(artifact.path, checksumPath);

console.log(`Prepared ${artifact.path}`);
console.log(`Verified ${path.relative(process.cwd(), checksumPath)}`);
