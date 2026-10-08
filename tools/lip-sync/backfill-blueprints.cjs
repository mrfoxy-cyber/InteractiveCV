'use strict';
// Run with the project root as an explicit argument. Existing blueprints are kept.
const fs=require('node:fs'),path=require('node:path');
const project=path.resolve(process.argv[2]||'');
if(!process.argv[2]||!fs.existsSync(path.join(project,'dist','chunk-analysis')))throw Error('Supply the CV project root.');
const engine=path.join(project,'dist','chunk-analysis');
require(path.join(engine,'mel-analysis.js'));require(path.join(engine,'mfcc-analysis.js'));require(path.join(engine,'frequency-analysis.js'));
const F=globalThis.FrequencyAnalysis;
function decodeWav(bytes){
  if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WAVE')throw Error('Not WAV');
  let format=null,audio=null;
  for(let offset=12;offset+8<=bytes.length;){const id=bytes.toString('ascii',offset,offset+4),length=bytes.readUInt32LE(offset+4),start=offset+8;
    if(start+length>bytes.length)throw Error('Incomplete WAV');
    if(id==='fmt ')format=bytes.subarray(start,start+length);
    if(id==='data')audio=bytes.subarray(start,start+length);
    offset=start+length+(length%2);
  }
  if(!format||!audio||format.readUInt16LE(0)!==1||format.readUInt16LE(2)!==1||format.readUInt32LE(4)!==16000||format.readUInt16LE(14)!==16)throw Error('Expected mono 16 kHz PCM16');
  return Float32Array.from({length:audio.length/2},(_,i)=>audio.readInt16LE(i*2)/32768);
}
function findReports(folder){if(!fs.existsSync(folder))return [];return fs.readdirSync(folder,{withFileTypes:true}).flatMap(item=>item.isDirectory()?findReports(path.join(folder,item.name)):/^(analysis|pattern)\.json$/.test(item.name)?[path.join(folder,item.name)]:[]);}
let saved=0,kept=0;const failures=[];
for(const file of [...findReports(path.join(project,'chunktest')),...findReports(path.join(project,'voice-commands'))]){
  try{
    const report=JSON.parse(fs.readFileSync(file,'utf8')); if(report.kind==='command-match-test'){kept++;continue;} const source=report.source||{},label=source.command||report.commandId||report.label||'sound';
    const slug=String(label).toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80)||'sound';
    const id=path.basename(path.dirname(file)),folder=path.join(project,'commands','blueprints',slug+'-'+id);
    if(fs.existsSync(folder)){kept++;continue;}
    const audioPath=path.join(path.dirname(file),'recording.wav'),audio=fs.readFileSync(audioPath),samples=decodeWav(audio);
    const pattern=report.pattern||{chunks:(report.chunks||[]).map(c=>({...c,direction:c.type}))};
    const frequency=F.analyze(samples,pattern.chunks||[],pattern.noiseChunks||[]),mfcc=frequency.mfcc;
    const chunks=(pattern.chunks||[]).map((c,i)=>({...c,chunkType:frequency.chunks[i]?.chunkType||c.direction,averageFourierDb:frequency.chunks[i]?.averageDb??null}));
    const blueprint={schemaVersion:1,kind:'sound-blueprint',name:label,audioFile:'recording.wav',durationMs:samples.length/16,
      chunkingMethod:report.chunkingMethod||'pitch',parameters:report.parameters||{},chunks,chunkCount:chunks.length,noiseChunks:pattern.noiseChunks||[],
      mfccMethod:mfcc.method,fingerprintDefinition:mfcc.fingerprintDefinition,recordingScope:mfcc.recordingScope,
      recordingFingerprint:mfcc.recordingFingerprint,regionFingerprints:mfcc.chunks,source,analyzedAt:report.analyzedAt,
      sourceReport:path.relative(project,file).replaceAll('\\','/'),note:'Existing chunk boundaries retained; MFCCs recalculated from the saved WAV.'};
    fs.mkdirSync(folder,{recursive:true});fs.copyFileSync(audioPath,path.join(folder,'recording.wav'));
    fs.writeFileSync(path.join(folder,'blueprint.json'),JSON.stringify(blueprint,null,2));saved++;
  }catch(error){failures.push({file:path.relative(project,file),error:error.message});}
}
console.log(JSON.stringify({saved,kept,failures}));if(failures.length)process.exitCode=1;
