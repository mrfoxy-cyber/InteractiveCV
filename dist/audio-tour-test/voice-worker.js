importScripts('voice-matcher.js?v=sound-retraining-2');
importScripts('pitch-pattern.js?v=less-sensitive-3');
importScripts('../chunk-analysis/chunk-pitch-stats.js?v=pitch-ranks-1');
importScripts('../chunk-analysis/chunk-comparator.js?v=1','hybrid-matcher.js?v=1');
const chunkPattern=samples=>{const full=ChunkPitchStats.add(PitchPattern.analyze(samples,true));const {trace,...compact}=full;return compact;};
let bank=null;
onmessage=event=>{
  const {id,type}=event.data;
  try {
    if(type==='init') {bank=event.data.bank;postMessage({id,result:{ready:true}});return;}
    if(type==='rebuild'){bank=VoiceMatcher.rebuild(event.data.bank);postMessage({id,result:bank});return;}
    if(!bank)throw new Error('Command templates are not ready.');
    if(type==='train'){
      if(!bank.commands.some(command=>command.id===event.data.commandId))throw new Error('Choose a known command.');
      const frames=VoiceMatcher.features(event.data.samples,true);let pattern=null;
      try{pattern=chunkPattern(event.data.samples);}catch(error){if(event.data.mode==='pitch'||event.data.mode==='hybrid')throw error;}
      postMessage({id,result:{pattern,rawFrames:frames,frames:VoiceMatcher.normalize(frames,bank.scale).map(frame=>frame.map(value=>Math.round(value*1000)/1000))}});return;
    }
    const allowed=event.data.allowedIds;
    const scoped=Array.isArray(allowed)?{...bank,templates:bank.templates.filter(template=>allowed.includes(template.id))}:bank;
    if(event.data.mode==='hybrid'){postMessage({id,result:HybridMatcher.recognize(chunkPattern(event.data.samples),VoiceMatcher.features(event.data.samples,true),scoped)});return;}
    if(event.data.mode==='pitch'){postMessage({id,result:PitchPattern.recognize(chunkPattern(event.data.samples),scoped)});return;}
    const result=VoiceMatcher.recognize(VoiceMatcher.features(event.data.samples,true),scoped);
    try{result.pattern=chunkPattern(event.data.samples);}catch{result.pattern=null;}
    postMessage({id,result});
  }catch(error){postMessage({id,error:error.message});}
};
