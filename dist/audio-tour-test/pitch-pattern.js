/* Pitch-direction chunks. All processing is local; distances are not probabilities. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.PitchPattern=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const rate=16000,windowSize=640,hop=160;
  const median=values=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.floor(sorted.length/2)];};
  const lengthTieTolerance=.2;
  function lengthRanks(chunks){
    const sorted=chunks.map((chunk,index)=>({length:chunk.durationMs,index})).sort((a,b)=>a.length-b.length),ranks=Array(chunks.length);let rank=0,groupMinimum=0;
    for(const item of sorted){
      if(!Number.isFinite(item.length)||item.length<=0)throw new Error('Invalid chunk duration.');
      // Compare to the shortest member of the tie group: do not chain ties indefinitely.
      if(!rank||item.length>groupMinimum*(1+lengthTieTolerance)){rank++;groupMinimum=item.length;}
      ranks[item.index]=rank;
    }
    return ranks;
  }
  const withLengthRanks=pattern=>{const ranks=lengthRanks(pattern.chunks);return {...pattern,version:2,lengthTieTolerance,chunks:pattern.chunks.map((chunk,i)=>({...chunk,lengthRank:ranks[i]}))};};
  function pitch(input,start){
    const frame=Array.from({length:windowSize},(_,i)=>input[start+i]);
    const mean=frame.reduce((a,b)=>a+b,0)/frame.length;for(let i=0;i<frame.length;i++)frame[i]-=mean;
    const correlations=[];let best=-1,bestLag=0;
    for(let lag=32;lag<=228;lag++){let product=0,a=0,b=0;for(let i=0;i<windowSize-lag;i++){product+=frame[i]*frame[i+lag];a+=frame[i]**2;b+=frame[i+lag]**2;}const correlation=product/Math.sqrt(Math.max(a*b,1e-20));correlations[lag]=correlation;if(correlation>best){best=correlation;bestLag=lag;}}
    if(best<.7)return null;
    // Prefer the first strong local peak to reduce subharmonic/octave errors.
    for(let lag=33;lag<228;lag++)if(correlations[lag]>.7&&correlations[lag]>=best*.94&&correlations[lag]>correlations[lag-1]&&correlations[lag]>=correlations[lag+1]){bestLag=lag;break;}
    const before=correlations[bestLag-1],center=correlations[bestLag],after=correlations[bestLag+1];
    const offset=Number.isFinite(before)&&Number.isFinite(after)?Math.max(-.5,Math.min(.5,.5*(before-after)/(before-2*center+after||1))):0;
    return 12*Math.log2((rate/(bestLag+offset))/220);
  }
  function analyze(input,diagnostics=false){
    if(!input||input.length<windowSize||input.length>rate*15)throw new Error('Use a short voiced sound, under 15 seconds.');
    const energies=[];for(let start=0;start+windowSize<=input.length;start+=hop){let energy=0;for(let i=0;i<windowSize;i++)energy+=input[start+i]**2;energies.push(Math.sqrt(energy/windowSize));}
    const peak=Math.max(...energies);if(peak<.001)throw new Error('No clear sound heard.');
    const frames=energies.map((energy,i)=>({timeMs:i*10,pitch:energy>Math.max(.001,peak*.12)?pitch(input,i*hop):null}));
    // Repair brief isolated tracker excursions only when pitch returns to its prior level.
    // A sustained new level or an unvoiced gap is never flattened by this filter.
    const cleaned=frames.map(f=>({...f,repaired:false}));
    for(let i=1;i<cleaned.length-1;i++){
      const left=cleaned[i-1].pitch;
      if(left===null||cleaned[i].pitch===null||Math.abs(cleaned[i].pitch-left)<=3.5)continue;
      let end=i;while(end<cleaned.length&&end-i<6&&cleaned[end].pitch!==null&&Math.abs(cleaned[end].pitch-left)>3.5)end++;
      if(end>=cleaned.length||cleaned[end].pitch===null||Math.abs(cleaned[end].pitch-left)>1)continue;
      const right=cleaned[end].pitch;
      for(let j=i;j<end;j++){cleaned[j].pitch=left+(right-left)*(j-i+1)/(end-i+1);cleaned[j].repaired=true;}
      i=end-1;
    }
    const smoothed=cleaned.map((frame,i)=>{if(frame.pitch===null)return frame;const nearby=cleaned.slice(Math.max(0,i-2),i+3).filter(f=>f.pitch!==null&&Math.abs(f.pitch-frame.pitch)<3).map(f=>f.pitch);return {...frame,pitch:median(nearby)};});
    const runs=[];let run=[];
    for(const frame of smoothed){if(frame.pitch===null){if(run.length){runs.push(run);run=[];}continue;}if(run.length&&Math.abs(frame.pitch-run[run.length-1].pitch)>3.5){runs.push(run);run=[];}run.push(frame);}if(run.length)runs.push(run);
    const chunks=[];
    const makeChunk=(values,boundary)=>{if(values.length<6)return;const first=values[0],last=values[values.length-1],change=last.pitch-first.pitch,durationMs=last.timeMs-first.timeMs+10,slope=change/(durationMs/1000);const chunk={direction:Math.abs(change)<1.2||Math.abs(slope)<3?'stable':slope>0?'rising':'falling',startMs:first.timeMs,endMs:last.timeMs+40,durationMs,changeSemitones:change,slopeSemitonesPerSecond:slope,startPitch:first.pitch,endPitch:last.pitch,boundary};const previous=chunks[chunks.length-1];if(previous&&boundary==='direction change'&&previous.direction===chunk.direction){previous.endMs=chunk.endMs;previous.durationMs=previous.endMs-previous.startMs-30;previous.endPitch=chunk.endPitch;previous.changeSemitones=previous.endPitch-previous.startPitch;previous.slopeSemitonesPerSecond=previous.changeSemitones/(previous.durationMs/1000);}else chunks.push(chunk);};
    for(let r=0;r<runs.length;r++){
      const values=runs[r];if(values.length<6)continue;let start=0,direction=null,candidate=null,candidateStart=0,candidateCount=0;
      const previous=r?runs[r-1][runs[r-1].length-1]:null;
      let boundary=!previous?'start':values[0].timeMs-previous.timeMs<=80&&Math.abs(values[0].pitch-previous.pitch)>3.5?'pitch jump':'pause';
      for(let i=12;i<values.length;i++){
        const slope=(values[i].pitch-values[i-12].pitch)/.12,next=Math.abs(slope)<4?'stable':slope>0?'rising':'falling';
        if(direction===null){direction=next;continue;}
        if(next===direction){candidate=null;candidateCount=0;continue;}
        if(candidate!==next){candidate=next;candidateStart=Math.max(start+12,i-6);candidateCount=1;}else candidateCount++;
        if(candidateCount>=8&&candidateStart-start>=12){makeChunk(values.slice(start,candidateStart),boundary);start=candidateStart;boundary='direction change';direction=next;candidate=null;candidateCount=0;}
      }
      makeChunk(values.slice(start),boundary);
    }
    if(!chunks.length)throw new Error('No reliable pitch pattern detected. Try a clear voiced “la” or humming sound.');
    const origin=chunks[0].startPitch,startMs=chunks[0].startMs;
    for(let i=0;i<chunks.length;i++){const chunk=chunks[i];chunk.relativeStartSemitones=chunk.startPitch-origin;chunk.transition=i?chunk.startPitch-chunks[i-1].endPitch:0;chunk.gapMs=i?Math.max(0,chunk.startMs-chunks[i-1].endMs):0;}
    const result=withLengthRanks({durationMs:chunks[chunks.length-1].endMs-startMs,chunks});
    if(diagnostics){result.trace=smoothed.map((frame,i)=>({timeMs:frame.timeMs,pitchHz:frame.pitch===null?null:220*2**(frame.pitch/12),rawPitchHz:frames[i].pitch===null?null:220*2**(frames[i].pitch/12),pitchSemitones:frame.pitch,rms:energies[i],repaired:frame.repaired}));result.repairedFrames=cleaned.filter(f=>f.repaired).length;}
    return result;
  }
  function distance(a,b){
    const x=a.chunks,y=b.chunks;if(!x.length||!y.length)return Infinity;
    const ranksA=lengthRanks(x),ranksB=lengthRanks(y),rankRange=Math.max(1,...ranksA,...ranksB)-1||1;
    let previous=Array.from({length:y.length+1},(_,i)=>i);
    const direction=change=>Math.abs(change)<.8?0:change>0?1:-1;
    for(let i=1;i<=x.length;i++){const row=[i];for(let j=1;j<=y.length;j++){
      const p=x[i-1],q=y[j-1];
      const cost=(p.direction===q.direction?0:.65)+.2*Math.min(2,Math.abs(p.changeSemitones-q.changeSemitones)/4)+.35*(direction(p.transition)===direction(q.transition)?0:1)+.2*Math.abs(ranksA[i-1]-ranksB[j-1])/rankRange+.15*Math.min(1,Math.abs(p.gapMs/a.durationMs-q.gapMs/b.durationMs)*3);
      row[j]=Math.min(previous[j]+1,row[j-1]+1,previous[j-1]+cost);
    }previous=row;}
    return previous[y.length]/Math.max(x.length,y.length)+.2*Math.abs(x.length-y.length);
  }
  function recognize(pattern,bank){
    pattern=withLengthRanks(pattern);
    const best=new Map();for(const t of bank.templates){if(!t.pattern)continue;const score=distance(pattern,t.pattern);if(score<(best.get(t.id)??Infinity))best.set(t.id,score);}
    const alternatives=[...best].map(([id,score])=>({id,score})).sort((a,b)=>a.score-b.score),first=alternatives[0],second=alternatives[1];
    if(!first)return {accepted:false,reason:'No taught pitch patterns in this group. Record examples or retrain saved sounds.',pattern};
    const group=bank.templates.filter(t=>t.id===first.id&&t.pattern),pairs=[];for(let i=0;i<group.length;i++)for(let j=i+1;j<group.length;j++)pairs.push(distance(group[i].pattern,group[j].pattern));
    const limit=pairs.length?Math.min(.7,Math.max(.25,median(pairs)*1.5)):.4;
    const margin=second?second.score-first.score:1;
    return {...first,accepted:first.score<=limit&&margin>=.08,reason:first.score>limit?'Pitch chunks differ too much from the examples.':margin<.08?'Two commands have similar pitch chunk patterns.':'Pitch pattern match.',pattern,alternatives:alternatives.slice(0,3)};
  }
  return {analyze,distance,recognize,lengthRanks,withLengthRanks,lengthTieTolerance};
});
