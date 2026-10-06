const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = process.argv[2] || __dirname;
const Config = require(path.join(root,'tour-config.js'));
const timeline={schemaVersion:1,audioFile:'welcome.mp3',durationMs:1000,mouthOffsetMs:-100,mouthCues:[{startMs:0,endMs:500,pose:'aei'},{startMs:500,endMs:1000,pose:'rest'}]};
const value=Config.create({filename:'welcome.mp3',title:'Welcome',transcript:'Hello!',timeline,blink:false,hair:true});
assert.equal(Config.validate(JSON.parse(JSON.stringify(value))).mouthTiming.mouthOffsetMs,-100);
assert.equal(value.animations.blink.enabled,false);
for(const mutate of [v=>v.audio.src='https://other.example/a.mp3',v=>v.character='javascript:alert(1)',v=>v.animations.blink.cycleMs=50,v=>v.mouthTiming.mouthCues[0].pose='unknown',v=>v.audio.src='other.mp3']){const copy=structuredClone(value);mutate(copy);assert.throws(()=>Config.validate(copy));}
Config.validate({...value,mouthTiming:null});
console.log('Narration export round-trip, offset, settings, invalid paths, timing and blink cycles passed.');
