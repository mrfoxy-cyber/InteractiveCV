'use strict';
const $=id=>document.getElementById(id), status=$('analysis-status'), saveStatus=$('save-status');
const soundGraphs=new SoundGraphs();
const pitchLegend=$('chunk-trace-legend').textContent;
const amplitudeType=direction=>({rising:'Raising',falling:'Going down',stable:'Stable'})[direction]||direction;
const chunkLabel=c=>c.chunkType==='closed'?'Closed':current?.report.chunkingMethod==='amplitude'?amplitudeType(c.direction):c.direction;
soundGraphs.onPosition=()=>{if(current)draw(current.report.pattern,current.samples.length/16);};
let graphFrame=0,chunkPlaybackStart=0,chunkPlaybackOffset=0,chunkPlaybackEnd=0;
function stopGraphClock(){cancelAnimationFrame(graphFrame);graphFrame=0;}
function startGraphClock(){stopGraphClock();const tick=()=>{
  if(playbackSource)soundGraphs.position(Math.min(chunkPlaybackEnd,chunkPlaybackOffset+(playbackContext.currentTime-chunkPlaybackStart)*1000));
  else if(!$('preview').paused)soundGraphs.position($('preview').currentTime*1000);
  else return;
  graphFrame=requestAnimationFrame(tick);
};graphFrame=requestAnimationFrame(tick);}
let db, templates=[], busy=false, current=null, reference=null, token='', audioURL='', playbackContext, playbackSource, recorder, stream, recordTimer, cancelled=false;
const controls=['analyze-saved','refresh-saved','sound-file','record-sound','saved-recording','test-label','chunk-method','amplitude-sensitivity','amplitude-dead-zone'];
function settingsValid(){const input=$('amplitude-dead-zone');if($('chunk-method').value==='amplitude'&&(!Number.isFinite(input.valueAsNumber)||input.valueAsNumber<0||input.valueAsNumber>1)){status.textContent='Enter a dead-zone value from 0 to 1, for example 0.1. The previous analysis is unchanged.';input.setAttribute('aria-invalid','true');return false;}input.removeAttribute('aria-invalid');return true;}
function setBusy(value){busy=value;for(const id of controls)$(id).disabled=value; $('keep-reference').disabled=value||!current?.report.pattern||current?.report.chunkingMethod==='amplitude';$('clear-reference').disabled=value; $('play-full').disabled=value||!current; $('play-fft-region').disabled=value||!current?.regions.length; if(!value)$('analyze-saved').disabled=!$('saved-recording').value;}
function request(store,method,key){return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readonly'),r=tx.objectStore(store)[method](key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function loadSaved(){
  try{
    const [model,keys,bank]=await Promise.all([request('models','get','active'),request('clips','getAllKeys'),fetch('../audio-tour-test/command-bank.json').then(r=>{if(!r.ok)throw Error('Cannot load command names.');return r.json();})]);
    const names=new Map([...(bank.commands||[]),...(model?.commands||[])].map(c=>[c.id,c.label||c.name||c.phrase||c.id]));
    templates=(model?.templates||[]).filter(t=>keys.includes(t.file)).sort((a,b)=>Number(b.file.split('-')[2])-Number(a.file.split('-')[2]));
    const select=$('saved-recording');select.replaceChildren();
    select.add(new Option(templates.length?'Choose a saved recording…':'No saved recordings in this browser',''));
    templates.forEach((t,i)=>{const ms=Number(t.file.split('-')[2]);select.add(new Option(`${names.get(t.id)||t.id} · ${Number.isFinite(ms)?new Date(ms).toLocaleString():t.file}`,String(i)));});
    if(templates.length)select.value='0';$('analyze-saved').disabled=busy||!select.value;
  }catch(error){status.textContent='Cannot read saved examples: '+error.message;}
}
async function init(){
  const open=indexedDB.open('marju-command-audio-v1',2);open.onupgradeneeded=()=>{for(const name of ['clips','models'])if(!open.result.objectStoreNames.contains(name))open.result.createObjectStore(name);};
  open.onsuccess=()=>{db=open.result;db.onversionchange=()=>db.close();loadSaved();};
  open.onerror=()=>{status.textContent='Saved recordings are unavailable; choose an audio file instead.';};
  open.onblocked=()=>{status.textContent='Close other workshop tabs and refresh to read saved recordings.';};
  try{await getToken();saveStatus.textContent='Automatic saving ready · recordings stay in the local chunktest folder.';}
  catch(error){saveStatus.textContent=error.message;}
}
async function getToken(){const r=await fetch('/api/status',{cache:'no-store'});if(!r.ok)throw Error('Automatic saving needs the local workshop server.');const data=await r.json();if(!data.chunkTests||!data.blueprintSaving)throw Error('Restart the updated local workshop server to enable automatic saving.');token=data.token;}
async function decode(blob){
  if(blob.size>8_000_000)throw Error('Use a file smaller than 8 MB.');
  const context=new AudioContext();let decoded;
  try{decoded=await context.decodeAudioData(await blob.arrayBuffer());}finally{await context.close();}
  if(decoded.duration<.04||decoded.duration>15)throw Error('Use a recording between 40 ms and 15 seconds.');
  const offline=new OfflineAudioContext(1,Math.ceil(decoded.duration*16000),16000),source=offline.createBufferSource();source.buffer=decoded;source.connect(offline.destination);source.start();return (await offline.startRendering()).getChannelData(0).slice();
}
function wav(samples){const data=new ArrayBuffer(44+samples.length*2),v=new DataView(data),str=(n,s)=>{for(let i=0;i<s.length;i++)v.setUint8(n+i,s.charCodeAt(i));};str(0,'RIFF');v.setUint32(4,data.byteLength-8,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,16000,true);v.setUint32(28,32000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,samples.length*2,true);samples.forEach((s,i)=>v.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,s))*(s<0?32768:32767)),true));return data;}
function analyze(samples){return new Promise((resolve,reject)=>{const worker=new Worker('chunk-worker.js?v=mfcc-1'),timeout=setTimeout(()=>{worker.terminate();reject(Error('Analysis timed out.'));},30000);worker.onmessage=e=>{clearTimeout(timeout);worker.terminate();resolve(e.data);};worker.onerror=()=>{clearTimeout(timeout);worker.terminate();reject(Error('Cannot load sound analyzer. Refresh this page.'));};const copy=samples.slice();worker.postMessage({samples:copy,method:$('chunk-method').value,sensitivity:$('amplitude-sensitivity').value,deadZone:$('chunk-method').value==='amplitude'?$('amplitude-dead-zone').valueAsNumber:0},[copy.buffer]);});}
async function run(blob,source){
  if(!settingsValid())return;
  if(busy)return;setBusy(true);current=null;$('retry-save').hidden=true;stopPlayback();$('preview').pause();soundGraphs.set(null,null,null);$('chunk-rows').replaceChildren();$('pattern-summary').textContent='Analyzing…';$('report-json').textContent='';draw(null,0);saveStatus.textContent='Waiting for analysis…';status.textContent='Reading the recording and measuring pitch and frequencies…';
  try{
    const samples=await decode(blob),result=await analyze(samples),audio=wav(samples);
    current={samples,audio,report:{schemaVersion:1,label:$('test-label').value.trim()||'Untitled sound',source,analyzedAt:new Date().toISOString(),engine:'pitch-chunks-v2-filter3',parameters:{sampleRate:16000,windowMs:40,hopMs:10,minimumChunkFrames:6,pitchJumpSemitones:3.5,lengthTieTolerance:.2,glitchMaximumMs:60,minimumDirectionChangeSemitones:1.2,slopeWindowMs:120,directionPersistenceMs:80},pattern:result.pattern,error:result.error||null}};
    // Keep the saved report bounded: full-recording bins plus per-chunk summaries.
    // Detailed chunk spectra remain in memory for the interactive graphs.
    current.regions=result.frequency?.regions||[];
    current.report.chunkingMethod=result.method;
    if(result.method==='amplitude'){current.report.engine='amplitude-chunks-v1';current.report.parameters=result.pattern?.parameters||{};}
    const compact=regions=>regions.map(({db,...summary})=>summary);
    current.report.frequencyAnalysis=result.frequency?{...result.frequency,chunks:compact(result.frequency.chunks),regions:compact(current.regions)}:null;
    current.report.regions=compact(current.regions);
    soundGraphs.set(samples,result.frequency,result.pattern);
    if(audioURL)URL.revokeObjectURL(audioURL);audioURL=URL.createObjectURL(new Blob([audio],{type:'audio/wav'}));$('preview').src=audioURL;$('preview').hidden=false;
    render();status.textContent=result.error?'Analysis could not find a reliable pitch pattern: '+result.error:'Analysis complete. Listen to each piece below.';
    await save();
  }catch(error){status.textContent=error.message;saveStatus.textContent=current?'Saving failed.':'No report saved — the recording could not be analyzed.';}
  finally{setBusy(false);}
}
function base64(buffer){const bytes=new Uint8Array(buffer);let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);}
async function save(){if(!current)return;const item=current;$('retry-save').hidden=true;saveStatus.textContent='Saving recording and analysis…';
  try{await getToken();const r=await fetch('/api/chunktest',{method:'POST',headers:{'Content-Type':'application/json','X-Workshop-Token':token},body:JSON.stringify({audioBase64:base64(item.audio),report:item.report})});const data=await r.json();if(!r.ok||!data.saved)throw Error(data.error||'The server did not confirm saving.');saveStatus.textContent=`Saved to P:\\Marju\\${data.folder.replaceAll('/','\\')} · analysis.json + recording.wav`+(data.blueprintFolder?` · Blueprint: P:\\Marju\\${data.blueprintFolder.replaceAll('/','\\')} (blueprint.json + recording.wav)`:'');}
  catch(error){saveStatus.textContent='Not saved: '+error.message+' Your current analysis is still here; retry saving it.';$('retry-save').hidden=false;}
}
function render(){const report=current.report,pattern=report.pattern;showComparison();$('report-json').textContent=JSON.stringify(report,null,2);draw(pattern,current.samples.length/16);
  $('chunk-trace-heading').textContent=report.chunkingMethod==='amplitude'?'Type 2 — positive amplitude envelope and boundaries':'Type 1 — pitch trace and boundaries';
  $('chunk-trace-legend').textContent=report.chunkingMethod==='amplitude'?`A1, A2… are regular amplitude chunks. White N1, N2…: Noise chunks (long Stable regions), not registered as regular chunks or Between chunks. Teal: Raising · amber: Going down · blue: Stable. Sensitivity: ${report.parameters.sensitivity}. Dead zone: −${report.parameters.deadZone} to +${report.parameters.deadZone}. Dark line: smoothed positive envelope. Faint line: window-average absolute amplitude after the dead-zone filter. The y axis is amplitude, not Hz.`:pitchLegend;
  const gaps=current.regions.filter(c=>c.type==='between-chunks');
  $('pattern-summary').textContent=`${pattern?.chunks.length||0} ${report.chunkingMethod==='amplitude'?'Type 2 amplitude':'Type 1 pitch'} chunks and ${gaps.length} between-chunk regions (green). `+(pattern?pattern.chunks.map(c=>chunkLabel(c)).join(' → '):'No reliable pitch detected. The entire recording is available as a between-chunks region; this does not mean it is silent.');
  if(report.chunkingMethod==='amplitude')$('pattern-summary').textContent+=`. ${pattern?.noiseChunks.length||0} Noise chunks (white): Stable regions over ${Math.round(current.samples.length/16*.075)} ms, excluded from the regular chunk list.`;
  $('pattern-summary').textContent+=` Closed: ${pattern?.chunks.filter(c=>c.chunkType==='closed').length||0} chunks with average Fourier power below −90 dB. Boundaries and original direction are preserved.`;
  current.regions.forEach((c,i)=>{const isGap=c.type==='between-chunks',name=isGap?`Between ${c.gapIndex+1}`:`Pitch ${c.pitchIndex+1}`;
    const tr=document.createElement('tr');if(isGap){tr.style.background='#29965018';tr.dataset.type='between-chunks';}
    [report.chunkingMethod==='amplitude'&&!isGap?`Amplitude ${c.pitchIndex+1}`:name,isGap?'Between chunks':chunkLabel(c),c.pitchRank??'—',Math.round(c.startMs),Math.round(c.endMs),`${Math.round(c.durationMs)} ms / ${c.lengthRank??'—'}`,isGap?'Outside detected chunks':`${c.boundary} · Fourier average ${c.averageDb.toFixed(1)} dB`,Number.isFinite(c.changeSemitones)?`${c.changeSemitones.toFixed(2)} semitones`:'—'].forEach(value=>{const td=document.createElement('td');td.textContent=value;tr.append(td);});
    const td=document.createElement('td'),button=document.createElement('button');button.textContent='▶ Play';button.setAttribute('aria-label',isGap?`Play between chunks ${c.gapIndex+1}`:`Play chunk ${c.pitchIndex+1}, ${c.direction}`);button.onclick=()=>playChunk(c,i);td.append(button);tr.append(td);$('chunk-rows').append(tr);});
}
function showComparison(){
  const pattern=current?.report.pattern,out=$('comparison-result');
  if(current?.report.chunkingMethod==='amplitude'){out.textContent='Type 2 measures amplitude, not pitch. Switch to Type 1 to compare pitch patterns.';$('keep-reference').disabled=true;return;}
  if(!pattern){out.textContent='No detected pattern to compare.';return;}
  current.report.patternSignature=ChunkComparator.signature(pattern);
  if(!reference){delete current.report.comparison;out.textContent='Keep this pattern as the reference, then analyze another sound.';return;}
  const result=ChunkComparator.compare(reference.pattern,pattern);current.report.comparison={referenceLabel:reference.label,referenceSignature:ChunkComparator.signature(reference.pattern),...result};
  if(!result.sameCount){out.textContent=`Different chunk count: reference ${result.referenceCount}, current ${result.candidateCount}. Ordered comparison stops here.`;return;}
  const types=result.structureMatch?'Chunk types match in order.':'Different types: '+result.typeDifferences.map(d=>`chunk ${d.chunk}: ${d.reference} → ${d.candidate}`).join('; ')+'.';
  const ranks=result.rankMatch===null?'Pitch ranks unavailable for some chunks.':result.rankMatch?'Pitch ranks also match.':'Different pitch ranks: '+result.rankDifferences.map(d=>`chunk ${d.chunk}: ${d.reference} → ${d.candidate}`).join('; ')+'.';
  out.textContent=`Same count (${result.referenceCount}). ${types} ${ranks}`;
}
$('keep-reference').onclick=()=>{if(busy||!current?.report.pattern)return;reference={label:current.report.label,pattern:structuredClone(current.report.pattern)};const signature=ChunkComparator.signature(reference.pattern);$('reference-summary').textContent=`Reference: ${reference.label} · ${signature.count} chunks · `+signature.chunks.map(c=>`${c.type} (rank ${c.pitchRank??'—'})`).join(' → ');$('clear-reference').hidden=false;showComparison();$('report-json').textContent=JSON.stringify(current.report,null,2);};
$('clear-reference').onclick=()=>{if(busy)return;reference=null;$('clear-reference').hidden=true;$('reference-summary').textContent='No reference selected. The reference stays only until this page is refreshed.';showComparison();if(current)$('report-json').textContent=JSON.stringify(current.report,null,2);};
function draw(pattern,duration){const canvas=$('pitch-graph'),ctx=canvas.getContext('2d'),W=canvas.width,H=canvas.height,L=65,R=W-22,T=22,B=H-90;ctx.clearRect(0,0,W,H);ctx.fillStyle='#fffdf9';ctx.fillRect(0,0,W,H);
  if(pattern?.method==='amplitude'){drawAmplitude(pattern,duration,canvas,ctx,L,R,T,B);return;}
  if(duration>0)for(const c of current?.regions||[])if(c.type==='between-chunks'){const x=L+c.startMs/duration*(R-L);ctx.fillStyle='#29965033';ctx.fillRect(x,T,(c.endMs-c.startMs)/duration*(R-L),B-T);ctx.fillStyle='#20783e';ctx.font='12px system-ui';ctx.fillText(`B${c.gapIndex+1}`,x+3,T+15);}
  if(!pattern){ctx.fillStyle='#766450';ctx.font='18px system-ui';ctx.fillText('No reliable pitch trace available',L,60);if(duration>0){const x=L+Math.min(duration,soundGraphs.timeMs)/duration*(R-L);ctx.strokeStyle='#b33237';ctx.beginPath();ctx.moveTo(x,T);ctx.lineTo(x,H-30);ctx.stroke();}canvas.setAttribute('aria-label','No pitch trace available; green regions are outside detected pitch chunks');return;}
  const voiced=pattern.trace.map(f=>f.pitchHz).filter(Number.isFinite),low=Math.max(40,Math.min(...voiced)*.9),high=Math.max(low+30,Math.max(...voiced)*1.1),x=ms=>L+ms/duration*(R-L),y=hz=>B-(hz-low)/(high-low)*(B-T),colors={rising:'#28805a',falling:'#c78325',stable:'#397cb1'};
  pattern.chunks.forEach((c,i)=>{ctx.fillStyle=colors[c.direction]+'22';ctx.fillRect(x(c.startMs),T,x(c.endMs)-x(c.startMs),B-T);ctx.strokeStyle=colors[c.direction];ctx.beginPath();ctx.moveTo(x(c.startMs),T);ctx.lineTo(x(c.startMs),B);ctx.stroke();ctx.fillStyle=colors[c.direction];ctx.font='13px system-ui';ctx.fillText(String(i+1),x(c.startMs)+4,T+15);});
  ctx.font='13px system-ui';for(let i=0;i<=4;i++){const hz=low+(high-low)*i/4;ctx.strokeStyle='#dfd8ce';ctx.beginPath();ctx.moveTo(L,y(hz));ctx.lineTo(R,y(hz));ctx.stroke();ctx.fillStyle='#675a4d';ctx.fillText(Math.round(hz)+' Hz',4,y(hz)+4);}
  for(let i=0;i<=5;i++){const ms=duration*i/5;ctx.fillStyle='#675a4d';ctx.fillText(Math.round(ms)+' ms',Math.min(R-48,x(ms)),H-12);}
  const line=(key,color,width)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();let open=false;for(const f of pattern.trace){if(!Number.isFinite(f[key])){open=false;continue;}if(!open)ctx.moveTo(x(f.timeMs),y(f[key]));else ctx.lineTo(x(f.timeMs),y(f[key]));open=true;}ctx.stroke();};line('rawPitchHz','#beb5a5',1);line('pitchHz','#352c23',2);
  const peak=Math.max(...pattern.trace.map(f=>f.rms),.001);ctx.fillStyle='#a49c8e';pattern.trace.forEach(f=>ctx.fillRect(x(f.timeMs),H-36-f.rms/peak*40,Math.max(1,10/duration*(R-L)),f.rms/peak*40));ctx.fillStyle='#675a4d';ctx.fillText('Energy',4,H-48);canvas.setAttribute('aria-label',`${pattern.chunks.length} pitch chunks over ${Math.round(duration)} milliseconds. Directions and boundaries are listed in the table below.`);
    ctx.strokeStyle='#b33237';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x(Math.max(0,Math.min(duration,soundGraphs.timeMs))),T);ctx.lineTo(x(Math.max(0,Math.min(duration,soundGraphs.timeMs))),H-30);ctx.stroke();ctx.lineWidth=1;
  }
