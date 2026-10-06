/* Local isolated-command recognition: MFCC features and dynamic time warping. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.VoiceMatcher=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const rate=16000,size=512,windowSize=400,hop=160,bands=26,dimensions=12;
  const window=Float64Array.from({length:windowSize},(_,i)=>.54-.46*Math.cos(2*Math.PI*i/(windowSize-1)));
  const mel=x=>2595*Math.log10(1+x/700), hz=x=>700*(10**(x/2595)-1);
  const edges=Array.from({length:bands+2},(_,i)=>Math.floor((size+1)*hz(mel(80)+(mel(7600)-mel(80))*i/(bands+1))/rate));
  function power(samples,start){
    const real=new Float64Array(size),imag=new Float64Array(size);
    for(let i=0;i<windowSize;i++)real[i]=((samples[start+i]||0)-.97*(samples[start+i-1]||0))*window[i];
    for(let i=1,j=0;i<size;i++){let bit=size>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j)[real[i],real[j]]=[real[j],real[i]];}
    for(let length=2;length<=size;length*=2){const angle=-2*Math.PI/length;for(let offset=0;offset<size;offset+=length)for(let j=0;j<length/2;j++){const a=offset+j,b=a+length/2,c=Math.cos(angle*j),s=Math.sin(angle*j),r=real[b]*c-imag[b]*s,v=real[b]*s+imag[b]*c;real[b]=real[a]-r;imag[b]=imag[a]-v;real[a]+=r;imag[a]+=v;}}
    return Array.from({length:size/2+1},(_,i)=>real[i]*real[i]+imag[i]*imag[i]);
  }
  function features(input,allowTones=false){
    if(!input||input.length<windowSize||input.length>rate*15)throw new Error('Use one command, shorter than 15 seconds.');
    const rms=[];for(let start=0;start+windowSize<=input.length;start+=hop){let e=0;for(let j=0;j<windowSize;j++)e+=input[start+j]**2;rms.push(Math.sqrt(e/windowSize));}
    const peak=Math.max(...rms);if(peak<.001)throw new Error('No clear speech heard. Please try again.');
    const gate=Math.max(.001,peak*.12),active=rms.map((e,i)=>e>gate?i:-1).filter(i=>i>=0);
    if(active.length<8)throw new Error('The recording is too short or quiet.');
    const first=Math.max(0,active[0]-5),last=Math.min(rms.length-1,active[active.length-1]+5);
    if(last-first>600)throw new Error('Say just one command, not a sentence.');
    const frames=[];let flatness=0,narrowness=0;
    for(let frame=first;frame<=last;frame++){
      const spectrum=power(input,frame*hop), logs=[];
      // Undo pre-emphasis for noise-flatness measurement, not for MFCCs.
      const bins=spectrum.slice(3,244).map((v,i)=>v/(1+.97**2-1.94*Math.cos(2*Math.PI*(i+3)/size)));const arithmetic=bins.reduce((s,v)=>s+v,0)/bins.length;
      flatness+=Math.exp(bins.reduce((s,v)=>s+Math.log(Math.max(v,1e-12)),0)/bins.length)/Math.max(arithmetic,1e-12);
      const strongest=bins.indexOf(Math.max(...bins));narrowness+=(bins[strongest]+(bins[strongest-1]||0)+(bins[strongest+1]||0))/Math.max(bins.reduce((s,v)=>s+v,0),1e-12);
      for(let b=0;b<bands;b++){let energy=0;for(let k=edges[b];k<edges[b+2];k++){const weight=k<edges[b+1]?(k-edges[b])/Math.max(1,edges[b+1]-edges[b]):(edges[b+2]-k)/Math.max(1,edges[b+2]-edges[b+1]);energy+=spectrum[k]*weight;}logs.push(Math.log(Math.max(energy,1e-12)));}
      frames.push(Array.from({length:dimensions},(_,c)=>logs.reduce((sum,x,b)=>sum+x*Math.cos(Math.PI*(c+1)*(b+.5)/bands),0)*Math.sqrt(2/bands)));
    }
    if(flatness/frames.length>.45)throw new Error('This sounds like steady noise, not a clear spoken command.');
    if(!allowTones&&narrowness/frames.length>.97)throw new Error('This sounds like a steady tone, not a spoken command.');
    const result=frames.map((frame,i)=>[...frame,...frame.map((_,c)=>(frames[Math.min(frames.length-1,i+2)][c]-frames[Math.max(0,i-2)][c])/4)]);
    const middle=result.slice(5,-5);
    if(!allowTones&&middle.length&&middle.reduce((sum,frame)=>sum+frame.slice(dimensions).reduce((s,v)=>s+Math.abs(v),0),0)/(middle.length*dimensions)<.03)throw new Error('This sounds like a steady tone, not a spoken command.');
    return result;
  }
  const normalize=(frames,scale)=>frames.map(frame=>frame.map((value,i)=>(value-scale.mean[i])/scale.std[i]));
  function distance(a,b){
    const n=a.length,m=b.length;if(n/m<.4||n/m>2.5)return Infinity;
    let previous=new Float64Array(m+1).fill(Infinity);previous[0]=0;
    const band=Math.max(Math.abs(n-m)+2,Math.ceil(Math.max(n,m)*.35));
    for(let i=1;i<=n;i++){const row=new Float64Array(m+1).fill(Infinity);for(let j=Math.max(1,i-band);j<=Math.min(m,i+band);j++){
      let cost=0;for(let k=0;k<a[i-1].length;k++)cost+=(a[i-1][k]-b[j-1][k])**2;cost=Math.sqrt(cost/a[i-1].length);
      row[j]=Math.min(previous[j-1]+2*cost,previous[j]+cost,row[j-1]+cost);
    }previous=row;}return previous[m]/(n+m);
  }
  function rank(frames,bank){
    const input=normalize(frames,bank.scale), best=new Map();
    for(const template of bank.templates){const score=distance(input,template.frames);if(score<(best.get(template.id)??Infinity))best.set(template.id,score);}
    return [...best].map(([id,score])=>({id,score})).sort((a,b)=>a.score-b.score);
  }
  function recognize(frames,bank){
    const ranked=rank(frames,bank),best=ranked[0],second=ranked[1];if(!best||!Number.isFinite(best.score))return {accepted:false,reason:'No compatible command template.'};
    const margin=second?(second.score-best.score)/Math.max(second.score,.001):1;
    const limit=bank.thresholds[best.id]??bank.maxDistance;
    return {...best,margin,accepted:best.score<=limit&&margin>=bank.minMargin,reason:best.score>limit?'Too different from the recorded templates.':margin<bank.minMargin?'Two commands sound too similar.':'Template match.',alternatives:ranked.slice(0,3)};
  }
  function rebuild(bank){
    const templates=bank.templates.map(t=>({...t,rawFrames:t.rawFrames||t.frames.map(frame=>frame.map((v,i)=>v*bank.scale.std[i]+bank.scale.mean[i]))}));
    if(!templates.length)return {...bank,thresholds:{},featureVersion:2};
    const mean=Array(24).fill(0),std=Array(24).fill(0);let count=0;
    for(const t of templates)for(const f of t.rawFrames){count++;f.forEach((v,i)=>mean[i]+=v);}
    mean.forEach((v,i)=>mean[i]=v/count);
    for(const t of templates)for(const f of t.rawFrames)f.forEach((v,i)=>std[i]+=(v-mean[i])**2);
    std.forEach((v,i)=>std[i]=Math.max(.3,Math.sqrt(v/count)));
    for(const t of templates)t.frames=normalize(t.rawFrames,{mean,std}).map(f=>f.map(v=>Math.round(v*1000)/1000));
    const thresholds={};
    for(const command of bank.commands){const group=templates.filter(t=>t.id===command.id);if(!group.length)continue;const pairs=[];
      for(let i=0;i<group.length;i++)for(let j=i+1;j<group.length;j++)pairs.push(distance(group[i].frames,group[j].frames));
      const finite=pairs.filter(Number.isFinite).sort((a,b)=>a-b);
      thresholds[command.id]=finite.length?Math.min(1.6,Math.max(.35,finite[Math.floor(finite.length/2)]*1.6)):.9;
    }
    return {...bank,templates,scale:{mean,std},thresholds,featureVersion:2};
  }
  return {features,normalize,distance,rank,recognize,rebuild,sampleRate:rate};
});
