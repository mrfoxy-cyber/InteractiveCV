(function(root){
  'use strict';
  const $=id=>document.getElementById(id);
  class SoundGraphs{
    constructor(){this.fingerprints=new FingerprintGraphs();this.samples=null;this.analysis=null;this.pattern=null;this.chunkIndex=-1;this.timeMs=0;
      $('fft-chunk').onchange=()=>{this.chunkIndex=Number($('fft-chunk').value);this.draw();};
    }
    set(samples,analysis,pattern){
      this.samples=samples;this.analysis=analysis;this.pattern=pattern;this.timeMs=0;
      const select=$('fft-chunk');select.replaceChildren();
      this.regions=analysis?.regions||[];
      this.regions.forEach((c,i)=>select.add(new Option(`${c.type==='between-chunks'?`Between chunks ${c.gapIndex+1}`:`${pattern?.method==='amplitude'?'Amplitude':'Pitch'} chunk ${c.pitchIndex+1} · ${c.chunkType==='closed'?'Closed':pattern?.method==='amplitude'?({rising:'Raising',falling:'Going down',stable:'Stable'})[c.direction]:c.direction}`} · ${Math.round(c.startMs)}–${Math.round(c.endMs)} ms`,String(i))));
      this.chunkIndex=this.regions.length?0:-1;select.disabled=this.chunkIndex<0;
      if(this.chunkIndex<0)select.add(new Option('No detected chunks','-1'));
      this.melCache=null;this.fingerprints.set(analysis);
      $('sound-position').textContent='Playback position: 0 ms';this.draw();
    }
    position(ms,chunkIndex){this.timeMs=ms;if(Number.isInteger(chunkIndex)&&chunkIndex!==this.chunkIndex){this.chunkIndex=chunkIndex;$('fft-chunk').value=String(chunkIndex);}
      $('sound-position').textContent=`Playback position: ${Math.round(ms)} ms`;this.draw();this.onPosition?.(ms);
    }
    prepare(id,title){const canvas=$(id),ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#fffdf9';ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.font='14px system-ui';ctx.fillStyle='#675a4d';ctx.fillText(title,65,22);return {canvas,ctx,L:65,R:canvas.width-24,T:40,B:canvas.height-42};}
    draw(){this.drawWaveform();this.drawMel();this.fingerprints.draw(this.timeMs,this.chunkIndex,this.pattern,this.samples?.length/16||0);const c=this.regions?.[this.chunkIndex];this.drawSpectrum('fft-full-graph',this.analysis?.whole,'Full recording',false);this.drawSpectrum('fft-chunk-graph',c,c?.type==='between-chunks'?`Between chunks ${c.gapIndex+1}`:`${this.pattern?.method==='amplitude'?'Amplitude':'Pitch'} chunk ${(c?.pitchIndex??0)+1}`,true);}
    drawMel(){
      const {canvas,ctx,L,R,T,B}=this.prepare('mel-graph','Mel spectrogram · low frequencies below, high frequencies above');
      const mel=this.analysis?.mel,description=$('mel-summary');
      if(!mel||!this.samples){description.textContent='Analyze a recording to see its Mel bands over time.';canvas.setAttribute('aria-label','No Mel spectrogram yet');return;}
      const duration=this.samples.length/16,x=ms=>L+ms/duration*(R-L);
      if(!this.melCache){
        const cache=document.createElement('canvas');cache.width=canvas.width;cache.height=canvas.height;
        const paint=cache.getContext('2d');
        for(const f of mel.frames)for(let band=0;band<mel.bands;band++){
          const strength=Math.max(0,Math.min(1,(f.db[band]+100)/100));
          paint.fillStyle=`hsl(${255-strength*215} 75% ${10+strength*65}%)`;
          paint.fillRect(x(f.startMs),B-(band+1)/mel.bands*(B-T),Math.max(1,x(Math.min(duration,f.startMs+mel.hopMs))-x(f.startMs)),(B-T)/mel.bands+1);
        }
        this.melCache=cache;
      }
      ctx.drawImage(this.melCache,0,0);
      const marks=[...(this.pattern?.chunks||[]).map((c,i)=>({...c,label:`${this.pattern.method==='amplitude'?'A':'P'}${i+1}${c.chunkType==='closed'?' Closed':''}`})),
        ...(this.pattern?.noiseChunks||[]).map((c,i)=>({...c,label:`N${i+1} Noise`})),
        ...(this.regions||[]).filter(c=>c.type==='between-chunks').map(c=>({...c,label:`B${c.gapIndex+1}`}))];
      for(const c of marks){ctx.strokeStyle='#ffffffaa';ctx.beginPath();ctx.moveTo(x(c.startMs),T);ctx.lineTo(x(c.startMs),B);ctx.stroke();ctx.fillStyle='#fff';ctx.font='11px system-ui';ctx.fillText(c.label,x(c.startMs)+2,T+13);}
      for(let i=0;i<=4;i++){
        const fraction=i/4,hz=700*((1+8000/700)**fraction-1),y=B-fraction*(B-T);
        ctx.fillStyle='#675a4d';ctx.font='12px system-ui';ctx.fillText(`${Math.round(hz)} Hz`,3,y+4);
      }
      for(let i=0;i<=5;i++){const ms=duration*i/5;ctx.fillText(`${Math.round(ms)} ms`,Math.min(R-58,x(ms)),canvas.height-12);}
      ctx.strokeStyle='#b33237';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x(Math.min(duration,this.timeMs)),T);ctx.lineTo(x(Math.min(duration,this.timeMs)),B);ctx.stroke();ctx.lineWidth=1;
      description.textContent=`${mel.bands} triangular Mel bands, 0–8000 Hz. ${mel.frames.length} frames: ${mel.windowMs} ms Hann windows, ${mel.hopMs} ms steps. Dark purple: −100 dB or below; pale warm colours: stronger sound towards 0 dB. Relative digital levels, not physical loudness. Chunk boundaries are unchanged; N marks Noise regions without hiding their sound. Red line: playback position.`;
      canvas.setAttribute('aria-label',description.textContent+' Horizontal axis: time. Vertical axis: Mel frequency bands. Exact chunk times are in the table below.');
    }
    drawTimeline(canvas,ctx,L,R,spectrum,isChunk){
      const duration=this.samples.length/16,top=canvas.height-42,bottom=canvas.height-20;
      const x=ms=>L+Math.max(0,Math.min(duration,ms))/duration*(R-L);
      ctx.fillStyle='#eee7dc';ctx.fillRect(L,top,R-L,bottom-top);
      for(const c of this.pattern?.noiseChunks||[]){ctx.fillStyle='#ffffff';ctx.fillRect(x(c.startMs),top,x(c.endMs)-x(c.startMs),bottom-top);}
      for(const c of this.regions||[])if(c.type==='between-chunks'){ctx.fillStyle='#29965055';ctx.fillRect(x(c.startMs),top,x(c.endMs)-x(c.startMs),bottom-top);}
      if(isChunk){ctx.strokeStyle='#352c23';ctx.strokeRect(x(spectrum.startMs),top,x(spectrum.endMs)-x(spectrum.startMs),bottom-top);}
      ctx.strokeStyle='#b33237';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x(this.timeMs),top-4);ctx.lineTo(x(this.timeMs),bottom+3);ctx.stroke();ctx.lineWidth=1;
      ctx.fillStyle='#675a4d';ctx.font='12px system-ui';ctx.fillText(`Playback: ${Math.round(this.timeMs)} / ${Math.round(duration)} ms · green = between chunks${isChunk?' · outline = selected':''}`,L,top-7);
    }
    drawWaveform(){const {canvas,ctx,L,R,T,B}=this.prepare('waveform-graph','Sample amplitude vs time (mono, 16 kHz)');
      if(!this.samples){canvas.setAttribute('aria-label','No waveform yet');return;}
      const duration=this.samples.length/16,x=ms=>L+ms/duration*(R-L),y=v=>T+(1-v)/2*(B-T);
      for(const [i,c] of (this.pattern?.noiseChunks||[]).entries()){ctx.fillStyle='#ffffff';ctx.fillRect(x(c.startMs),T,x(c.endMs)-x(c.startMs),B-T);ctx.strokeStyle='#d8d2c9';ctx.strokeRect(x(c.startMs),T,x(c.endMs)-x(c.startMs),B-T);ctx.fillStyle='#675a4d';ctx.font='12px system-ui';ctx.fillText(`N${i+1} Noise`,x(c.startMs)+3,T+15);}
      for(const c of this.regions||[])if(c.type==='between-chunks'){ctx.fillStyle='#29965033';ctx.fillRect(x(c.startMs),T,x(c.endMs)-x(c.startMs),B-T);ctx.fillStyle='#20783e';ctx.font='12px system-ui';ctx.fillText(`B${c.gapIndex+1}`,x(c.startMs)+3,T+15);}
      for(const c of this.pattern?.chunks||[]){ctx.fillStyle={rising:'#28805a22',falling:'#c7832522',stable:'#397cb122'}[c.direction]||'#77777722';ctx.fillRect(x(c.startMs),T,x(c.endMs)-x(c.startMs),B-T);}
      for(const v of [-1,0,1]){ctx.strokeStyle='#dfd8ce';ctx.beginPath();ctx.moveTo(L,y(v));ctx.lineTo(R,y(v));ctx.stroke();ctx.fillStyle='#675a4d';ctx.fillText(String(v),18,y(v)+4);}
      // Min/max per screen pixel preserves short transients rather than skipping samples.
      ctx.strokeStyle='#352c23';ctx.beginPath();for(let pixel=0;pixel<R-L;pixel++){
        const start=Math.floor(pixel/(R-L)*this.samples.length),end=Math.max(start+1,Math.floor((pixel+1)/(R-L)*this.samples.length));let min=1,max=-1;
        for(let i=start;i<end;i++){min=Math.min(min,this.samples[i]);max=Math.max(max,this.samples[i]);}
        ctx.moveTo(L+pixel,y(max));ctx.lineTo(L+pixel,y(min));
      }ctx.stroke();for(let i=0;i<=5;i++){const ms=duration*i/5;ctx.fillText(`${Math.round(ms)} ms`,Math.min(R-58,x(ms)),canvas.height-12);}
      ctx.strokeStyle='#b33237';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x(Math.min(duration,this.timeMs)),T);ctx.lineTo(x(Math.min(duration,this.timeMs)),B);ctx.stroke();ctx.lineWidth=1;
      canvas.setAttribute('aria-label',`Waveform of ${Math.round(duration)} milliseconds. Amplitude ranges from minus one to one. Chunk times are listed below.`);
    }
    drawSpectrum(id,spectrum,title,isChunk){const {canvas,ctx,L,R,T}=this.prepare(id,`${title}: average Fourier spectrum`),B=canvas.height-105;
      const description=$(isChunk?'fft-chunk-summary':'fft-full-summary');
      if(!spectrum){description.textContent=isChunk?'Analyze a sound with detected chunks to inspect each chunk.':'Analyze a sound to see its frequencies.';canvas.setAttribute('aria-label','No frequency analysis yet');return;}
      const x=hz=>L+hz/8000*(R-L),y=value=>B-(Math.max(-100,Math.min(0,value))+100)/100*(B-T);
      for(let value=-100;value<=0;value+=20){ctx.strokeStyle='#dfd8ce';ctx.beginPath();ctx.moveTo(L,y(value));ctx.lineTo(R,y(value));ctx.stroke();ctx.fillStyle='#675a4d';ctx.fillText(`${value} dB`,5,y(value)+4);}
      for(let hz=0;hz<=8000;hz+=1000){ctx.fillText(`${hz/1000}k Hz`,Math.min(R-42,x(hz)),B+18);}
      ctx.strokeStyle=isChunk?'#28805a':'#397cb1';ctx.lineWidth=1.5;ctx.beginPath();spectrum.db.forEach((value,i)=>{if(i===0)ctx.moveTo(x(i*16000/2048),y(value));else ctx.lineTo(x(i*16000/2048),y(value));});ctx.stroke();ctx.lineWidth=1;
      const silent=spectrum.peakDb<=-99;
      description.textContent=`${title}: ${Math.round(spectrum.startMs)}–${Math.round(spectrum.endMs)} ms. ${silent?'No measurable frequency peak.':`Strongest non-DC FFT bin: ${Math.round(spectrum.peakHz)} Hz (${spectrum.peakDb.toFixed(1)} dB).`} Average Fourier power: ${spectrum.averageDb.toFixed(1)} dB${spectrum.chunkType==='closed'?' · Closed':''}. ${spectrum.frames} overlapping Hann-windowed frames. This peak is not necessarily the voice’s fundamental pitch.`;
      canvas.setAttribute('aria-label',description.textContent+' Frequency axis: zero to eight thousand Hz; level axis: minus one hundred to zero dB.');
      this.drawTimeline(canvas,ctx,L,R,spectrum,isChunk);
    }
  }
  root.SoundGraphs=SoundGraphs;
})(globalThis);
