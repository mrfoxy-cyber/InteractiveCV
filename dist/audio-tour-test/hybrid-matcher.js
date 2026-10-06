/* Chunk shortlist first; frequency templates make the final decision. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./chunk-comparator.js'),require('./voice-matcher.js'));else root.HybridMatcher=factory(root.ChunkComparator,root.VoiceMatcher);})(typeof globalThis!=='undefined'?globalThis:this,function(Chunks,Frequency){
  'use strict';
  const order=(a,b)=>a.countDifference-b.countDifference||a.typeDifference-b.typeDifference||a.rankDifference-b.rankDifference;
  function shortlist(pattern,bank){
    const input=Chunks.signature(pattern),best=new Map();
    for(const template of bank.templates){
      if(!template.pattern?.chunks?.length||!template.pattern.chunks.every(c=>Number.isInteger(c.pitchRank)))continue;
      const reference=Chunks.signature(template.pattern),size=Math.max(input.count,reference.count);
      let types=0,ranks=0;
      for(let i=0;i<size;i++){const a=input.chunks[i],b=reference.chunks[i];if(!a||!b){types++;ranks++;continue;}if(a.type!==b.type)types++;if(a.pitchRank!==b.pitchRank)ranks++;}
      const candidate={id:template.id,countDifference:Math.abs(input.count-reference.count),typeDifference:types/size,rankDifference:ranks/size};
      if(!best.has(template.id)||order(candidate,best.get(template.id))<0)best.set(template.id,candidate);
    }
    return [...best.values()].sort(order).slice(0,3);
  }
  function recognize(pattern,frames,bank,matcher=Frequency){
    const candidates=shortlist(pattern,bank);
    if(!candidates.length)return {accepted:false,pattern,chunkCandidates:[],reason:'No ranked chunk examples in this group. Retrain saved sounds or use Listen and save first.'};
    const ids=new Set(candidates.map(c=>c.id));
    const result=matcher.recognize(frames,{...bank,templates:bank.templates.filter(t=>ids.has(t.id))});
    return {...result,pattern,chunkCandidates:candidates,method:'hybrid-chunks-frequency'};
  }
  return {shortlist,recognize};
});
