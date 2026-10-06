importScripts('voice-matcher.js?v=noise-gates-2');
let bank=null;
onmessage=event=>{
  const {id,type}=event.data;
  try {
    if(type==='init') {bank=event.data.bank;postMessage({id,result:{ready:true}});return;}
    if(!bank)throw new Error('Command templates are not ready.');
    const frames=VoiceMatcher.features(event.data.samples);
    if(type==='train'){
      if(!bank.commands.some(command=>command.id===event.data.commandId))throw new Error('Choose a known command.');
      postMessage({id,result:{frames:VoiceMatcher.normalize(frames,bank.scale).map(frame=>frame.map(value=>Math.round(value*1000)/1000))}});return;
    }
    postMessage({id,result:VoiceMatcher.recognize(frames,bank)});
  }catch(error){postMessage({id,error:error.message});}
};
