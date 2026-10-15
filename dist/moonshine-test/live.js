const $=id=>document.getElementById(id);
let mic=null,commands=[],ready=false,busy=false,listening=false,version=0;
function controls(){ $('load').disabled=busy||ready;$('start').disabled=busy||!ready||listening||!commands.length;$('stop').disabled=!listening;$('unload').disabled=busy||!ready;$('mic-status').textContent=listening?'Microphone ON — listening locally':'Microphone OFF'; }
function showError(error){$('error').textContent=error?.stack||error?.message||String(error);$('status').textContent='Moonshine error: '+(error?.message||String(error));}
async function stop(){version++;listening=false;controls();try{await mic?.stop();$('status').textContent='Listening stopped. Microphone off.';}catch(e){showError(e);}finally{controls();}}
async function unload(){await stop();mic?.transcriber?.close();mic=null;ready=false;controls();$('status').textContent='Model unloaded. Microphone off.';}
function appendLine(line){if(!listening)return;$('partial').textContent='';$('final').textContent=line.text||'(No text)';const command=globalThis.MoonshineCommands.match(line.text,commands);$('match').textContent=command?`Matched: ${command.phrase} (${command.id})`:'No unambiguous command matched.';$('latency').textContent=Number.isFinite(line.lastTranscriptionLatencyMs)?`Last transcription latency: ${Math.round(line.lastTranscriptionLatencyMs)} ms`:'';if(command?.id==='stop')void stop();}
$('load').onclick=async()=>{busy=true;controls();$('error').textContent='No error.';$('status').textContent='Loading Medium Streaming… This model is larger than Tiny.';const current=version;
  try{if(!crossOriginIsolated)throw Error('The workshop server must send the Moonshine isolation headers. Restart it and refresh.');
    const {MicTranscriber,ModelArch}=await import('https://cdn.jsdelivr.net/npm/@moonshine-ai/moonshine-wasm@0.1.5/dist/index.js');
    const candidate=new MicTranscriber().modelArch(ModelArch.MediumStreaming)
      .onProgress(fraction=>{if(current===version&&Number.isFinite(fraction))$('status').textContent=`Downloading Medium model: ${Math.round(Math.max(0,Math.min(1,fraction))*100)}%`;})
      .onText(text=>{if(listening)$('partial').textContent=text;})
      .onLine(appendLine)
      .onError(error=>{showError(error);void stop();});
    await candidate.load();if(current!==version){candidate.transcriber?.close();return;}mic=candidate;ready=true;$('status').textContent='Medium Streaming ready. Microphone off. Click Start listening.';
  }catch(e){showError(e);}finally{busy=false;controls();}
};
$('start').onclick=async()=>{busy=true;const current=version;listening=true;controls();$('status').textContent='Opening microphone…';try{await mic.start();if(current!==version){await mic.stop();return;}$('status').textContent='Listening locally. Speak a command, then pause.';}catch(e){listening=false;await mic?.stop().catch(()=>{});showError(e);}finally{busy=false;controls();}};
$('stop').onclick=stop;$('unload').onclick=unload;
document.addEventListener('visibilitychange',()=>{if(document.hidden)void stop();});addEventListener('pagehide',()=>{void stop();});
fetch('../audio-tour-v2/commands.json').then(r=>{if(!r.ok)throw Error('Cannot load command mappings.');return r.json();}).then(data=>{commands=data.commands;$('commands').textContent=commands.map(c=>c.phrase).join(' · ');controls();}).catch(showError);controls();
