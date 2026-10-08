'use strict';
// Usage: node import-command-audio.cjs PROJECT_ROOT DECODED_WAV_FOLDER
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const project=path.resolve(process.argv[2]||''),input=path.resolve(process.argv[3]||'');
if(!process.argv[2]||!process.argv[3]||!fs.existsSync(path.join(project,'dist','chunk-analysis')))throw Error('Supply project and decoded WAV folder.');
const engine=path.join(project,'dist','chunk-analysis');
for(const name of ['mel-analysis.js','mfcc-analysis.js','frequency-analysis.js','amplitude-chunks.js'])require(path.join(engine,name));
require(path.join(project,'dist','commands','command-matcher.js'));
const settings=CommandMatcher.settings;
function decode(bytes){let fmt,data;for(let i=12;i+8<=bytes.length;){const n=bytes.readUInt32LE(i+4),start=i+8;if(start+n>bytes.length)throw Error('Incomplete WAV');const id=bytes.toString('ascii',i,i+4);if(id==='fmt ')fmt=bytes.subarray(start,start+n);if(id==='data')data=bytes.subarray(start,start+n);i=start+n+n%2;}
  if(!fmt||!data||fmt.readUInt16LE(0)!==1||fmt.readUInt16LE(2)!==1||fmt.readUInt32LE(4)!==16000||fmt.readUInt16LE(14)!==16)throw Error('Expected mono PCM16 16kHz');return Float32Array.from({length:data.length/2},(_,i)=>data.readInt16LE(i*2)/32768);}
const root=path.join(project,'commands','blueprints');let saved=0;const templates=[];
for(const file of fs.readdirSync(input).filter(f=>f.endsWith('.wav')).sort()){
  const stem=path.basename(file,'.wav'),name=stem.replace(/-\d+$/,'').replace(/^gymnaisum$/,'gymnasium'),audio=fs.readFileSync(path.join(input,file)),samples=decode(audio);
  const sourceFile='dist/voice-tour/audio/commands/'+stem+'.mp3';
  if(!fs.existsSync(path.join(project,sourceFile)))throw Error('Missing original '+sourceFile);
  const pattern=AmplitudeChunks.analyze(samples,settings.sensitivity,settings.deadZone),frequency=FrequencyAnalysis.analyze(samples,pattern.chunks,pattern.noiseChunks);
  for(const c of frequency.chunks)Object.assign(pattern.chunks[c.pitchIndex],{chunkType:c.chunkType,averageFourierDb:c.averageDb});
  const analysis={audioHash:crypto.createHash('sha256').update(audio).digest('hex'),chunkingMethod:'amplitude',parameters:pattern.parameters,chunks:pattern.chunks,noiseChunks:pattern.noiseChunks,recordingFingerprint:frequency.mfcc.recordingFingerprint,regionFingerprints:frequency.mfcc.chunks};
  const slug=stem.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_-]+/gi,'-'),id='command-audio-'+slug,folder=path.join(root,id);
  const blueprint={schemaVersion:1,kind:'sound-blueprint',name,audioFile:'recording.wav',durationMs:samples.length/16,...analysis,normalizedBlueprint:analysis,source:{kind:'command-audio',file:sourceFile},analyzedAt:new Date().toISOString()};
  if(fs.existsSync(folder)&&JSON.parse(fs.readFileSync(path.join(folder,'blueprint.json'),'utf8')).source?.file!==sourceFile)throw Error('Refusing to overwrite unrelated blueprint '+id);
  fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,'recording.wav'),audio);fs.writeFileSync(path.join(folder,'blueprint.json'),JSON.stringify(blueprint,null,2));templates.push({...blueprint,id});saved++;
}
const library=CommandMatcher.buildReferences(templates),references=path.join(project,'commands','references');fs.mkdirSync(references,{recursive:true});
for(const ref of library.references){const slug=ref.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_-]+/gi,'-');fs.writeFileSync(path.join(references,slug+'.json'),JSON.stringify(ref,null,2));}
console.log(JSON.stringify({saved,settings,references:library.references.map(r=>({name:r.name,examples:r.exampleCount,chunks:r.chunks.length})),skipped:library.skipped,duplicates:library.duplicates}));
