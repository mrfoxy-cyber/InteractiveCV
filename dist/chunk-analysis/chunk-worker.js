importScripts('../audio-tour-test/pitch-pattern.js?v=less-sensitive-3');
importScripts('chunk-pitch-stats.js?v=pitch-ranks-1');
importScripts('mel-analysis.js?v=1');
importScripts('mfcc-analysis.js?v=1');
importScripts('frequency-analysis.js?v=mfcc-1');
importScripts('amplitude-chunks.js?v=omit-long-stable-1');
onmessage=event=>{
  const samples=event.data.samples||event.data,method=event.data.method||'pitch';
  let pattern=null,error=null;
  try{pattern=method==='amplitude'?AmplitudeChunks.analyze(samples,event.data.sensitivity||'sensitive',event.data.deadZone??0):ChunkPitchStats.add(PitchPattern.analyze(samples,true));}catch(e){error=e.message;}
  try{
    const frequency=FrequencyAnalysis.analyze(samples,pattern?.chunks||[],pattern?.noiseChunks||[]);
    for(const c of frequency.chunks)Object.assign(pattern.chunks[c.pitchIndex],{chunkType:c.chunkType,averageFourierDb:c.averageDb});
    postMessage({pattern,error,method,frequency});
  }
  catch(e){postMessage({pattern,error:error||e.message,frequency:null});}
};
