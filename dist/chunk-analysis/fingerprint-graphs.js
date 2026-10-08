(function(root){
  'use strict';
  const $=id=>document.getElementById(id);
  class FingerprintGraphs{
    constructor(){
      $('fingerprint-scope').onchange=()=>this.draw(this.timeMs,this.chunkIndex,this.pattern,this.duration);
      $('download-fingerprint').onclick=()=>{
        if(!this.analysis)return;
        const {method,fingerprintDefinition,recordingScope,recordingFingerprint,chunks}=this.analysis;
        const payload={schemaVersion:1,method,fingerprintDefinition,recordingScope,recordingFingerprint,chunks};
        const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
        const link=document.createElement('a');link.href=url;link.download='sound-fingerprint.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      };
    }
    set(analysis){this.analysis=analysis?.mfcc;this.cache=null;$('download-fingerprint').disabled=!this.analysis;$('fingerprint-scope').disabled=!this.analysis;}
    prepare(id){const canvas=$(id),ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#fffdf9';ctx.fillRect(0,0,canvas.width,canvas.height);return {canvas,ctx,L:65,R:canvas.width-24,T:40,B:canvas.height-42};}
    draw(timeMs=0,chunkIndex=-1,pattern=null,duration=0){
      Object.assign(this,{timeMs,chunkIndex,pattern,duration});this.drawMfcc();this.drawFingerprint();
    }
    drawMfcc(){
      const {canvas,ctx,L,R,T,B}=this.prepare('mfcc-graph'),data=this.analysis;
      if(!data||!this.duration){$('mfcc-summary').textContent='Analyze a sound to see its MFCCs.';canvas.setAttribute('aria-label','No MFCCs yet');return;}
      const x=ms=>L+ms/this.duration*(R-L);
      if(!this.cache){
        const cache=document.createElement('canvas');cache.width=canvas.width;cache.height=canvas.height;const paint=cache.getContext('2d');
        this.limit=Math.max(1,...data.frames.flatMap(f=>f.coefficients.slice(1).map(Math.abs)));
        for(const frame of data.frames)for(let i=1;i<=12;i++){
          const v=frame.coefficients[i]/this.limit;
          paint.fillStyle=`hsl(${v<0?210:25} 75% ${95-Math.abs(v)*55}%)`;
          paint.fillRect(x(frame.startMs),B-i/12*(B-T),Math.max(1,x(Math.min(this.duration,frame.startMs+data.hopMs))-x(frame.startMs)),(B-T)/12+1);
        }this.cache=cache;
      }
      ctx.drawImage(this.cache,0,0);ctx.fillStyle='#675a4d';ctx.font='12px system-ui';ctx.fillText('MFCCs C1–C12 (not frequencies)',L,22);
      for(let i=1;i<=12;i++)ctx.fillText(`C${i}`,20,B-(i-.5)/12*(B-T)+4);
      for(const c of [...(this.pattern?.chunks||[]),...(this.pattern?.noiseChunks||[])]){
        ctx.strokeStyle='#352c2366';for(const ms of [c.startMs,c.endMs]){ctx.beginPath();ctx.moveTo(x(ms),T);ctx.lineTo(x(ms),B);ctx.stroke();}
      }
      for(let i=0;i<=5;i++){const ms=this.duration*i/5;ctx.fillText(`${Math.round(ms)} ms`,Math.min(R-58,x(ms)),canvas.height-12);}
      ctx.strokeStyle='#b33237';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x(this.timeMs),T);ctx.lineTo(x(this.timeMs),B);ctx.stroke();ctx.lineWidth=1;
      $('mfcc-summary').textContent=`${data.frames.length} frames. Blue = negative; orange = positive; pale = near zero. Colour range ±${this.limit.toFixed(2)} (shared across this recording). C0 is omitted from the graph and fingerprints. Red line follows playback; vertical lines mark your existing boundaries.`;
      canvas.setAttribute('aria-label',$('mfcc-summary').textContent+' Horizontal axis time, vertical axis coefficients C1 to C12. These are sound-shape features, not pitch or letters.');
    }
    drawFingerprint(){
      const {canvas,ctx,L,R,T,B}=this.prepare('fingerprint-graph'),data=this.analysis,selected=$('fingerprint-scope').value==='selected';
      const chunk=data?.chunks[this.chunkIndex],fp=selected?chunk?.fingerprint:data?.recordingFingerprint;
      const title=selected?`Selected Fourier region: ${Math.round(chunk?.startMs||0)}–${Math.round(chunk?.endMs||0)} ms`:'Recording: regular non-Closed chunks';
      const out=$('fingerprint-summary');
      if(!fp){out.textContent=selected?'No selected region fingerprint. Analyze a recording with chunks.':'No recording fingerprint: no regular non-Closed chunks.';$('fingerprint-json').textContent='No fingerprint yet.';canvas.setAttribute('aria-label',out.textContent);return;}
      const limit=Math.max(1,...fp.mean.map((v,i)=>Math.abs(v)+fp.std[i])),mid=(T+B)/2,y=v=>mid-v/limit*(B-T)/2,step=(R-L)/12;
      ctx.fillStyle='#675a4d';ctx.font='13px system-ui';ctx.fillText(title,L,22);ctx.strokeStyle='#b8ab98';ctx.beginPath();ctx.moveTo(L,mid);ctx.lineTo(R,mid);ctx.stroke();
      for(let i=0;i<12;i++){
        const x=L+step*(i+.5),v=fp.mean[i],spread=fp.std[i];ctx.fillStyle=v<0?'#397cb1':'#c78325';ctx.fillRect(x-step*.3,Math.min(mid,y(v)),step*.6,Math.max(1,Math.abs(y(v)-mid)));
        ctx.strokeStyle='#352c23';ctx.beginPath();ctx.moveTo(x,y(v-spread));ctx.lineTo(x,y(v+spread));ctx.moveTo(x-5,y(v-spread));ctx.lineTo(x+5,y(v-spread));ctx.moveTo(x-5,y(v+spread));ctx.lineTo(x+5,y(v+spread));ctx.stroke();ctx.fillStyle='#675a4d';ctx.fillText(`C${i+1}`,x-12,canvas.height-16);
      }
      for(const v of [-limit,0,limit])ctx.fillText(v.toFixed(1),3,y(v)+4);
      out.textContent=`${title}. ${fp.frameCount} frames → 24-number fingerprint: 12 means + 12 standard deviations. Bars = mean; whiskers = variation, not confidence. No word recognition or matching yet. Similar sounds can have similar fingerprints; this is not a unique identity.`;
      $('fingerprint-json').textContent=JSON.stringify(fp,null,2);canvas.setAttribute('aria-label',out.textContent+' Exact values are available in the fingerprint JSON below.');
    }
  }
  root.FingerprintGraphs=FingerprintGraphs;
})(globalThis);
