/* Small pattern-comparison experiment: count, ordered types, then relative ranks. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ChunkComparator=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function signature(pattern){
    if(!pattern||!Array.isArray(pattern.chunks)||!pattern.chunks.length)throw Error('A detected chunk pattern is required.');
    return {count:pattern.chunks.length,chunks:pattern.chunks.map(c=>({type:c.type||c.direction,pitchRank:Number.isInteger(c.pitchRank)?c.pitchRank:null}))};
  }
  function compare(reference,candidate){
    const a=signature(reference),b=signature(candidate),sameCount=a.count===b.count;
    if(!sameCount)return {sameCount:false,referenceCount:a.count,candidateCount:b.count,structureMatch:false,rankMatch:null,typeDifferences:[],rankDifferences:[]};
    const typeDifferences=[],rankDifferences=[];
    let ranksAvailable=true;
    a.chunks.forEach((chunk,i)=>{const other=b.chunks[i];if(chunk.type!==other.type)typeDifferences.push({chunk:i+1,reference:chunk.type,candidate:other.type});if(chunk.pitchRank===null||other.pitchRank===null){ranksAvailable=false;return;}if(chunk.pitchRank!==other.pitchRank)rankDifferences.push({chunk:i+1,reference:chunk.pitchRank,candidate:other.pitchRank});});
    return {sameCount:true,referenceCount:a.count,candidateCount:b.count,structureMatch:typeDifferences.length===0,rankMatch:ranksAvailable?rankDifferences.length===0:null,typeDifferences,rankDifferences};
  }
  return {signature,compare};
});
