'use strict';
(async()=>{
  const $=id=>document.getElementById(id),audio=$('tour-audio'),reduced=matchMedia('(prefers-reduced-motion: reduce)'),Recognizer=window.SpeechRecognition||window.webkitSpeechRecognition;
  let renderer=null,config=null,raf=0,last=0,commands=[],flow=null,localReady=false;
  const microphoneInput=new EchoMicrophone.Input(navigator.mediaDevices);let startVersion=0;
  async function choose(command){
    const request=++startVersion;
    if(command.id==='stop'){microphoneInput.close();return flow.choose(command);}
    if(localReady&&!microphoneInput.track){
      $('tour-stop').disabled=false;$('echo-status').textContent='Requesting an echo-cancelled microphone…';
      try{await microphoneInput.open();if(request!==startVersion)return;$('echo-status').textContent='Echo cancellation is enabled on the microphone. A filtered audio track is supplied to local recognition; test voice Stop with your browser.';}
      catch(error){if(request!==startVersion||error.name==='AbortError')return;$('echo-status').textContent='Filtered voice input unavailable: '+error.message+' You can still use the choice buttons.';}
    }
    if(request===startVersion)return flow.choose(command);
  }
  const status=text=>$('tour-status').textContent=text;
  const frame=()=>{if(renderer&&config)renderer.frame(audio.currentTime*1000,config,MouthTimeline.sample(config.mouthTiming,audio.currentTime*1000),$('tour-animate').checked&&!audio.ended);};
  const tick=now=>{if(now-last>1000/30){last=now;frame();}if(!audio.paused&&!audio.ended)raf=requestAnimationFrame(tick);};
  const halt=()=>{audio.pause();cancelAnimationFrame(raf);renderer?.render({});};
  $('tour-animate').checked=!reduced.matches;$('tour-animate').addEventListener('change',frame);
  reduced.addEventListener('change',event=>{if(event.matches){$('tour-animate').checked=false;frame();}});
  audio.addEventListener('play',()=>{cancelAnimationFrame(raf);last=-Infinity;raf=requestAnimationFrame(tick);});
  audio.addEventListener('pause',()=>{cancelAnimationFrame(raf);renderer?.render({});});
  audio.addEventListener('ended',()=>{cancelAnimationFrame(raf);renderer?.render({});flow?.ended();});
  audio.addEventListener('error',()=>{if(flow?.active){flow.stop();status('The recording could not play. Choose another section.');}});
  const json=async url=>{const response=await fetch(url);if(!response.ok)throw Error('Could not load '+url);return response.json();};
  async function prepare(command,valid){
    let value,url;
    if(command.audio){
      value=AudioTourConfig.validate({schemaVersion:1,kind:'audio-tour-narration',title:command.phrase,character:'anchored-character/character.json',audio:{src:command.audio},transcript:'Original '+command.phrase+' recording. A transcript and mouth timing have not been added yet.',mouthTiming:null,animations:{blink:{enabled:true,cycleMs:4800,closeMs:70,holdMs:60,openMs:100},hair:{enabled:true,cycleMs:7200}}});url=new URL('./',location.href);
    }else{url=new URL('narrations/'+encodeURIComponent(command.file),location.href);value=AudioTourConfig.validate(await json(url));}
    if(!valid())return;
    const characterUrl=new URL(value.character,url),audioUrl=new URL(value.audio.src,url);
    if(characterUrl.origin!==location.origin||audioUrl.origin!==location.origin)throw Error('Tour assets must be on this website.');
    const canvas=document.createElement('canvas');canvas.id='tour-character';canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Marju’s illustrated audio-tour character');
    const loaded=await AudioTourCharacter.load(canvas,characterUrl);if(!valid())return;
    if(value.mouthTiming?.mouthCues.some(cue=>!loaded.poses.has(cue.pose)))throw Error('A mouth pose is missing.');
    $('tour-character').replaceWith(canvas);renderer=loaded;config=value;
    $('tour-title').textContent=value.title;$('tour-transcript').textContent=value.transcript;showChoices(command.id==='nothing-heard'||command.id==='retry'?flow.current||commands[0]:command);
    await new Promise((resolve,reject)=>{
      const cleanup=()=>{clearTimeout(timer);audio.removeEventListener('loadedmetadata',ready);audio.removeEventListener('error',failed);};
      const ready=()=>{cleanup();if(value.mouthTiming&&(!Number.isFinite(audio.duration)||Math.abs(audio.duration*1000-value.mouthTiming.durationMs)>150))reject(Error('Recording duration does not match mouth timing.'));else resolve();};
      const failed=()=>{cleanup();reject(Error('Recording could not load.'));};
      const timer=setTimeout(()=>{cleanup();reject(Error('Recording took too long to load.'));},20000);
      audio.addEventListener('loadedmetadata',ready);audio.addEventListener('error',failed);audio.src=audioUrl.href;audio.load();
    });
  }
  function showChoices(command){
    const group=['education','projects','languages'].includes(command.id)?command.id:command.group==='controls'?'main':command.group||'main';
    const choices=commands.filter(c=>(c.group===group&&c.id!=='menu')||c.group==='controls'||(group!=='main'&&c.id==='menu'));
    $('tour-choices').replaceChildren(...choices.map(c=>{const button=document.createElement('button');button.type='button';button.textContent=c.phrase;button.addEventListener('click',()=>choose(c));return button;}));
    $('tour-missing').textContent=group==='education'?'Tartu and Lexicon recordings are not available yet.':group==='languages'?'Original language recordings play without mouth timing for now.':'';
  }
  function state(kind,value){
    if(['stopped','waiting','speech-error','error'].includes(kind)||(kind==='loading'&&value?.terminal)){++startVersion;microphoneInput.close();}
    const active=flow?.active;$('tour-stop').disabled=!active;
    $('tour-microphone').dataset.playing=String(!!active);$('tour-microphone-label').textContent=active?'Pause audio tour':'Start audio tour';
    const messages={loading:'Loading narration. Only “stop” is accepted right now.',playing:value?.terminal?'Playing goodbye. The microphone is off.':'Playing narration. Say “stop” to end the tour; other choices wait until the narration finishes.',listening:'Listening now. Say your choice, then pause. I’ll detect when you finish speaking.',stopped:'Tour cancelled. The microphone is off.',waiting:'Tour finished. The microphone is off. Start the tour to continue.',unmatched:'No matching choice. Start the tour to try again, or use a choice button.'};
    if(kind==='heard')$('tour-heard').textContent='Heard: '+value.transcript;
    else if(kind==='speech-error')status('Voice input unavailable ('+value+'). Use a choice button.');
    else if(kind==='error')status(value.message);
    else if(kind==='stop-unavailable')$('tour-heard').textContent='Voice Stop is unavailable ('+value+'). Use Stop tour to end the tour.';
    else if(messages[kind])status(messages[kind]);
  }
  async function checkLocal(){
    try{const availability=await SpeechCommands.availability(Recognizer);localReady=availability==='available';$('voice-language-status').textContent=localReady?'English speech is ready on this device.':'Local English speech: '+availability+'. Use Prepare English speech if supported, or choose with buttons.';}
    catch(error){localReady=false;$('voice-language-status').textContent=error.message;}
  }
  $('voice-install-language').addEventListener('click',async()=>{const button=$('voice-install-language');button.disabled=true;try{$('voice-language-status').textContent='Preparing English speech…';if(!await SpeechCommands.install(Recognizer))throw Error('Language pack installation did not complete.');await checkLocal();}catch(error){$('voice-language-status').textContent=error.message;}finally{button.disabled=false;}});
  try{
    const mapping=await json('tour-commands.json'),catalogue=await json('narrations/catalogue.json');
    if(mapping.schemaVersion!==1||!Array.isArray(mapping.commands))throw Error('Invalid command map.');
    commands=mapping.commands;
    for(const c of commands)if(c.file&&!catalogue.narrations.some(n=>n.file===c.file))throw Error('Missing narration for '+c.phrase);
    const track=()=>{if(!localReady||!microphoneInput.track)throw Error('Echo-cancelled local voice input is not ready. Use the choice buttons.');return microphoneInput.track;};
    flow=new TourFlow.Flow({commands,match:SpeechCommands.match,halt,state,play:async(command,valid)=>{await prepare(command,valid);if(valid())await audio.play();},watchStop:callbacks=>SpeechCommands.watchStop(Recognizer,{...callbacks,audioTrack:track()}),listen:callbacks=>SpeechCommands.listen(Recognizer,{...callbacks,audioTrack:track()})});
    $('tour-microphone').addEventListener('click',()=>{if(flow.active||microphoneInput.pending){++startVersion;microphoneInput.close();flow.stop();}else{flow.retries=0;choose(flow.current&&!flow.current.terminal?flow.current:commands[0]);}});
    $('tour-stop').addEventListener('click',()=>choose(commands.find(c=>c.id==='stop')));
    document.addEventListener('visibilitychange',()=>{if(document.hidden){++startVersion;microphoneInput.close();flow.stop();}});window.addEventListener('pagehide',()=>{++startVersion;microphoneInput.close();flow.stop();});
    document.addEventListener('keydown',event=>{if(event.key==='Escape')flow.stop();});
    await prepare(commands[0],()=>!flow.active);await checkLocal();$('tour-microphone').disabled=false;status('Ready. Start the audio tour, or choose a section below.');
  }catch(error){status(error.message);}
})();
