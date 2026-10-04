const assert = require('node:assert/strict');
const path = require('node:path');
const {validate, sample} = require(process.argv[2] || path.join(__dirname, '../../dist/character-map/lip-sync-timeline.js'));
const timeline = {schemaVersion:1, audioFile:'welcome.mp3', durationMs:1000, mouthCues:[
  {startMs:0, endMs:100, pose:'rest'}, {startMs:100, endMs:700, pose:'aei'}, {startMs:700, endMs:1000, pose:'u'}
]};
assert.equal(validate(timeline), timeline);
for (const time of [-1,1000,2000,NaN]) assert.equal(sample(timeline,time).pose,'rest');
assert.equal(sample(timeline,99).pose,'rest');
assert.equal(sample(timeline,100).pose,'aei');
assert.equal(sample(timeline,100).mix,0);
assert.equal(sample(timeline,120).mix,.5);
assert.equal(sample(timeline,140).mix,1);
assert.equal(sample(timeline,700).pose,'u');
assert.equal(sample(timeline,500).pose,'aei'); // Seeking backwards doesn't depend on an old cursor.
assert.equal(sample(timeline,999).pose,'u');
for (const tweak of [v=>v.schemaVersion=2, v=>v.audioFile='../private.wav', v=>v.durationMs=600001,
  v=>v.mouthCues[1].startMs=99, v=>v.mouthCues[1].startMs=101, v=>v.mouthCues[1].pose='unknown',
  v=>v.mouthCues[1].endMs=Infinity, v=>v.mouthCues.pop()]) {
  const bad = JSON.parse(JSON.stringify(timeline)); tweak(bad); assert.throws(()=>validate(bad));
}
const short = {schemaVersion:1, audioFile:'short.wav', durationMs:20, mouthCues:[{startMs:0,endMs:20,pose:'o'}]};
assert.equal(sample(validate(short),5).mix,.5);
assert.equal(sample(short,10).mix,1);
console.log('Timeline validation, boundaries, silence, seek-backwards and short-cue transitions passed.');
const delayed = validate({...timeline, mouthOffsetMs:200});
assert.equal(sample(delayed,50).pose,'rest');
assert.equal(sample(delayed,299).pose,'rest');
assert.equal(sample(delayed,300).pose,'aei');
assert.equal(sample(delayed,900).pose,'u');
const early = validate({...timeline, mouthOffsetMs:-200});
assert.equal(sample(early,0).pose,'aei');
assert.equal(sample(early,500).pose,'u');
assert.equal(sample(early,800).pose,'rest');
assert.equal(sample(validate(JSON.parse(JSON.stringify(delayed))),300).pose,'aei');
for (const offset of [NaN,Infinity,'200',null,0.5,5001,-5001]) assert.throws(()=>validate({...timeline,mouthOffsetMs:offset}));
console.log('Positive delay, negative advance, export round-trip, boundaries and invalid offsets passed.');
