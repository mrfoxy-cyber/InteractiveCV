/* Experimental MFCCs: orthonormal DCT-II of natural-log Mel power. */
(function(root){
  'use strict';
  function coefficients(db,count=13){
    const n=db.length;
    return Array.from({length:Math.min(count,n)},(_,k)=>{
      const sum=db.reduce((total,value,b)=>total+value*Math.LN10/10*Math.cos(Math.PI*k*(b+.5)/n),0);
      return sum*Math.sqrt((k===0?1:2)/n);
    });
  }
  function fingerprint(frames){
    if(!frames.length)return null;
    const mean=Array.from({length:12},(_,i)=>frames.reduce((sum,f)=>sum+f.coefficients[i+1],0)/frames.length);
    const std=mean.map((m,i)=>Math.sqrt(frames.reduce((sum,f)=>sum+(f.coefficients[i+1]-m)**2,0)/frames.length));
    return {frameCount:frames.length,mean,std,vector:[...mean,...std]};
  }
  function analyze(mel,regions,measureRegion){
    const convert=m=>m.frames.map(f=>({startMs:f.startMs,coefficients:coefficients(f.db)}));
    const frames=convert(mel),active=[];
    const chunks=regions.map((c,regionIndex)=>{
      // Recalculate inside exact boundaries: no neighboring chunk audio leaks in.
      const local=convert(measureRegion(c));
      if(c.type==='pitch'&&c.chunkType!=='closed')active.push(...local);
      return {regionIndex,startMs:c.startMs,endMs:c.endMs,type:c.type,chunkType:c.chunkType||c.direction,
        fingerprint:fingerprint(local)};
    });
    return {version:1,method:'13 MFCCs: natural-log Mel power, orthonormal DCT-II, no liftering',
      coefficientCount:13,hopMs:mel.hopMs,windowMs:mel.windowMs,frames,chunks,
      fingerprintDefinition:'24 values: mean C1–C12 then population standard deviation C1–C12. C0 excluded to reduce overall volume influence; not fully volume/speaker invariant.',
      recordingScope:'Regular non-Closed chunks only; Noise and Between chunks excluded. Empty scope has no fingerprint.',
      recordingFingerprint:fingerprint(active)};
  }
  root.MfccAnalysis={analyze,coefficients,fingerprint};
})(typeof globalThis!=='undefined'?globalThis:this);
