/* Type 2: rectified amplitude envelope, independent of fundamental pitch. */
(function(root){
  'use strict';
  const presets={balanced:{windowMs:40,smoothingMs:50,slopeWindowMs:80,minimumChunkMs:80,relativeChangeThreshold:.025,absoluteChangeThreshold:.001},sensitive:{windowMs:30,smoothingMs:30,slopeWindowMs:60,minimumChunkMs:40,relativeChangeThreshold:.01,absoluteChangeThreshold:.0003},verySensitive:{windowMs:20,smoothingMs:10,slopeWindowMs:40,minimumChunkMs:30,relativeChangeThreshold:.005,absoluteChangeThreshold:.00015}};
  const parameters={sampleRate:16000,hopMs:10,maxChunkCount:300,...presets.sensitive};
  function omitLongStable(chunks,durationMs){
    const kept=[],omitted=[];
    for(const c of chunks){if(c.direction==='stable'&&c.endMs-c.startMs>durationMs*.075)omitted.push({...c,omissionReason:'Stable region longer than 7.5% of recording'});else kept.push(c);}
    return {chunks:kept,noiseChunks:omitted.map(c=>({...c,type:'noise'}))};
  }
  function analyze(samples,sensitivity='sensitive',deadZone=0){
    if(!Object.hasOwn(presets,sensitivity))throw Error('Unknown amplitude sensitivity.');
    if(!Number.isFinite(deadZone)||deadZone<0||deadZone>1)throw Error('Dead zone must be a number from 0 to 1.');
    const parameters={sampleRate:16000,hopMs:10,maxChunkCount:300,maximumStableDurationFraction:.075,sensitivity,deadZone,...presets[sensitivity]};
    const rate=parameters.sampleRate,hop=160,half=parameters.windowMs*rate/2000,raw=[];
    const smoothRadius=Math.floor(parameters.smoothingMs/parameters.hopMs/2),slopeRadius=parameters.slopeWindowMs/parameters.hopMs/2,minFrames=parameters.minimumChunkMs/parameters.hopMs;
    // Rectify every sample before averaging. No pitch detector is used here.
    for(let center=0;center<samples.length;center+=hop){
      const start=Math.max(0,center-half),end=Math.min(samples.length,center+half);let sum=0;
      for(let i=start;i<end;i++){const amplitude=Math.abs(samples[i]);if(amplitude>deadZone)sum+=amplitude;}raw.push(sum/Math.max(1,end-start));
    }
    const envelope=raw.map((_,i)=>{let sum=0,count=0;for(let j=Math.max(0,i-smoothRadius);j<=Math.min(raw.length-1,i+smoothRadius);j++){sum+=raw[j];count++;}return sum/count;});
    const peak=Math.max(0,...envelope),threshold=Math.max(parameters.absoluteChangeThreshold,peak*parameters.relativeChangeThreshold);
    const labels=envelope.map((_,i)=>{const delta=envelope[Math.min(envelope.length-1,i+slopeRadius)]-envelope[Math.max(0,i-slopeRadius)];return delta>threshold?'rising':delta< -threshold?'falling':'stable';});
    const runs=[];labels.forEach((direction,i)=>{const last=runs.at(-1);if(last?.direction===direction)last.end=i+1;else runs.push({direction,start:i,end:i+1});});
    // Absorb brief reversals into a neighbouring sustained run, not individual cycles.
    for(let i=0;i<runs.length&&runs.length>1;){
      if(runs[i].end-runs[i].start>=minFrames){i++;continue;}
      const left=runs[i-1],right=runs[i+1];
      if(left&&(!right||left.end-left.start>=right.end-right.start)){left.end=runs[i].end;runs.splice(i,1);i=Math.max(0,i-1);}
      else{right.start=runs[i].start;runs.splice(i,1);}
      for(let j=1;j<runs.length;j++)if(runs[j-1].direction===runs[j].direction){runs[j-1].end=runs[j].end;runs.splice(j--,1);}
    }
    // Bound report size on unusually noisy clips. Keep all time spans represented.
    while(runs.length>parameters.maxChunkCount){let i=0;for(let j=1;j<runs.length;j++)if(runs[j].end-runs[j].start<runs[i].end-runs[i].start)i=j;
      if(i===0){runs[1].start=runs[0].start;runs.shift();}else{runs[i-1].end=runs[i].end;runs.splice(i,1);}
    }
    const durationMs=samples.length/rate*1000;
    const chunks=runs.map((r,i)=>{const startMs=r.start*10,endMs=Math.min(durationMs,r.end*10),values=envelope.slice(r.start,r.end);
      return {direction:r.direction,startMs,endMs,durationMs:endMs-startMs,boundary:i?'Sustained amplitude direction change':'Start of recording',pitchRank:null,lengthRank:null,changeSemitones:null,
        averageAmplitude:values.reduce((a,b)=>a+b,0)/values.length,startAmplitude:values[0],endAmplitude:values.at(-1)};
    });
    return {method:'amplitude',parameters,...omitLongStable(chunks,durationMs),trace:envelope.map((amplitude,i)=>({timeMs:i*10,amplitude,rawAmplitude:raw[i]})),peakAmplitude:peak};
  }
  root.AmplitudeChunks={analyze,omitLongStable,parameters,presets};
})(globalThis);
