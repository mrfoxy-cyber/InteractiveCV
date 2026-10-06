const fs=require('node:fs'), path=require('node:path'), assert=require('node:assert/strict');
const [project, root]=process.argv.slice(2);
const Config=require(path.join(project,'dist/audio-tour-test/tour-config.js'));
const catalogue=JSON.parse(fs.readFileSync(path.join(root,'catalogue.json'),'utf8'));
const audioRoot=path.join(project,'dist/voice-tour/audio/narration');
const audios=fs.readdirSync(audioRoot).filter(name=>name.endsWith('.mp3'));
assert.equal(catalogue.narrations.length,audios.length);
const poses=new Set(['rest',...JSON.parse(fs.readFileSync(path.join(project,'dist/audio-tour-test/anchored-character/mouths/mouth-map.compact.json'),'utf8')).poses.map(p=>p.id)]);
let cues=0;
for(const audio of audios){
 const filename=audio.replace(/\.mp3$/,'.narration.json');
 assert.ok(catalogue.narrations.some(item=>item.file===filename));
 const config=Config.validate(JSON.parse(fs.readFileSync(path.join(root,filename),'utf8')));
 assert.equal(config.mouthTiming.audioFile,audio);assert.equal(config.mouthTiming.mouthOffsetMs,-30);
 assert.ok(config.transcript.trim());assert.equal(decodeURIComponent(config.audio.src.split('/').pop()),audio);
 assert.ok(config.mouthTiming.mouthCues.every(c=>poses.has(c.pose)));
 const saved=path.join(project,'dist/audio-tour-test/narrations',filename);
 if(fs.existsSync(saved)){
  const prior=JSON.parse(fs.readFileSync(saved,'utf8'));prior.mouthTiming.mouthOffsetMs=-30;assert.deepEqual(config,prior);
 }
 cues+=config.mouthTiming.mouthCues.length;
}
console.log(`${audios.length} narrations validated; ${cues} real mouth cues; all offsets -30 ms; existing export data preserved.`);
