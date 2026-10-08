(function(root){
  'use strict';
  const settings={method:'amplitude',sensitivity:'sensitive',deadZone:0.075};
  const key=c=>JSON.stringify(c);
  function config(t){const p=t.parameters||{};return {method:t.chunkingMethod==='amplitude'?'amplitude':'pitch',sensitivity:p.sensitivity||'sensitive',deadZone:Number.isFinite(p.deadZone)?p.deadZone:0};}
  function distance(a,b){
    if(!a?.vector||!b?.vector||a.vector.length!==24||b.vector.length!==24||!a.vector.every(Number.isFinite)||!b.vector.every(Number.isFinite))return null;
    let delta=0,scale=0;for(let i=0;i<24;i++){delta+=(a.vector[i]-b.vector[i])**2;scale+=(a.vector[i]**2+b.vector[i]**2)/2;}
    return Math.sqrt(delta/Math.max(1,scale));
  }
  const type=c=>c.chunkType||c.direction;
  function align(a,b,acoustic=false){
    const dp=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));
    for(let i=0;i<=a.length;i++)dp[i][0]=i;for(let j=0;j<=b.length;j++)dp[0][j]=j;
    const cost=(x,y)=>acoustic?.6*Math.min(1,distance(x.fingerprint,y.fingerprint)??1)+.4*Number(type(x)!==type(y)):Number(type(x)!==type(y));
    for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)dp[i][j]=Math.min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+cost(a[i-1],b[j-1]));
    const pairs=[];let i=a.length,j=b.length;
    while(i||j){if(i&&j&&Math.abs(dp[i][j]-dp[i-1][j-1]-cost(a[i-1],b[j-1]))<1e-8)pairs.push([--i,--j]);else if(i&&Math.abs(dp[i][j]-dp[i-1][j]-1)<1e-8)pairs.push([--i,null]);else pairs.push([null,--j]);}
    return {distance:dp[a.length][b.length]/Math.max(1,a.length,b.length),pairs:pairs.reverse()};
  }
  const sequenceDistance=(a,b)=>align(a,b).distance;
  function average(fps){const valid=fps.filter(f=>distance(f,f)!==null);if(!valid.length)return null;return {vector:Array.from({length:24},(_,i)=>valid.reduce((s,f)=>s+f.vector[i],0)/valid.length)};}
  function chunksOf(t){return t.chunks.map(c=>({...c,fingerprint:t.regionFingerprints?.find(r=>r.type==='pitch'&&Math.abs(r.startMs-c.startMs)<.01&&Math.abs(r.endMs-c.endMs)<.01)?.fingerprint||c.fingerprint||null}));}
  function buildReferences(templates){
    const groups=new Map();let skipped=0,duplicates=0;
    for(const original of templates){const t=original.normalizedBlueprint||original;
      if(key(config(t))!==key(settings)||distance(t.recordingFingerprint,t.recordingFingerprint)===null||!t.chunks?.length){skipped++;continue;}
      const name=String(original.name||'Unnamed'),examples=groups.get(name)||new Map(),identity=t.audioHash||original.id;
      if(examples.has(identity)){duplicates++;continue;}examples.set(identity,{...t,id:original.id,chunks:chunksOf(t)});groups.set(name,examples);
    }
    const references=[];
    for(const [name,group] of groups){const examples=[...group.values()];
      // Use a central real sequence as the scaffold, then align before averaging.
      const central=examples.reduce((best,t)=>{const score=examples.reduce((s,x)=>s+align(t.chunks,x.chunks,true).distance,0);return !best||score<best.score?{t,score}:best;},null).t;
      const slots=central.chunks.map(c=>[c]);
      for(const t of examples)if(t!==central)for(const [i,j] of align(central.chunks,t.chunks,true).pairs)if(i!==null&&j!==null)slots[i].push(t.chunks[j]);
      const chunks=slots.map((slot,i)=>{const counts=new Map();slot.forEach(c=>counts.set(type(c),(counts.get(type(c))||0)+1));const chunkType=[...counts].sort((a,b)=>b[1]-a[1])[0][0];return {index:i,chunkType,fingerprint:average(slot.map(c=>c.fingerprint)),support:slot.length};});
      references.push({schemaVersion:1,kind:'command-reference-blueprint',name,id:'reference:'+name,chunkingMethod:settings.method,parameters:{sensitivity:settings.sensitivity,deadZone:settings.deadZone},chunks,recordingFingerprint:average(examples.map(t=>t.recordingFingerprint)),exampleCount:examples.length,sourceIds:examples.map(t=>t.id),scaffoldId:central.id});
    }
    return {references,skipped,duplicates};
  }
  function rank(templates,queries){
    const library=buildReferences(templates),q=queries.get(key(settings)),queryChunks=q?chunksOf({chunks:q.pattern?.chunks||[],regionFingerprints:q.frequency?.mfcc?.chunks}):[],ranked=[];
    for(const reference of library.references){const shape=distance(q?.frequency?.mfcc?.recordingFingerprint,reference.recordingFingerprint);if(shape===null)continue;
      const sequence=sequenceDistance(queryChunks,reference.chunks),ordered=align(queryChunks,reference.chunks,true).distance,count=Math.abs(queryChunks.length-reference.chunks.length)/Math.max(1,queryChunks.length,reference.chunks.length);
      ranked.push({name:reference.name,id:reference.id,score:.35*shape+.45*ordered+.15*sequence+.05*count,shapeDistance:shape,sequenceDistance:sequence,orderedDistance:ordered,countDistance:count,chunkCount:reference.chunks.length,exampleCount:reference.exampleCount});
    }
    return {ranked:ranked.sort((a,b)=>a.score-b.score),examples:library.references.reduce((s,r)=>s+r.exampleCount,0),skipped:library.skipped,duplicates:library.duplicates,references:library.references};
  }
  root.CommandMatcher={settings,config,key,distance,sequenceDistance,align,buildReferences,rank};
})(typeof globalThis!=='undefined'?globalThis:this);
