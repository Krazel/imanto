import assert from 'node:assert/strict';
import {buildDistribution} from './build-distribution.mjs';

const args = process.argv.slice(2);
assert(args.every(arg => arg === '--upload') && args.length <= 1, 'Only optional --upload is accepted');
// Export/validate by default. Upload never submits App Review or releases the app.
buildDistribution({destination:'app-store', upload:args.includes('--upload'),
  version:process.env.IMANTO_MARKETING_VERSION, build:process.env.IMANTO_BUILD_NUMBER});
