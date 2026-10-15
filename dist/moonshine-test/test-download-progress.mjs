import assert from 'node:assert/strict';
import {downloadProgress} from './download-progress.mjs';
assert.equal(downloadProgress(42866368,85732736).percent,50);
assert.equal(downloadProgress(42866368,42866368).percent,100);
assert.equal(downloadProgress(42866368,100).percent,100);
assert.equal(downloadProgress(-1,100).percent,0);
assert.equal(downloadProgress(42866368,undefined).label,'Downloading model: 42.9 MB received');
assert.equal(downloadProgress(NaN,0).percent,null);
console.log('PASS: byte-count percentages, bounded display and unknown-total fallback');
