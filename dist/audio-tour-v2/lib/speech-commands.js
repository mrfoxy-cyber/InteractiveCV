(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.SpeechCommands=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const normalize=text=>String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9\s-]/g,' ').replace(/-/g,' ').replace(/\s+/g,' ').trim();
  const aliases={'about-me':['about myself','about you'],'work-experience':['work','experience'],'menu':['main menu'],'back':['go back'],'repeat':['say again'],'standalone-courses':['courses'],'mental-model-graph':['mmg']};
  function match(transcripts,commands){
    for(const transcript of transcripts){
      const text=normalize(transcript).replace(/^please\s+/,'').replace(/\s+please$/,'').replace(/^(show me|tell me about|open)\s+/,'');
      const hits=commands.filter(c=>[c.phrase,c.id,...(aliases[c.id]||[])].some(phrase=>normalize(phrase)===text));
      if(hits.length>1)return {command:null,transcript,reason:'More than one available command matches. Please say a single choice.'};
      if(hits.length===1)return {command:hits[0],transcript};
    }
    return {command:null,transcript:transcripts[0]||'',reason:'No available command matched. Say one of the displayed choices.'};
  }
  function supportsLocal(Recognizer){
    if(typeof Recognizer!=='function'||typeof Recognizer.available!=='function'||typeof Recognizer.install!=='function')return false;
    try{return 'processLocally' in new Recognizer();}catch{return false;}
  }
  async function availability(Recognizer,lang='en-US'){
    if(!supportsLocal(Recognizer))return 'unsupported';
    return Recognizer.available({langs:[lang],processLocally:true});
  }
  async function install(Recognizer,lang='en-US'){
    if(!supportsLocal(Recognizer))throw Error('On-device speech recognition is not supported in this browser.');
    return Recognizer.install({langs:[lang],processLocally:true});
  }
  function listen(Recognizer,{lang='en-US',onResult,onError,onEnd,audioTrack}){
    if(!supportsLocal(Recognizer))throw Error('On-device speech recognition is not supported. No online fallback is used.');
    const recognition=new Recognizer();let ended=false,heard=false,timer;
    recognition.processLocally=true;
    if(recognition.processLocally!==true)throw Error('Local-only speech recognition could not be enabled.');
    const end=()=>{if(ended)return;ended=true;clearTimeout(timer);onEnd();};
    recognition.lang=lang;recognition.continuous=false;recognition.interimResults=false;recognition.maxAlternatives=3;
    recognition.onresult=event=>{if(ended)return;const result=event.results[event.resultIndex||0];if(!result?.isFinal)return;heard=true;onResult(Array.from({length:result.length},(_,i)=>result[i].transcript));recognition.stop();};
    recognition.onerror=event=>{if(ended)return;heard=true;onError(event.error);end();recognition.abort();};
    recognition.onnomatch=()=>{if(!ended){heard=true;onError('no-match');}};
    recognition.onspeechend=()=>{if(!ended)recognition.stop();};
    recognition.onend=()=>{if(!ended&&!heard)onError('no-speech');end();};
    timer=setTimeout(()=>{if(ended)return;heard=true;onError('timeout');recognition.abort();end();},15000);
    try{if(audioTrack){if(audioTrack.kind!=='audio'||audioTrack.readyState!=='live')throw Error('The filtered microphone track is not live.');recognition.start(audioTrack);}else recognition.start();}catch(error){clearTimeout(timer);throw error;}
    return {cancel(){ended=true;clearTimeout(timer);recognition.abort();}};
  }
  function watchCommands(Recognizer,{commands,onCommand,onError,onEnd,audioTrack}){
    if(!supportsLocal(Recognizer))throw Error('Local-only speech recognition is not supported.');
    const recognition=new Recognizer();let ended=false;
    recognition.processLocally=true;
    if(recognition.processLocally!==true)throw Error('Local-only speech recognition could not be enabled.');
    recognition.lang='en-US';recognition.continuous=true;recognition.interimResults=true;recognition.maxAlternatives=3;
    const cancel=()=>{if(ended)return;ended=true;recognition.abort();};
    recognition.onresult=event=>{
      if(ended)return;
      for(let i=event.resultIndex||0;i<event.results.length;i++){
        const result=event.results[i];
        const matched=match(Array.from({length:result.length},(_,j)=>result[j].transcript),commands);
        // Stop may interrupt on an interim result. Other choices wait for a final phrase.
        if(matched.command&&(result.isFinal||matched.command.id==='stop')){cancel();onCommand(matched);return;}
      }
    };
    recognition.onerror=event=>{if(ended)return;if(event.error==='no-speech')return;cancel();onError(event.error);};
    recognition.onend=()=>{if(!ended){ended=true;onEnd();}};
    if(audioTrack){if(audioTrack.kind!=='audio'||audioTrack.readyState!=='live')throw Error('The filtered microphone track is not live.');recognition.start(audioTrack);}else recognition.start();return {cancel};
  }
  function watchStop(Recognizer,{onStop,...options}){
    return watchCommands(Recognizer,{...options,commands:[{id:'stop',phrase:'stop'}],onCommand:()=>onStop()});
  }
  return {normalize,match,listen,watchStop,watchCommands,supportsLocal,availability,install};
});
