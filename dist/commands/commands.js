'use strict';
const $=id=>document.getElementById(id);
let templates=[],token='',busy=false,stream=null,recorder=null,timer=null,cancelled=false,url='',last=null;
function setBusy(value){busy=value;for(const id of ['record','file','refresh'])$(id).disabled=value||!templates.length;}
async function load(){
  setBusy(true);
  try{const status=await fetch('/api/status',{cache:'no-store'}).then(r=>r.json());token=status.token;
    const response=await fetch('/api/blueprints',{cache:'no-store',headers:{'X-Workshop-Token':token}});if(!response.ok)throw Error('Restart the updated local workshop server to load blueprints.');
    const data=await response.json();templates=data.blueprints;
    const library=CommandMatcher.buildReferences(templates);
    $('library-status').textContent=`${library.references.length} command reference blueprints · ${library.references.reduce((s,r)=>s+r.exampleCount,0)} distinct usable recordings. ${library.duplicates} repeated recordings ignored; ${library.skipped+data.skipped} unavailable examples skipped.`;
  }catch(error){$('library-status').textContent=error.message;}
  finally{setBusy(false);$('refresh').disabled=false;}
}
async function decode(blob){
  if(blob.size>8_000_000)throw Error('Choose a file below 8 MB.');
  const context=new AudioContext();let buffer;try{buffer=await context.decodeAudioData(await blob.arrayBuffer());}finally{await context.close();}
  if(buffer.duration<.04||buffer.duration>15)throw Error('Choose 40 ms–15 seconds of audio.');
  const offline=new OfflineAudioContext(1,Math.ceil(buffer.duration*16000),16000),source=offline.createBufferSource();source.buffer=buffer;source.connect(offline.destination);source.start();return (await offline.startRendering()).getChannelData(0).slice();
}
function analyze(samples,config){return new Promise((resolve,reject)=>{
  const worker=new Worker('../chunk-analysis/chunk-worker.js?v=mfcc-1'),timeout=setTimeout(()=>{worker.terminate();reject(Error('Sound analysis timed out.'));},30000);
  worker.onmessage=e=>{clearTimeout(timeout);worker.terminate();if(!e.data.frequency)reject(Error(e.data.error||'No frequency analysis'));else resolve(e.data);};
  worker.onerror=()=>{clearTimeout(timeout);worker.terminate();reject(Error('Could not load the sound analyzer.'));};
  const copy=samples.slice();worker.postMessage({samples:copy,...config},[copy.buffer]);
});}
function wav(samples){const bytes=new ArrayBuffer(44+samples.length*2),v=new DataView(bytes),text=(p,s)=>{for(let i=0;i<s.length;i++)v.setUint8(p+i,s.charCodeAt(i));};
  text(0,'RIFF');v.setUint32(4,bytes.byteLength-8,true);text(8,'WAVE');text(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,16000,true);v.setUint32(28,32000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);text(36,'data');v.setUint32(40,samples.length*2,true);samples.forEach((s,i)=>v.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,s))*(s<0?32768:32767)),true));return bytes;
}
function base64(bytes){let s='';const a=new Uint8Array(bytes);for(let i=0;i<a.length;i+=8192)s+=String.fromCharCode(...a.subarray(i,i+8192));return btoa(s);}
function render(){
  if(!last)return;const {ranked,examples,skipped}=last.matches,threshold=$('threshold').valueAsNumber;
  $('results').replaceChildren();for(const match of ranked.slice(0,10)){const tr=document.createElement('tr');for(const value of [match.name,match.score.toFixed(3),match.orderedDistance.toFixed(3),match.shapeDistance.toFixed(3),match.chunkCount,match.exampleCount]){const td=document.createElement('td');td.textContent=value;tr.append(td);}$('results').append(tr);}
  const best=ranked[0],gap=ranked[1]?ranked[1].score-best.score:Infinity;
  let verdict;if(!Number.isFinite(threshold)||threshold<0||threshold>2)verdict='Enter a cutoff from 0 to 2.';
  else if(!best)verdict='No usable fingerprint to match. Try a clearer recording with some non-Closed chunks.';
  else if(best.score>threshold)verdict=`No close match. Nearest: ${best.name} (${best.score.toFixed(3)}).`;
  else if(gap<.05)verdict=`Uncertain: ${best.name} and ${ranked[1].name} are too close. Please test again.`;
  else verdict=`Possible match: ${best.name} · distance ${best.score.toFixed(3)}. This is an experimental result, not confirmed recognition.`;
  $('verdict').textContent=`${verdict} Compared ${ranked.length} command references built from ${examples} recordings; skipped ${skipped} unavailable examples.`;
  $('json').textContent=JSON.stringify(last.report,null,2);
}
async function run(blob,name){
  if(busy)return;setBusy(true);last=null;$('saved').textContent='';$('verdict').textContent='Comparing…';$('results').replaceChildren();$('json').textContent='Analyzing…';
  try{
    $('status').textContent='Building the test blueprint…';const samples=await decode(blob),configs=new Map();
    const baseline=CommandMatcher.settings;configs.set(CommandMatcher.key(baseline),baseline);
    const queries=new Map();let n=0;
    for(const [key,config]of configs){$('status').textContent=`Analyzing settings ${++n} of ${configs.size}…`;queries.set(key,await analyze(samples,config));}
    const result=queries.get(CommandMatcher.key(baseline)),matches=CommandMatcher.rank(templates,queries),compact=list=>list.map(({db,...c})=>c);
    const report={schemaVersion:1,kind:'command-match-test',label:name,analyzedAt:new Date().toISOString(),source:{kind:'command-match-test'},chunkingMethod:result.method,parameters:result.pattern?.parameters,pattern:result.pattern,
      frequencyAnalysis:{...result.frequency,chunks:compact(result.frequency.chunks),regions:compact(result.frequency.regions)},matching:{algorithm:'One aligned-average reference per command: 0.35 whole MFCC + 0.45 ordered chunk MFCC/type alignment + 0.15 type sequence + 0.05 chunk count',...matches}};
    last={matches,report};render();const audio=wav(samples);if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(new Blob([audio],{type:'audio/wav'}));$('preview').src=url;$('preview').hidden=false;
    $('status').textContent='Matching complete. Listen to your recording and inspect the results.';
    try{const response=await fetch('/api/chunktest',{method:'POST',headers:{'Content-Type':'application/json','X-Workshop-Token':token},body:JSON.stringify({audioBase64:base64(audio),report})});const saved=await response.json();if(!response.ok)throw Error(saved.error||'Save failed');$('saved').textContent=`Test blueprint and sound saved in ${saved.folder}. Not added to the reference library.`;}catch(error){$('saved').textContent='Results are available, but saving failed: '+error.message;}
  }catch(error){$('status').textContent=error.message;$('verdict').textContent='Matching could not complete.';}
  finally{setBusy(false);}
}
function release(){clearTimeout(timer);stream?.getTracks().forEach(t=>t.stop());stream=null;$('finish').hidden=true;$('cancel').hidden=true;}
$('record').onclick=async()=>{
  if(busy)return;setBusy(true);cancelled=false;
  try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});recorder=new MediaRecorder(stream);const pieces=[];
    recorder.ondataavailable=e=>{if(e.data.size)pieces.push(e.data);};recorder.onstop=()=>{const blob=new Blob(pieces,{type:recorder.mimeType});release();setBusy(false);if(!cancelled)run(blob,'Recorded command test');else $('status').textContent='Recording cancelled. Nothing saved.';};
    recorder.onerror=()=>{cancelled=true;release();setBusy(false);$('status').textContent='Recording failed. Please try again.';};
    recorder.start();$('finish').hidden=false;$('cancel').hidden=false;$('status').textContent='Recording… Say your sound, then click Finish, or wait up to 5 seconds.';timer=setTimeout(()=>{if(recorder.state==='recording')recorder.stop();},5000);
  }catch(error){release();setBusy(false);$('status').textContent='Microphone unavailable: '+error.message;}
};
$('finish').onclick=()=>{if(recorder?.state==='recording')recorder.stop();};$('cancel').onclick=()=>{cancelled=true;if(recorder?.state==='recording')recorder.stop();};
$('file').onchange=()=>{const file=$('file').files[0];if(file)run(file,file.name);};$('refresh').onclick=load;$('threshold').oninput=render;
addEventListener('pagehide',()=>{cancelled=true;if(recorder?.state==='recording')recorder.stop();release();$('preview').pause();if(url)URL.revokeObjectURL(url);});load();
