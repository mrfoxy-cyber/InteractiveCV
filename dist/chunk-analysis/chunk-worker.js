importScripts('../audio-tour-test/pitch-pattern.js?v=less-sensitive-3');
importScripts('chunk-pitch-stats.js?v=pitch-ranks-1');
onmessage=event=>{try{postMessage({pattern:ChunkPitchStats.add(PitchPattern.analyze(event.data,true))});}catch(error){postMessage({error:error.message,pattern:null});}};
