import {downloadProgress} from './download-progress.mjs';
let transcriber=null;
self.onmessage=async event=>{const {id,type,samples}=event.data;
  try{
    if(type==='load'){
      const {Transcriber,ModelArch}=await import('https://cdn.jsdelivr.net/npm/@moonshine-ai/moonshine-wasm@0.1.5/dist/index.js');
      transcriber=await Transcriber.load({language:'en',modelArch:ModelArch.TinyStreaming,onProgress:(loaded,total)=>postMessage({id,progress:downloadProgress(loaded,total)})});
      postMessage({id,ready:true});
    }else if(type==='transcribe'){
      if(!transcriber)throw Error('Load the model first.');
      const transcript=transcriber.transcribe(samples,{sampleRate:16000});
      postMessage({id,text:transcript.lines.map(line=>line.text).join(' ').trim()});
    }
  }catch(error){postMessage({id,error:error.message||String(error)});}
};
