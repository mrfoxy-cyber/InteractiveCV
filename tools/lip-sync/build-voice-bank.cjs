const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const [project,pcmRoot,output]=process.argv.slice(2);
const Matcher=require(path.join(project,'dist/audio-tour-test/voice-matcher.js'));
const plan=JSON.parse(fs.readFileSync(path.join(project,'dist/voice-tour/voice-tour.templates.json'),'utf8'));
const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const takes=JSON.parse(fs.readFileSync(path.join(pcmRoot,'files.json'),'utf8')).map(item=>{
 const match=/^(.*)-(\d+)\.mp3$/.exec(item.file);let id=normalize(match[1]);if(id==='gymnaisum')id='gymnasium';
 assert.ok(plan.commands.some(c=>c.id===id),'Unknown command '+id);
 const buffer=fs.readFileSync(path.join(pcmRoot,item.pcm));const input=Float32Array.from({length:buffer.length/4},(_,i)=>buffer.readFloatLE(i*4));
 return {...item,id,take:Number(match[2]),frames:Matcher.features(input)};
});
const includeAll=process.argv.includes('--all');
const training=includeAll?takes:takes.filter(t=>t.take<=2),held=includeAll?takes:takes.filter(t=>t.take>2),dims=24,mean=Array(dims).fill(0),std=Array(dims).fill(0);let count=0;
for(const take of training)for(const frame of take.frames){count++;frame.forEach((v,i)=>mean[i]+=v);}
mean.forEach((v,i)=>mean[i]=v/count);
for(const take of training)for(const frame of take.frames)frame.forEach((v,i)=>std[i]+=(v-mean[i])**2);
std.forEach((v,i)=>std[i]=Math.max(.1,Math.sqrt(v/count)));
const round=x=>Math.round(x*1000)/1000;
const bank={schemaVersion:1,method:'mfcc-dtw',sampleRate:16000,description:includeAll?'All recorded takes are reference templates. Requires new visitor recordings for independent testing.':'Training takes 1–2; takes 3+ held out. Not validated for arbitrary speakers.',scale:{mean,std},minMargin:.08,maxDistance:1.2,thresholds:{},commands:plan.commands.map(({id,phrase})=>({id,phrase})),templates:training.map(t=>({id:t.id,file:t.file,frames:Matcher.normalize(t.frames,{mean,std}).map(f=>f.map(round))}))};
// Set each radius using only training-to-training distances, not held-out takes.
for(const command of bank.commands){const group=bank.templates.filter(t=>t.id===command.id);assert.ok(group.length>=2);const pairs=[];for(let i=0;i<group.length;i++)for(let j=i+1;j<group.length;j++)pairs.push(Matcher.distance(group[i].frames,group[j].frames));pairs.sort((a,b)=>a-b);const within=pairs[Math.floor(pairs.length/2)];bank.thresholds[command.id]=round(Math.min(1.35,Math.max(.6,within*1.7)));}
const tests=held.map(t=>({file:t.file,expected:t.id,...Matcher.recognize(t.frames,bank)}));
const report={testType:includeAll?'in-sample reference checks, not independent accuracy':'held-out recordings',training:training.length,heldOut:includeAll?0:held.length,checked:held.length,acceptedCorrect:tests.filter(t=>t.accepted&&t.id===t.expected).length,rejected:tests.filter(t=>!t.accepted).length,acceptedWrong:tests.filter(t=>t.accepted&&t.id!==t.expected).length,tests};
assert.throws(()=>Matcher.features(new Float32Array(16000)));
fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'command-bank.json'),JSON.stringify(bank));fs.writeFileSync(path.join(output,'recognition-test-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({commands:bank.commands.length,training:report.training,heldOut:report.heldOut,acceptedCorrect:report.acceptedCorrect,rejected:report.rejected,acceptedWrong:report.acceptedWrong}));