function stopPlayback(){stopGraphClock();if(playbackSource){try{playbackSource.stop();}catch{}playbackSource=null;}}
function drawAmplitude(pattern,duration,canvas,ctx,L,R,T,B){
  const x=ms=>L+ms/duration*(R-L),high=Math.max(.01,pattern.peakAmplitude*1.1),y=a=>B-a/high*(B-T),colors={rising:'#28805a',falling:'#c78325',stable:'#397cb1'};
  for(const [i,c] of (pattern.noiseChunks||[]).entries()){ctx.fillStyle='#ffffff';ctx.fillRect(x(c.startMs),T,x(c.endMs)-x(c.startMs),B-T);ctx.strokeStyle='#d8d2c9';ctx.strokeRect(x(c.startMs),T,x(c.endMs)-x(c.startMs),B-T);ctx.fillStyle='#675a4d';ctx.font='12px system-ui';ctx.fillText(`N${i+1} Noise`,x(c.startMs)+3,T+15);}
  for(const [i,c] of pattern.chunks.entries()){ctx.fillStyle=colors[c.direction]+'22';ctx.fillRect(x(c.startMs),T,x(c.endMs)-x(c.startMs),B-T);ctx.fillStyle=colors[c.direction];ctx.font='12px system-ui';ctx.fillText(`A${i+1}${c.chunkType==='closed'?' Closed':''}`,x(c.startMs)+3,T+15);}
  ctx.font='12px system-ui';for(let i=0;i<=4;i++){const a=high*i/4;ctx.strokeStyle='#dfd8ce';ctx.beginPath();ctx.moveTo(L,y(a));ctx.lineTo(R,y(a));ctx.stroke();ctx.fillStyle='#675a4d';ctx.fillText(a.toFixed(3),5,y(a)+4);}
  for(const [key,color] of [['rawAmplitude','#beb5a5'],['amplitude','#352c23']]){ctx.strokeStyle=color;ctx.beginPath();pattern.trace.forEach((f,i)=>{if(i)ctx.lineTo(x(f.timeMs),y(f[key]));else ctx.moveTo(x(f.timeMs),y(f[key]));});ctx.stroke();}
  for(let i=0;i<=5;i++)ctx.fillText(`${Math.round(duration*i/5)} ms`,Math.min(R-55,x(duration*i/5)),canvas.height-12);
  ctx.fillText('Positive amplitude envelope (not Hz)',L,canvas.height-50);
  ctx.strokeStyle='#b33237';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x(Math.min(duration,soundGraphs.timeMs)),T);ctx.lineTo(x(Math.min(duration,soundGraphs.timeMs)),B);ctx.stroke();ctx.lineWidth=1;
  canvas.setAttribute('aria-label',`Type 2: ${pattern.chunks.length} regular amplitude chunks and ${pattern.noiseChunks?.length||0} white Noise chunks. Positive rectified amplitude with rising, falling and stable sections, not pitch.`);
}
async function playChunk(c,index){try{stopPlayback();$('preview').pause();playbackContext??=new AudioContext();await playbackContext.resume();const buffer=playbackContext.createBuffer(1,current.samples.length,16000);buffer.copyToChannel(current.samples,0);const source=playbackContext.createBufferSource();source.buffer=buffer;source.connect(playbackContext.destination);playbackSource=source;chunkPlaybackStart=playbackContext.currentTime;chunkPlaybackOffset=c.startMs;chunkPlaybackEnd=Math.min(c.endMs,buffer.duration*1000);soundGraphs.position(c.startMs,index);soundGraphs.draw();status.textContent=`Playing ${c.direction}: ${Math.round(c.startMs)}–${Math.round(c.endMs)} ms.`;source.onended=()=>{if(playbackSource===source){playbackSource=null;stopGraphClock();soundGraphs.position(chunkPlaybackEnd);status.textContent='Chunk playback finished.';}};source.start(0,c.startMs/1000,(chunkPlaybackEnd-c.startMs)/1000);startGraphClock();}catch(error){stopPlayback();status.textContent='Playback failed: '+error.message;}}
$('play-full').onclick=async()=>{if(busy||!current)return;const audio=$('preview');if(!audio.paused){audio.pause();return;}try{stopPlayback();audio.currentTime=0;await audio.play();}catch(error){status.textContent='Playback failed: '+error.message;}};
$('play-fft-region').onclick=()=>{if(busy||!current)return;const index=Number($('fft-chunk').value),region=current.regions[index];if(region)playChunk(region,index);};
$('preview').onplay=()=>{stopPlayback();startGraphClock();$('play-full').textContent='Ⅱ Pause recording';status.textContent='Playing full recording.';};
$('preview').onpause=()=>{stopGraphClock();$('play-full').textContent='▶ Play full recording';};
$('preview').ontimeupdate=()=>{if(!playbackSource)soundGraphs.position($('preview').currentTime*1000);};
$('preview').onended=()=>{$('play-full').textContent='▶ Play full recording';status.textContent='Full recording playback finished.';};
$('saved-recording').onchange=()=>{$('analyze-saved').disabled=busy||!$('saved-recording').value;};
$('refresh-saved').onclick=()=>{if(db)loadSaved();};
$('analyze-saved').onclick=async()=>{try{const t=templates[Number($('saved-recording').value)],blob=await request('clips','get',t.file);if(!blob)throw Error('This recording is no longer available. Refresh recordings.');await run(blob,{kind:'training-recording',command:t.id,recordingKey:t.file});}catch(error){status.textContent=error.message;}};
$('sound-file').onchange=()=>{const file=$('sound-file').files[0];if(file)run(file,{kind:'file',filename:file.name});};
function reanalyzeCurrent(){if(busy||!settingsValid())return;if(current){const item=current;run(new Blob([item.audio],{type:'audio/wav'}),item.report.source);}else status.textContent='Settings selected. Choose or record a sound to analyze.';}
$('chunk-method').onchange=()=>{$('amplitude-settings').hidden=$('chunk-method').value!=='amplitude';reanalyzeCurrent();};
$('amplitude-sensitivity').onchange=reanalyzeCurrent;
$('amplitude-dead-zone').onchange=reanalyzeCurrent;
$('amplitude-dead-zone').onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();event.currentTarget.blur();}};
$('retry-save').onclick=async()=>{if(busy)return;setBusy(true);try{await save();}finally{setBusy(false);}};
function cleanRecording(){clearTimeout(recordTimer);stream?.getTracks().forEach(t=>t.stop());stream=null;$('finish-recording').hidden=true;$('cancel-recording').hidden=true;}
$('record-sound').onclick=async()=>{if(busy)return;setBusy(true);cancelled=false;status.textContent='Waiting for microphone permission…';try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});const parts=[];recorder=new MediaRecorder(stream);recorder.ondataavailable=e=>{if(e.data.size)parts.push(e.data);};recorder.onstop=()=>{const type=recorder.mimeType;cleanRecording();setBusy(false);if(cancelled){status.textContent='Recording cancelled. Nothing saved.';return;}run(new Blob(parts,{type}),{kind:'microphone'});};recorder.onerror=()=>{cancelled=true;cleanRecording();setBusy(false);status.textContent='Microphone recording failed.';};recorder.start();status.textContent='Recording for five seconds. Make your sound now.';$('finish-recording').hidden=false;$('cancel-recording').hidden=false;recordTimer=setTimeout(()=>{if(recorder.state==='recording')recorder.stop();},5000);}catch(error){cleanRecording();setBusy(false);status.textContent='Cannot record: '+error.message;}};
$('finish-recording').onclick=()=>{if(recorder?.state==='recording')recorder.stop();};
$('cancel-recording').onclick=()=>{cancelled=true;if(recorder?.state==='recording')recorder.stop();};
window.addEventListener('pagehide',()=>{cancelled=true;cleanRecording();stopPlayback();$('preview').pause();playbackContext?.close();db?.close();if(audioURL)URL.revokeObjectURL(audioURL);});
soundGraphs.set(null,null,null);
init();
