import {buildDistribution} from './build-distribution.mjs';

// Existing beta workflow: a new archive, always official Google demo units.
buildDistribution({destination:'testflight', upload:true});
