'use strict';
// Keep historic data intact. Add a consistent analysis for command references.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const project=path.resolve(process.argv[2]||'');
if(!process.argv[2]||!fs.existsSync(path.join(project,'dist','chunk-analysis')))throw Error('Supply the CV project root.');
const engine=path.join(project,'dist','chunk-analysis');
for(const name of ['mel-analysis.js','mfcc-analysis.js','frequency-analysis.js','amplitude-chunks.js'])require(path.join(engine,name));
require(path.join(project,'dist','commands','command-matcher.js'));
const settings=CommandMatcher.settings;
function decode(bytes){let fmt,data;for(let i=12;i+8<=bytes.length;){const n=bytes.readUInt32LE(i+4),start=i+8;if(start+n>bytes.length)throw Error('Invalid WAV');const id=bytes.toString('ascii',i,i+4);if(id==='fmt ')fmt=bytes.subarray(start,start+n);if(id==='data')data=bytes.subarray(start,start+n);i=start+n+n%2;}
  if(!fmt||!data||fmt.readUInt16LE(0)!==1||fmt.readUInt16LE(2)!==1||fmt.readUInt32LE(4)!==16000||fmt.readUInt16LE(14)!==16)throw Error('Expected PCM16 mono 16kHz');return Float32Array.from({length:data.length/2},(_,i)=>data.readInt16LE(i*2)/32768);}
const folder=path.join(project,'commands','blueprints'),cache=new Map();let updated=0;
for(const entry of fs.readdirSync(folder,{withFileTypes:true}).filter(e=>e.isDirectory())){
  const dir=path.join(folder,entry.name),file=path.join(dir,'blueprint.json'),b=JSON.parse(fs.readFileSync(file,'utf8')),bytes=fs.readFileSync(path.join(dir,'recording.wav')),hash=crypto.createHash('sha256').update(bytes).digest('hex');
  if(!cache.has(hash)){const samples=decode(bytes),pattern=AmplitudeChunks.analyze(samples,settings.sensitivity,settings.deadZone),f=FrequencyAnalysis.analyze(samples,pattern.chunks,pattern.noiseChunks);
    for(const c of f.chunks)Object.assign(pattern.chunks[c.pitchIndex],{chunkType:c.chunkType,averageFourierDb:c.averageDb});
    cache.set(hash,{audioHash:hash,chunkingMethod:'amplitude',parameters:pattern.parameters,chunks:pattern.chunks,noiseChunks:pattern.noiseChunks,recordingFingerprint:f.mfcc.recordingFingerprint,regionFingerprints:f.mfcc.chunks});}
  b.normalizedBlueprint=cache.get(hash);fs.writeFileSync(file,JSON.stringify(b,null,2));updated++;
}
const templates=fs.readdirSync(folder,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>({...JSON.parse(fs.readFileSync(path.join(folder,e.name,'blueprint.json'),'utf8')),id:e.name}));
const library=CommandMatcher.buildReferences(templates);
fs.mkdirSync(path.join(project,'commands','references'),{recursive:true});
for(const ref of library.references){const slug=ref.name.replace(/[^a-z0-9_-]+/gi,'-');fs.writeFileSync(path.join(project,'commands','references',slug+'.json'),JSON.stringify(ref,null,2));}
console.log(JSON.stringify({updated,uniqueRecordings:cache.size,references:library.references.map(r=>({name:r.name,examples:r.exampleCount,chunks:r.chunks.length})),skipped:library.skipped,duplicates:library.duplicates}));
