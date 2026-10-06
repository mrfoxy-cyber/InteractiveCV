(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.EchoMicrophone=factory();})(globalThis,function(){
  'use strict';
  class Input {
    constructor(devices){this.devices=devices;this.stream=null;this.pending=null;this.generation=0;}
    get track(){const track=this.stream?.getAudioTracks()[0];return track?.readyState==='live'?track:null;}
    close(){++this.generation;this.stream?.getTracks().forEach(track=>track.stop());this.stream=null;this.pending=null;}
    async open(){
      if(this.track)return this.track;
      if(this.pending)return this.pending;
      if(!this.devices?.getUserMedia)throw Error('Microphone capture is unavailable. Use HTTPS or localhost.');
      if(!this.devices.getSupportedConstraints().echoCancellation)throw Error('This browser does not offer echo cancellation.');
      const generation=this.generation;
      const pending=(async()=>{
        const stream=await this.devices.getUserMedia({audio:{echoCancellation:{exact:true},noiseSuppression:true,autoGainControl:true},video:false});
        const track=stream.getAudioTracks()[0];
        if(generation!==this.generation){stream.getTracks().forEach(t=>t.stop());throw new DOMException('Microphone request cancelled.','AbortError');}
        const echo=track?.getSettings().echoCancellation;
        if(!track||track.readyState!=='live'||!(echo===true||echo==='all')){stream.getTracks().forEach(t=>t.stop());throw Error('The microphone did not enable general echo cancellation. No unfiltered fallback is used.');}
        this.stream=stream;return track;
      })();
      this.pending=pending;
      try{return await pending;}finally{if(this.pending===pending)this.pending=null;}
    }
  }
  return {Input};
});
