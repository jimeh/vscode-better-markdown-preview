import { packageExtension } from './lib/package.mts';

const artifact = await packageExtension(process.argv[2]);
console.log(`Packaged ${artifact.path}`);
