"use strict";
(() => {
  const $=id=>document.getElementById(id),audio=$('tour-audio');
  let bank=null,worker=null,busy=false,recording=false,recorder=null,stream=null,recordTimer=0,choice=null,requestId=0,cancelVersion=0;
  const pending=new Map(),say=text=>$('voice-status').textContent=text;
  const trainingKey='marju-voice-training-v1';let learned=[];
  const trainingState=()=>{
    $('voice-train').disabled=!bank||busy;$('voice-train-command').disabled=!bank||busy;$('voice-train-file').disabled=!bank||busy;$('voice-export-bank').disabled=!bank||busy;
    $('voice-training-list').replaceChildren();
    if(bank)for(const command of bank.commands){const count=learned.filter(item=>item.id===command.id).length;if(count){const item=document.createElement('li');item.textContent=command.phrase+' — '+count+' added example'+(count===1?'':'s');$('voice-training-list').append(item);}}
  };
  const controls=()=>{$('voice-listen').disabled=!bank||busy;$('voice-test-sample').disabled=!bank||busy||!$('voice-sample').value;$('voice-file').disabled=!bank||busy;$('voice-cancel').hidden=!busy;$('voice-open').hidden=!choice;$('voice-listen').textContent=recording?'Listening…':'Listen to my choice';trainingState();};
  const call=(type,extra={})=>new Promise((resolve,reject)=>{const id=++requestId;pending.set(id,{resolve,reject});worker.postMessage({id,type,...extra},extra.samples?[extra.samples.buffer]:[]);});
  const closeMic=()=>{clearTimeout(recordTimer);stream?.getTracks().forEach(track=>track.stop());stream=null;};
  const cancel=()=>{cancelVersion++;if(recorder?.state==='recording')recorder.stop();recorder=null;closeMic();recording=false;busy=false;choice=null;controls();say('Listening cancelled. Microphone is off.');};
  $('voice-cancel').addEventListener('click',cancel);
  const decode=async bytes=>{
    const context=new AudioContext();let decoded;
    try{decoded=await context.decodeAudioData(bytes.slice(0));}finally{await context.close();}
    if(decoded.duration>15||decoded.duration<.1)throw new Error('Use a short recording of one command (up to 15 seconds).');
    const offline=new OfflineAudioContext(1,Math.ceil(decoded.duration*16000),16000),source=offline.createBufferSource();source.buffer=decoded;source.connect(offline.destination);source.start();
    return new Float32Array((await offline.startRendering()).getChannelData(0));
  };
  const recognize=async(bytes,version,commandId=null)=>{
    try{
      say('Comparing your choice with the recorded templates…');
      const samples=await decode(bytes);if(version!==cancelVersion)return;
      if(commandId){
        const result=await call('train',{samples,commandId});if(version!==cancelVersion)return;
        if(learned.length>=200)throw new Error('Training storage limit reached. Export your bank before adding more examples.');
        const template={id:commandId,file:'browser-training-'+Date.now()+'-'+Math.random().toString(16).slice(2)+'.features',frames:result.frames};
        const updated=[...learned,template];
        try{localStorage.setItem(trainingKey,JSON.stringify({scale:bank.scale,templates:updated}));}catch(error){throw new Error('Could not save the example in this browser. Storage may be full or blocked.');}
        learned=updated;bank.templates.push(template);await call('init',{bank});
        const phrase=bank.commands.find(command=>command.id===commandId).phrase;
        $('voice-training-status').textContent='Saved a new example for '+phrase+'. It is now used for recognition.';
        say(bank.templates.length+' matching examples ready. New '+phrase+' example saved.');return;
      }
      const result=await call('recognize',{samples});if(version!==cancelVersion)return;
      $('voice-result').textContent='';choice=null;
      if(result.accepted){choice=bank.commands.find(command=>command.id===result.id);say('Matched: '+choice.phrase+'. Confirm below to use this choice.');$('voice-open').textContent='Use choice: '+choice.phrase;}
      else say('Not sure: '+result.reason+' Please try again or use the saved-narration selector.');
      if(result.alternatives){$('voice-result').textContent='Closest template distances (lower is closer, not confidence percentages): '+result.alternatives.map(item=>(bank.commands.find(c=>c.id===item.id)?.phrase||item.id)+' '+item.score.toFixed(3)).join(' · ');}
    }catch(error){if(version===cancelVersion)say(error.message);}
    finally{if(version===cancelVersion){busy=false;recording=false;closeMic();controls();}}
  };
  const startTask=()=>{audio.pause();document.dispatchEvent(new Event('voice:listen'));choice=null;$('voice-result').textContent='';busy=true;controls();return ++cancelVersion;};
  const record=async(commandId=null)=>{
    if(busy||!bank)return;const version=startTask();
    try{
      if(!isSecureContext||!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw new Error('Microphone input needs HTTPS or localhost and a supported browser. You can test an audio file instead.');
      say('Allow microphone access, then say one command. Recording stops after 5 seconds.');
      const received=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
      if(version!==cancelVersion){received.getTracks().forEach(t=>t.stop());return;}stream=received;
      const chunks=[];recorder=new MediaRecorder(stream);const active=recorder;
      active.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
      active.onerror=()=>{if(version===cancelVersion){cancel();say('Recording failed. Try the audio-file option.');}};
      active.onstop=async()=>{if(version!==cancelVersion)return;closeMic();recording=false;controls();await recognize(await new Blob(chunks,{type:active.mimeType}).arrayBuffer(),version,commandId);};
      active.start();recording=true;controls();say(commandId?'Recording training example for '+bank.commands.find(command=>command.id===commandId).phrase+'. Say only that phrase.':'Listening for 5 seconds. Say one choice, such as education, projects or help.');
      recordTimer=setTimeout(()=>{if(active.state==='recording')active.stop();},5000);
    }catch(error){if(version===cancelVersion){closeMic();busy=false;recording=false;controls();say(error.name==='NotAllowedError'?'Microphone permission was denied. You can still test a file or use the page buttons.':error.message);}}
  };
  $('voice-listen').addEventListener('click',()=>record());
  $('voice-train').addEventListener('click',()=>record($('voice-train-command').value));
  $('voice-train-file').addEventListener('change',async event=>{
    const file=event.target.files[0];if(!file||busy||!bank)return;const commandId=$('voice-train-command').value,version=startTask();
    try{if(file.size>8*1024*1024)throw new Error('Use a file smaller than 8 MB.');await recognize(await file.arrayBuffer(),version,commandId);}
    catch(error){busy=false;controls();say(error.message);}finally{event.target.value='';}
  });
  $('voice-export-bank').addEventListener('click',()=>{
    if(!bank||busy)return;const url=URL.createObjectURL(new Blob([JSON.stringify(bank)],{type:'application/json'})),link=document.createElement('a');
    link.href=url;link.download='command-bank.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    $('voice-training-status').textContent='Exported the updated bank. To publish these examples, replace audio-tour-test/command-bank.json with this file.';
  });
  $('voice-file').addEventListener('change',async event=>{
    const file=event.target.files[0];if(!file||busy)return;const version=startTask();
    if(file.size>8*1024*1024){busy=false;controls();say('Use a file smaller than 8 MB.');return;}
    try{await recognize(await file.arrayBuffer(),version);}finally{event.target.value='';}
  });
  $('voice-test-sample').addEventListener('click',async()=>{
    if(busy||!bank)return;const version=startTask();
    try{const response=await fetch('../voice-tour/audio/commands/'+encodeURIComponent($('voice-sample').value));if(!response.ok)throw new Error('Sample could not load.');await recognize(await response.arrayBuffer(),version);}
    catch(error){if(version===cancelVersion){busy=false;controls();say(error.message);}}
  });
  const routes={'about-me':'about-me','education':'education','projects':'projects','work-experience':'work-experience','skills':'skills','languages':'languages','skovde':'education-skövde','komvux':'komvux','gymnasium':'gymnasium','standalone-courses':'education-courses','goatly':'goatly','mental-model-graph':'mental-model-graph','frog-game':'frog-game','menu':'welcome','help':'help','stop':'goodbye'};
  const history=[];
  $('voice-open').addEventListener('click',()=>{
    if(!choice)return;const id=choice.id,select=$('tour-saved');
    if(id==='repeat'){audio.currentTime=0;audio.play().catch(()=>say('Press Play narration to repeat.'));return;}
    if(id==='back'){const previous=history.pop();if(previous){select.value=previous;select.dispatchEvent(new Event('change'));}else say('Already at the first narration.');return;}
    const route=routes[id];
    if(!route){say('Matched '+choice.phrase+', but its audio-tour narration is not available yet. Use the main CV for this section.');return;}
    const target=route+'.narration.json';if(![...select.options].some(o=>o.value===target)){say('This narration is not available yet.');return;}
    if(id==='stop')audio.pause();else if(select.value!==target)history.push(select.value);
    select.value=target;select.dispatchEvent(new Event('change'));say('Selected '+choice.phrase+'. Press the microphone play button to hear it.');
    choice=null;controls();
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&busy)cancel();});
  audio.addEventListener('play',()=>{if(busy)cancel();});
  window.addEventListener('pagehide',()=>{cancel();worker?.terminate();});
  fetch('command-bank.json').then(async response=>{
    if(!response.ok)throw new Error('Command template bank missing.');bank=await response.json();
    if(bank.schemaVersion!==1||bank.method!=='mfcc-dtw'||!Array.isArray(bank.templates)||!Array.isArray(bank.commands))throw new Error('Unsupported command bank.');
    try{
      const saved=JSON.parse(localStorage.getItem(trainingKey)||'null');
      if(saved&&JSON.stringify(saved.scale)===JSON.stringify(bank.scale)&&Array.isArray(saved.templates)){
        learned=saved.templates.filter(item=>bank.commands.some(c=>c.id===item.id)&&typeof item.file==='string'&&Array.isArray(item.frames)&&item.frames.length>=8&&item.frames.length<=600&&item.frames.every(frame=>Array.isArray(frame)&&frame.length===24&&frame.every(Number.isFinite))).slice(0,200);
        for(const item of learned)if(!bank.templates.some(template=>template.file===item.file))bank.templates.push(item);
        $('voice-training-status').textContent=learned.length+' browser-saved training examples restored.';
      }
    }catch(error){$('voice-training-status').textContent='Browser training storage unavailable. Original templates still work.';}
    worker=new Worker('voice-worker.js?v=training-1');worker.onmessage=event=>{const task=pending.get(event.data.id);if(!task)return;pending.delete(event.data.id);event.data.error?task.reject(new Error(event.data.error)):task.resolve(event.data.result);};
    worker.onerror=()=>{for(const task of pending.values())task.reject(new Error('Recognizer could not run.'));pending.clear();bank=null;controls();say('Recognizer unavailable. Use the saved-narration buttons.');};
    await call('init',{bank});$('voice-sample').replaceChildren();
    $('voice-train-command').replaceChildren();for(const command of bank.commands)$('voice-train-command').append(new Option(command.phrase,command.id));
    $('voice-command-list').replaceChildren();
    for(const command of bank.commands){
      const item=document.createElement('li');
      const note=command.id==='back'?' — previous narration':command.id==='repeat'?' — replay narration':!routes[command.id]?' — recognition available; narration not recorded yet':'';
      item.textContent=command.phrase+note;$('voice-command-list').append(item);
    }
    for(const sample of bank.templates.filter(template=>!template.file.startsWith('browser-training-'))){const command=bank.commands.find(c=>c.id===sample.id);$('voice-sample').append(new Option(command.phrase+' · '+sample.file,sample.file));}
    say(bank.templates.length+' recordings ready for '+bank.commands.length+' commands. Click Listen, or test a short audio file.');controls();
  }).catch(error=>{bank=null;say(error.message);controls();});
  controls();
})();
