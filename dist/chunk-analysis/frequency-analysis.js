/* Local, dependency-free FFT measurements. Also usable by Node tests. */
(function(root){
  'use strict';
  const sampleRate=16000, fftSize=2048, hopSize=320;
  function fftPower(samples,start=0,end=samples.length){
    const re=new Float64Array(fftSize),im=new Float64Array(fftSize);
    let windowSum=0;
    for(let i=0;i<fftSize;i++){
      const w=.5-.5*Math.cos(2*Math.PI*i/(fftSize-1));windowSum+=w;
      re[i]=(start+i<end?samples[start+i]:0)*w;
    }
    for(let i=1,j=0;i<fftSize;i++){
      let bit=fftSize>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;
      if(i<j){const t=re[i];re[i]=re[j];re[j]=t;}
    }
    for(let len=2;len<=fftSize;len<<=1){
      const angle=-2*Math.PI/len,cr=Math.cos(angle),ci=Math.sin(angle);
      for(let base=0;base<fftSize;base+=len){let wr=1,wi=0;
        for(let j=0;j<len/2;j++){
          const a=base+j,b=a+len/2,tr=wr*re[b]-wi*im[b],ti=wr*im[b]+wi*re[b];
          re[b]=re[a]-tr;im[b]=im[a]-ti;re[a]+=tr;im[a]+=ti;
          const next=wr*cr-wi*ci;wi=wr*ci+wi*cr;wr=next;
        }
      }
    }
    return Array.from({length:fftSize/2+1},(_,i)=>(re[i]**2+im[i]**2)*(i===0||i===fftSize/2?1:4)/windowSum**2);
  }
  const db=power=>Math.max(-100,10*Math.log10(Math.max(power,1e-10)));
  function spectrum(samples,start=0,end=samples.length){
    const sum=new Float64Array(fftSize/2+1);let frames=0;
    // Include the final partial frame, zero-padded, without reading outside this chunk.
    for(let offset=start;offset<end;offset+=hopSize){
      const power=fftPower(samples,offset,end);for(let i=0;i<sum.length;i++)sum[i]+=power[i];frames++;
    }
    // Average linear power across non-DC bins and frames BEFORE converting to dB.
    // Do not average the plotted dB values or their -100 dB display floor.
    const averagePower=sum.slice(1).reduce((total,p)=>total+p,0)/(Math.max(1,frames)*(sum.length-1));
    const averageDb=10*Math.log10(Math.max(averagePower,1e-30));
    const values=Array.from(sum,p=>Number(db(p/Math.max(1,frames)).toFixed(2)));
    let peak=1;for(let i=2;i<values.length;i++)if(values[i]>values[peak])peak=i;
    return {frames,averagePower,averageDb,db:values,peakHz:peak*sampleRate/fftSize,peakDb:values[peak],startMs:start/sampleRate*1000,endMs:end/sampleRate*1000};
  }
  function regions(chunks,durationMs,omitted=[]){
    const list=[];let covered=0,gapIndex=0;
    const gap=(startMs,endMs)=>{if(endMs>startMs)list.push({type:'between-chunks',direction:'between chunks',gapIndex:gapIndex++,startMs,endMs,durationMs:endMs-startMs});};
    [...chunks.map((c,pitchIndex)=>({...c,pitchIndex,omitted:false})),...omitted.map(c=>({...c,omitted:true}))].sort((a,b)=>a.startMs-b.startMs).forEach(c=>{
      const startMs=Math.max(0,Math.min(durationMs,c.startMs)),endMs=Math.max(startMs,Math.min(durationMs,c.endMs));
      gap(covered,startMs);
      if(endMs>startMs&&!c.omitted)list.push({...c,type:'pitch',startMs,endMs});
      covered=Math.max(covered,endMs);
    });gap(covered,durationMs);return list;
  }
  function analyze(samples,chunks=[],omitted=[]){
    const measured=regions(chunks,samples.length/sampleRate*1000,omitted).map(c=>({...c,...spectrum(samples,
      Math.max(0,Math.floor(c.startMs*sampleRate/1000)),Math.min(samples.length,Math.ceil(c.endMs*sampleRate/1000)))}));
    for(const c of measured)if(c.type==='pitch')c.chunkType=c.averageDb < -90?'closed':c.direction;
    const mel=root.MelAnalysis.analyze(samples,fftPower,sampleRate,fftSize,hopSize);
    const mfcc=root.MfccAnalysis.analyze(mel,measured,c=>root.MelAnalysis.analyze(
      samples.subarray(Math.max(0,Math.floor(c.startMs*16)),Math.min(samples.length,Math.ceil(c.endMs*16))),fftPower,sampleRate,fftSize,hopSize));
    return {sampleRate,fftSize,hopSize,window:'Hann',binWidthHz:sampleRate/fftSize,
      closedThresholdDb:-90,averageDefinition:'Mean linear power across non-DC FFT bins (7.8125–8000 Hz) and frames, then converted to dB; strict below threshold',
      scale:'dB relative to a full-scale sine; averaged window power, not calibrated acoustic loudness',
      whole:spectrum(samples),chunks:measured.filter(c=>c.type==='pitch'),regions:measured,
      mel,mfcc};
  }
  root.FrequencyAnalysis={analyze,spectrum,fftPower,regions,sampleRate,fftSize};
})(typeof globalThis!=='undefined'?globalThis:this);
