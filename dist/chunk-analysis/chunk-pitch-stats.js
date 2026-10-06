/* Analysis-only pitch statistics. Rank 1 is the lowest mean; equal rounded means tie. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ChunkPitchStats=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function add(pattern){
    const chunks=pattern.chunks.map(chunk=>{
      // Frame-count interval, not the overlapping 40 ms window tail.
      const values=(pattern.trace||[]).filter(frame=>frame.timeMs>=chunk.startMs&&frame.timeMs<chunk.startMs+chunk.durationMs&&Number.isFinite(frame.pitchHz)&&frame.pitchHz>0).map(frame=>frame.pitchHz);
      const mean=values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
      return {...chunk,averagePitchHz:mean===null?null:Math.round(mean*10)/10,pitchFrameCount:values.length};
    });
    const levels=[...new Set(chunks.map(c=>c.averagePitchHz).filter(Number.isFinite))].sort((a,b)=>a-b);
    return {...pattern,pitchRankRule:'Lowest average Hz is rank 1; equal averages rounded to 0.1 Hz share a rank. Unpitched chunks have no pitch rank.',chunks:chunks.map(c=>({...c,pitchRank:c.averagePitchHz===null?null:levels.indexOf(c.averagePitchHz)+1}))};
  }
  return {add};
});
