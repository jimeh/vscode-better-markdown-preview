import semanticRelease from 'semantic-release';
import releaseConfig from './lib/release-config.mts';
import { releaseOutputs, writeReleaseOutputs } from './lib/release.mts';

const result = await semanticRelease(releaseConfig);
const outputs = await releaseOutputs(result);

if (process.env.GITHUB_OUTPUT) {
	await writeReleaseOutputs(process.env.GITHUB_OUTPUT, outputs);
}

if (outputs.released === 'true') {
	console.log(`Released ${outputs.git_tag}`);
} else {
	console.log('No release-worthy commits found');
}
