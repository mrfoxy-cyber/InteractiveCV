"use strict";
(() => {
  const $=id=>document.getElementById(id),audio=$('tour-audio');
  let bank=null,worker=null,busy=false,recording=false,recorder=null,stream=null,recordTimer=0,choice=null,requestId=0,cancelVersion=0;
  const pending=new Map(),say=text=>$('voice-status').textContent=text;
  const BrowserRecognizer=window.SpeechRecognition||window.webkitSpeechRecognition;
  const localSpeechSupported=SpeechCommands.supportsLocal(BrowserRecognizer);
  let speechSession=null;
  const trainingKey='marju-voice-training-v1';let learned=[],customCommands=[];
  const saveCommand=async(pattern,samples,commandId)=>{
    const report=ChunkExport.create(pattern,{commandId,commandLabel:bank.commands.find(c=>c.id===commandId)?.phrase,source:'training'});
    const bytes=new ArrayBuffer(44+samples.length*2),view=new DataView(bytes),word=(offset,text)=>{for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i));};
    word(0,'RIFF');view.setUint32(4,bytes.byteLength-8,true);word(8,'WAVE');word(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,16000,true);view.setUint32(28,32000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);word(36,'data');view.setUint32(40,samples.length*2,true);samples.forEach((sample,i)=>view.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,sample))*(sample<0?32768:32767)),true));
    let binary='';const data=new Uint8Array(bytes);for(let i=0;i<data.length;i+=8192)binary+=String.fromCharCode(...data.subarray(i,i+8192));
    const response=await fetch('/api/status',{cache:'no-store'});if(!response.ok)throw new Error('Project saving needs the local workshop server.');const info=await response.json();if(!info.commandSaving)throw new Error('Restart the updated local server to save command recordings.');
    const saved=await fetch('/api/command-sample',{method:'POST',headers:{'Content-Type':'application/json','X-Workshop-Token':info.token},body:JSON.stringify({report,audioBase64:btoa(binary)})});const result=await saved.json();if(!saved.ok||!result.saved)throw new Error(result.error||'Project saving failed.');
    $('voice-project-save-status').textContent='Saved to P:\\Marju\\'+result.folder.replaceAll('/','\\')+' · pattern.json + recording.wav';
  };
  const groups={main:['about-me','education','projects','work-experience','skills','languages'],education:['skovde','tartu','lexicon','komvux','gymnasium','standalone-courses','back','repeat'],projects:['goatly','mental-model-graph','frog-game','back','repeat'],languages:['estonian','english','swedish','german','back','repeat'],section:['back','repeat']};
  const globalCommands=['help','menu','stop'];
  const activeCommands=()=>bank.commands.filter(command=>{
    const group=$('voice-group').value,action=command.actionId||command.id;
    return group==='all'||globalCommands.includes(action)||(group==='custom'?!!command.actionId:groups[group]?.includes(action));
  });
  let clipKeys=new Set(),samplePlayer=null,sampleUrl=null;
  const sampleDB=new Promise((resolve,reject)=>{const request=indexedDB.open('marju-command-audio-v1',2);request.onupgradeneeded=()=>{for(const name of ['clips','models'])if(!request.result.objectStoreNames.contains(name))request.result.createObjectStore(name);};request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();resolve(request.result);};request.onerror=()=>reject(new Error('Browser recording storage is unavailable.'));request.onblocked=()=>say('Close other audio-tour tabs, then reload to upgrade learning storage.');});
  sampleDB.catch(()=>{});
  const clipStore=async(mode,operation,storeName='clips')=>{const db=await sampleDB;return new Promise((resolve,reject)=>{const transaction=db.transaction(storeName,mode),request=operation(transaction.objectStore(storeName));let result;request.onsuccess=()=>result=request.result;transaction.oncomplete=()=>resolve(result);transaction.onabort=transaction.onerror=()=>reject(new Error('Could not save or load browser learning data. Storage may be full or blocked.'));});};
  const stopSample=()=>{samplePlayer?.pause();samplePlayer=null;if(sampleUrl)URL.revokeObjectURL(sampleUrl);sampleUrl=null;};
  const playSample=async command=>{
    const template=[...bank.templates].reverse().find(item=>item.id===command.id&&clipKeys.has(item.file));
    if(!template){say('Record an example for '+command.phrase+' first.');return;}
    if(busy)cancel();audio.pause();stopSample();
    try{const blob=await clipStore('readonly',store=>store.get(template.file));if(!blob)throw new Error('Command recording is missing. Please record another example.');sampleUrl=URL.createObjectURL(blob);samplePlayer=new Audio(sampleUrl);samplePlayer.onended=stopSample;samplePlayer.onerror=()=>{stopSample();say('Could not play this command recording.');};await samplePlayer.play();say('Playing your recorded command: '+command.phrase+'.');}
    catch(error){stopSample();say(error.message);}
  };
  const persistTraining=(templates=learned,commands=customCommands)=>clipStore('readwrite',store=>store.put({epoch:bank.trainingEpoch,scale:bank.scale,templates,commands},'active'),'models');
  const trainingState=()=>{
    $('voice-save-choice').disabled=!bank||!worker||busy;$('voice-train-command').disabled=!bank||busy;
    $('voice-retrain').disabled=!bank||!worker||busy||!bank.templates.length;
    $('voice-install-language').disabled=busy||!localSpeechSupported;
    $('voice-browser-notice').hidden=$('voice-recognition-mode').value!=='browser';
    $('voice-group').disabled=!bank||busy;
    $('voice-recognition-mode').disabled=!bank||busy;
    $('voice-custom-add').disabled=!bank||busy;$('voice-custom-action').disabled=!bank||busy;$('voice-custom-name').disabled=!bank||busy;
    $('voice-training-list').replaceChildren();
    if(bank)for(const command of bank.commands){const count=learned.filter(item=>item.id===command.id).length;if(count){const item=document.createElement('li');item.textContent=command.phrase+' — '+count+' added example'+(count===1?'':'s');$('voice-training-list').append(item);}}
  };
  const controls=()=>{$('voice-listen').disabled=!bank||busy||($('voice-recognition-mode').value!=='browser'&&!worker);$('voice-cancel').hidden=!busy;$('voice-open').hidden=!choice;$('voice-listen').textContent=recording?'Listening…':'Listen to my choice';trainingState();};
  const call=(type,extra={})=>new Promise((resolve,reject)=>{const id=++requestId;pending.set(id,{resolve,reject});worker.postMessage({id,type,...extra},extra.samples?[extra.samples.buffer]:[]);});
  const closeMic=()=>{clearTimeout(recordTimer);stream?.getTracks().forEach(track=>track.stop());stream=null;};
  const cancel=()=>{cancelVersion++;speechSession?.cancel();speechSession=null;if(recorder?.state==='recording')recorder.stop();recorder=null;closeMic();recording=false;busy=false;choice=null;controls();say('Listening cancelled. Microphone is off.');};
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
      say(commandId?'Learning the selected command…':'Comparing your choice with the recorded templates…');
      const samples=await decode(bytes);if(version!==cancelVersion)return;
      if(commandId){
        const savedSamples=samples.slice();
        const result=await call('train',{samples,commandId,mode:$('voice-recognition-mode').value==='browser'?'hybrid':$('voice-recognition-mode').value});if(version!==cancelVersion)return;
        if(learned.length>=200)throw new Error('Browser learning limit reached (200 examples). No new example was saved.');
        if(!result.pattern)throw new Error('No clear chunk pattern detected. Nothing saved; try a clearer voiced sound.');
        $('voice-project-save-status').textContent='Saving recording and pattern into the project…';
        await saveCommand(result.pattern,savedSamples,commandId);if(version!==cancelVersion)return;
        const template={id:commandId,file:'browser-training-'+Date.now()+'-'+Math.random().toString(16).slice(2)+'.features',frames:result.frames,rawFrames:result.rawFrames,pattern:result.pattern};
        await clipStore('readwrite',store=>store.put(new Blob([bytes]),template.file));if(version!==cancelVersion)return;
        const updated=await call('rebuild',{bank:{...bank,templates:[...bank.templates,template]}});if(version!==cancelVersion)return;
        bank=updated;learned=bank.templates;
        try{await persistTraining();}catch(error){clipKeys.add(template.file);renderCommands();throw new Error('Files were saved to the project, but this browser could not save its learning data. The example is active for this session.');}
        clipKeys.add(template.file);renderCommands();
        const phrase=bank.commands.find(command=>command.id===commandId).phrase;
        $('voice-training-status').textContent='Saved a new example for '+phrase+'. It is now used for recognition.';
        showPattern(result.pattern);
        say(bank.templates.length+' matching examples ready. New '+phrase+' example saved.');return;
      }
      const groupName=$('voice-group').selectedOptions[0].textContent;
      const result=await call('recognize',{samples,mode:$('voice-recognition-mode').value,allowedIds:activeCommands().map(command=>command.id)});if(version!==cancelVersion)return;
      showPattern(result.pattern);
      $('voice-result').textContent='';choice=null;
      if(result.accepted){choice=bank.commands.find(command=>command.id===result.id);say('Matched in '+groupName+': '+choice.phrase+'. Confirm below to use this choice.');$('voice-open').textContent='Use choice: '+choice.phrase;}
      else say('Not sure: '+result.reason+' Please try again or use the saved-narration selector.');
      const name=id=>bank.commands.find(c=>c.id===id)?.phrase||id;
      const shortlist=result.chunkCandidates?.length?'Chunk shortlist: '+result.chunkCandidates.map(item=>name(item.id)+` (count difference ${item.countDifference}, type difference ${item.typeDifference.toFixed(2)}, rank difference ${item.rankDifference.toFixed(2)})`).join(' · ')+'. ':'';
      $('voice-result').textContent=shortlist+(result.alternatives?'Frequency/template distances (lower is closer, not confidence percentages): '+result.alternatives.map(item=>name(item.id)+' '+item.score.toFixed(3)).join(' · '):'');
    }catch(error){if(version===cancelVersion){say(error.message);if(commandId&&!$('voice-project-save-status').textContent.startsWith('Saved to '))$('voice-project-save-status').textContent='Nothing saved to the project: '+error.message;}}
    finally{if(version===cancelVersion){busy=false;recording=false;closeMic();controls();}}
  };
  const startTask=()=>{stopSample();audio.pause();document.dispatchEvent(new Event('voice:listen'));choice=null;$('voice-result').textContent='';busy=true;controls();return ++cancelVersion;};
  const record=async(commandId=null)=>{
    if(busy||!bank)return;const version=startTask();
    try{
      if(!isSecureContext||!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw new Error('Microphone input needs HTTPS or localhost and a supported browser.');
      say('Allow microphone access, then say one command. Recording stops after 5 seconds.');
      const received=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
      if(version!==cancelVersion){received.getTracks().forEach(t=>t.stop());return;}stream=received;
      const chunks=[];recorder=new MediaRecorder(stream);const active=recorder;
      active.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
      active.onerror=()=>{if(version===cancelVersion){cancel();say('Recording failed. Check microphone access and try again.');}};
      active.onstop=async()=>{if(version!==cancelVersion)return;closeMic();recording=false;controls();await recognize(await new Blob(chunks,{type:active.mimeType}).arrayBuffer(),version,commandId);};
      active.start();recording=true;controls();say(commandId?'Recording training example for '+bank.commands.find(command=>command.id===commandId).phrase+'. Say only that phrase.':'Listening for 5 seconds. Say one choice, such as education, projects or help.');
      recordTimer=setTimeout(()=>{if(active.state==='recording')active.stop();},5000);
    }catch(error){if(version===cancelVersion){closeMic();busy=false;recording=false;controls();say(error.name==='NotAllowedError'?'Microphone permission was denied. You can still use the page buttons.':error.message);}}
  };
  const listenBrowser=async()=>{
    if(busy||!bank)return;
    if(!localSpeechSupported){say('On-device speech recognition is not supported here. No audio is sent online. Choose an experimental method or use the page buttons.');return;}
    const version=startTask();$('voice-pitch-pattern').textContent='On-device speech recognition uses recognised words, not chunk templates.';
    say('Checking the English language pack…');
    const messages={'not-allowed':'Microphone or speech-service permission was denied.','service-not-allowed':'The browser speech service is unavailable or blocked.','audio-capture':'No usable microphone was found.','network':'The browser speech service could not connect. Check your connection or use the page buttons.','no-speech':'No speech heard. Try again.','no-match':'Speech was not recognised. Try again.','language-not-supported':'English recognition is unavailable in this browser.','timeout':'Listening timed out. Try again.'};
    try{
      const available=await SpeechCommands.availability(BrowserRecognizer);if(version!==cancelVersion)return;
      if(available!=='available'){busy=false;recording=false;controls();const message=available==='downloadable'||available==='downloading'?'Use Prepare English speech to download or finish installing the language pack.':'English on-device recognition is unavailable in this browser. Choose an experimental method or use the page buttons.';$('voice-language-status').textContent=message;say(message+' No online fallback is used.');return;}
      recording=true;controls();say('Listening on this device. Allow microphone access if asked, then say one choice in English.');
      speechSession=SpeechCommands.listen(BrowserRecognizer,{
      onResult:transcripts=>{if(version!==cancelVersion)return;const result=SpeechCommands.match(transcripts,activeCommands());$('voice-result').textContent='Heard: '+result.transcript;choice=result.command;if(choice){$('voice-open').textContent='Use choice: '+choice.phrase;say('Recognised '+choice.phrase+'. Confirm below to use this choice.');}else say(result.reason);},
      onError:error=>{if(version!==cancelVersion)return;choice=null;say(messages[error]||'Speech recognition failed: '+error);},
      onEnd:()=>{if(version!==cancelVersion)return;speechSession=null;busy=false;recording=false;controls();}
    });}catch(error){speechSession=null;busy=false;recording=false;controls();say('Could not start browser speech recognition: '+error.message);}
  };
  $('voice-install-language').addEventListener('click',async()=>{
    if(busy||!localSpeechSupported)return;const version=startTask();$('voice-language-status').textContent='Checking the English speech pack…';
    try{let available=await SpeechCommands.availability(BrowserRecognizer);if(version!==cancelVersion)return;
      if(available==='downloadable'||available==='downloading'){$('voice-language-status').textContent='Preparing English speech. The language pack download needs an internet connection; your microphone is not active.';const installed=await SpeechCommands.install(BrowserRecognizer);if(version!==cancelVersion)return;if(!installed)throw Error('Language pack installation did not complete.');available=await SpeechCommands.availability(BrowserRecognizer);if(version!==cancelVersion)return;}
      const message=available==='available'?'English on-device recognition is ready. Press Listen to my choice.':'English on-device recognition is unavailable. Use an experimental method or the page buttons.';$('voice-language-status').textContent=message;say(message);
    }catch(error){if(version===cancelVersion){$('voice-language-status').textContent='Could not prepare local speech: '+error.message;say('Local speech setup failed. No online fallback is used.');}}
    finally{if(version===cancelVersion){busy=false;controls();}}
  });
  $('voice-listen').addEventListener('click',()=>{$('voice-recognition-mode').value==='browser'?listenBrowser():record();});
  const retrain=async()=>{
    if(!bank||busy)return;const version=startTask(),templates=[];let audioCount=0,featureCount=0;
    try{
      for(const template of bank.templates){
        let bytes=null;
        if(clipKeys.has(template.file)){const blob=await clipStore('readonly',store=>store.get(template.file));if(blob)bytes=await blob.arrayBuffer();}
        else if(/\.mp3$/i.test(template.file)){const response=await fetch('../voice-tour/audio/commands/'+encodeURIComponent(template.file));if(response.ok)bytes=await response.arrayBuffer();}
        if(version!==cancelVersion)return;
        if(bytes){const samples=await decode(bytes),result=await call('train',{samples,commandId:template.id,mode:'frequency'});templates.push({...template,...result});audioCount++;}
        else{templates.push(template);featureCount++;}
        say('Rebuilding saved sounds: '+templates.length+' of '+bank.templates.length+'…');
      }
      const rebuilt=await call('rebuild',{bank:{...bank,templates}});if(version!==cancelVersion)return;bank=rebuilt;learned=bank.templates;await persistTraining();renderCommands();
      $('voice-training-status').textContent='Rebuilt '+audioCount+' recordings and '+featureCount+' saved feature examples. '+bank.templates.filter(t=>t.pattern).length+' examples have usable pitch chunk patterns.';
      say('Retraining complete. Test a fresh recording now.');
    }catch(error){if(version===cancelVersion)say('Could not finish retraining: '+error.message);}
    finally{if(version===cancelVersion){busy=false;controls();}}
  };
  $('voice-retrain').addEventListener('click',retrain);
  $('voice-save-choice').addEventListener('click',()=>{$('voice-project-save-status').textContent='Record the selected command. Its audio and pattern will be saved locally.';record($('voice-train-command').value);});
  const routes={'about-me':'about-me','education':'education','projects':'projects','work-experience':'work-experience','skills':'skills','languages':'languages','skovde':'education-skövde','komvux':'komvux','gymnasium':'gymnasium','standalone-courses':'education-courses','goatly':'goatly','mental-model-graph':'mental-model-graph','frog-game':'frog-game','menu':'welcome','help':'help','stop':'goodbye'};
  const showPattern=pattern=>{
    const panel=$('voice-pitch-pattern');panel.replaceChildren();
    if(!pattern){panel.textContent='No pitch chunk pattern available for this recording.';return;}
    const summary=document.createElement('p');summary.textContent=pattern.chunks.map(c=>c.direction).join(' → ');panel.append(summary);
    const list=document.createElement('ol');for(const chunk of pattern.chunks){const item=document.createElement('li');item.textContent=chunk.direction+' · pitch rank '+(chunk.pitchRank??'unavailable')+' · length rank '+chunk.lengthRank+' · '+Math.round(chunk.durationMs)+' ms (reference only) · '+chunk.boundary;list.append(item);}panel.append(list);
  };
  $('voice-recognition-mode').addEventListener('change',()=>{choice=null;renderCommands();controls();say($('voice-recognition-mode').value==='browser'?(localSpeechSupported?'On-device speech selected. Prepare English speech if needed, then press Listen. No command training is required.':'On-device speech recognition is not supported here. Use an experimental method or page buttons. No online fallback is used.'):'Experimental method selected. Retrain saved sounds if examples lack pitch ranks.');});
  const renderCommands=()=>{
    const selected=$('voice-train-command').value;$('voice-train-command').replaceChildren();$('voice-command-list').replaceChildren();
    const commands=activeCommands();
    $('voice-group-status').textContent='Testing '+$('voice-group').selectedOptions[0].textContent+' — '+commands.length+' commands available, including Help, Menu and Stop. '+($('voice-recognition-mode').value==='browser'?'Say the command names; training is not needed.':'Only commands with taught examples can match.');
    for(const command of commands){
      $('voice-train-command').append(new Option(command.phrase,command.id));
      const action=command.actionId||command.id,count=bank.templates.filter(t=>t.id===command.id).length,item=document.createElement('li');
      const note=($('voice-recognition-mode').value==='browser'?' — say “'+command.phrase+'”':' — '+count+' example'+(count===1?'':'s')+(count?'':'; needs a recording'))+(command.actionId?' · '+(action==='test-only'?'test only':(bank.commands.find(c=>c.id===action)?.phrase||action)):'');
      const play=document.createElement('button'),label=document.createElement('span');play.type='button';play.textContent='▶';play.className='command-play';play.setAttribute('aria-label','Listen to recorded command '+command.phrase);
      play.disabled=!bank.templates.some(template=>template.id===command.id&&clipKeys.has(template.file));play.title=play.disabled?'Record a training example first':'Play latest command recording';play.addEventListener('click',()=>playSample(command));
      label.textContent=command.phrase+note;item.append(play,label);$('voice-command-list').append(item);
    }
    if(commands.some(c=>c.id===selected))$('voice-train-command').value=selected;
  };
  $('voice-group').addEventListener('change',()=>{choice=null;$('voice-result').textContent='';renderCommands();controls();say('Selected '+$('voice-group').selectedOptions[0].textContent+'. Test one of the displayed commands.');});
  $('voice-custom-form').addEventListener('submit',async event=>{
    event.preventDefault();if(!bank||busy)return;
    const phrase=$('voice-custom-name').value.trim().replace(/\s+/g,' '),actionId=$('voice-custom-action').value;
    if(!phrase||phrase.length>60){$('voice-custom-status').textContent='Enter a short command name.';return;}
    if(bank.commands.some(c=>c.phrase.toLocaleLowerCase()===phrase.toLocaleLowerCase())){$('voice-custom-status').textContent='That command already exists. Choose it in the command-to-save selector.';return;}
    if(customCommands.length>=50){$('voice-custom-status').textContent='Limit of 50 custom commands reached.';return;}
    if(actionId!=='test-only'&&!bank.commands.some(c=>c.id===actionId&&!c.actionId))return;
    const command={id:'custom-'+crypto.randomUUID(),phrase,actionId},updated=[...customCommands,command];
    busy=true;controls();
    try{await persistTraining(learned,updated);}catch(error){busy=false;controls();$('voice-custom-status').textContent='Could not save the command. Browser storage may be full or blocked.';return;}
    busy=true;controls();customCommands=updated;bank.commands.push(command);bank.thresholds[command.id]=bank.thresholds[actionId]??.9;
    try{await call('init',{bank});if(!activeCommands().some(c=>c.id===command.id))$('voice-group').value=actionId==='test-only'?'custom':Object.keys(groups).find(group=>groups[group].includes(actionId))||'custom';renderCommands();$('voice-train-command').value=command.id;$('voice-custom-name').value='';$('voice-custom-status').textContent='Added '+phrase+'. Record an example below. Its play button will play your recorded command, not the narration.';}
    catch(error){say(error.message);}finally{busy=false;controls();}
  });
  const history=[];
  const useCommand=command=>{
    if(!command)return;const id=command.actionId||command.id,select=$('tour-saved');
    if(id==='test-only'){say('Recognised custom sound: '+command.phrase+'. Test only — no narration changed.');choice=null;controls();return;}
    if(id==='repeat'){audio.currentTime=0;audio.play().catch(()=>say('Press Play narration to repeat.'));return;}
    if(id==='back'){const previous=history.pop();if(previous){select.value=previous;document.dispatchEvent(new CustomEvent('tour:play-saved',{detail:{file:previous}}));}else say('Already at the first narration.');return;}
    const route=routes[id];
    if(!route){say('Matched '+command.phrase+', but its audio-tour narration is not available yet. Use the main CV for this section.');return;}
    const target=route+'.narration.json';if(![...select.options].some(o=>o.value===target)){say('This narration is not available yet.');return;}
    if(id==='stop')audio.pause();else if(select.value!==target)history.push(select.value);
    select.value=target;document.dispatchEvent(new CustomEvent('tour:play-saved',{detail:{file:target}}));say('Playing connected sound for '+command.phrase+'.');
    choice=null;controls();
  };
  $('voice-open').addEventListener('click',()=>useCommand(choice));
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stopSample();if(busy)cancel();}});
  audio.addEventListener('play',()=>{stopSample();if(busy)cancel();});
  window.addEventListener('pagehide',()=>{stopSample();cancel();worker?.terminate();});
  fetch('command-bank.json',{cache:'no-store'}).then(async response=>{
    if(!response.ok)throw new Error('Command template bank missing.');bank=await response.json();
    if(bank.schemaVersion!==1||bank.method!=='mfcc-dtw'||!Array.isArray(bank.templates)||!Array.isArray(bank.commands))throw new Error('Unsupported command bank.');
    try{
      const saved=await clipStore('readonly',store=>store.get('active'),'models')||JSON.parse(localStorage.getItem(trainingKey)||'null');
      if(saved&&saved.epoch===bank.trainingEpoch&&saved.scale?.mean?.length===24&&saved.scale?.std?.length===24&&saved.scale.std.every(v=>Number.isFinite(v)&&v>0)&&saved.scale.mean.every(Number.isFinite)&&Array.isArray(saved.templates)){
        customCommands=(Array.isArray(saved.commands)?saved.commands:[]).filter(c=>typeof c.id==='string'&&/^custom-[a-z0-9-]+$/.test(c.id)&&typeof c.phrase==='string'&&c.phrase.trim().length>0&&c.phrase.length<=60&&(c.actionId==='test-only'||bank.commands.some(base=>base.id===c.actionId&&!base.actionId))).slice(0,50);
        for(const command of customCommands)if(!bank.commands.some(c=>c.id===command.id)){bank.commands.push(command);bank.thresholds[command.id]=bank.thresholds[command.actionId]??.9;}
        learned=saved.templates.filter(item=>bank.commands.some(c=>c.id===item.id)&&typeof item.file==='string'&&Array.isArray(item.frames)&&item.frames.length>=8&&item.frames.length<=600&&item.frames.every(frame=>Array.isArray(frame)&&frame.length===24&&frame.every(Number.isFinite))).slice(0,200);
        learned=learned.map(item=>({...item,rawFrames:item.rawFrames||item.frames.map(frame=>frame.map((v,i)=>v*saved.scale.std[i]+saved.scale.mean[i]))}));
        for(const item of learned){const index=bank.templates.findIndex(template=>template.file===item.file);if(index<0)bank.templates.push(item);else bank.templates[index]=item;}
        $('voice-training-status').textContent=learned.length+' browser-saved training examples restored.';
      }else if(saved){await clipStore('readwrite',store=>store.put(saved,'backup-'+Date.now()),'models');$('voice-training-status').textContent='Previous learning data backed up. Record new examples to start again.';}
    }catch(error){$('voice-training-status').textContent='Browser training storage unavailable. Original templates still work.';}
    worker=new Worker('voice-worker.js?v=hybrid-1');worker.onmessage=event=>{const task=pending.get(event.data.id);if(!task)return;pending.delete(event.data.id);event.data.error?task.reject(new Error(event.data.error)):task.resolve(event.data.result);};
    worker.onerror=()=>{for(const task of pending.values())task.reject(new Error('Experimental recognizer could not run.'));pending.clear();worker=null;if(bank)renderCommands();controls();say('Experimental recognizer unavailable. Browser speech recognition and the saved-narration buttons can still be used.');};
    await call('init',{bank});bank=await call('rebuild',{bank});learned=bank.templates;try{await persistTraining();}catch(error){$('voice-training-status').textContent='Learning works for this session, but browser saving is unavailable.';}
    try{clipKeys=new Set(await clipStore('readonly',store=>store.getAllKeys()));}catch(error){$('voice-training-status').textContent=error.message;}
    renderCommands();for(const command of bank.commands.filter(c=>!c.actionId))$('voice-custom-action').append(new Option(command.phrase,command.id));
    say($('voice-recognition-mode').value==='browser'?(localSpeechSupported?'On-device speech is supported. Prepare English speech if needed, then press Listen. No command training is required.':'On-device speech recognition is not supported here. No audio is sent online. Use another browser, an experimental method, or the saved narration selector.'):(bank.templates.length?bank.templates.length+' matching examples ready. Listen to match, or use Listen and save.':'No learning examples yet. Select a command, then use Listen and save.'));controls();
  }).catch(error=>{if(bank&&$('voice-recognition-mode').value==='browser'){worker=null;renderCommands();say('Browser speech commands are available; experimental learning could not start. '+error.message);}else{bank=null;say(error.message);}controls();});
  controls();
})();
