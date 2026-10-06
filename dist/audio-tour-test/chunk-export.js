/* Small portable command pattern: no waveform, frequency values or recording data. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ChunkExport=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function create(pattern,metadata={}){
    if(!pattern||!Array.isArray(pattern.chunks)||!pattern.chunks.length)throw Error('No detected chunks to export.');
    return {schemaVersion:1,kind:'command-chunk-pattern',comparisonOrder:['chunkCount','orderedChunkTypes','pitchRanks'],createdAt:new Date().toISOString(),commandId:metadata.commandId||null,commandLabel:metadata.commandLabel||null,source:metadata.source||'test',chunkCount:pattern.chunks.length,chunks:pattern.chunks.map((c,i)=>({index:i+1,type:c.type||c.direction,pitchRank:Number.isInteger(c.pitchRank)?c.pitchRank:null,lengthRank:c.lengthRank??null,startMs:c.startMs,endMs:c.endMs})),note:'Compare count, ordered types and relative pitch ranks. Times are playback references, not matching criteria. A test export is not a confirmed command label.'};
  }
  return {create};
});
