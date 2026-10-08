/* Local Mel filter-bank spectrogram. No speech recognition or network calls. */
(function(root){
  'use strict';
  const toMel=hz=>2595*Math.log10(1+hz/700);
  const toHz=mel=>700*(10**(mel/2595)-1);
  function analyze(samples,fftPower,sampleRate=16000,fftSize=2048,hopSize=320,bands=40){
    const edges=Array.from({length:bands+2},(_,i)=>toHz(toMel(sampleRate/2)*i/(bands+1)));
    // Evaluate triangles at actual FFT-bin frequencies, then normalize each
    // filter's weights to one so wider high-frequency bands do not win by width.
    const filters=Array.from({length:bands},(_,b)=>{
      const weights=Array.from({length:fftSize/2+1},(_,k)=>{
        const hz=k*sampleRate/fftSize;
        return Math.max(0,Math.min((hz-edges[b])/(edges[b+1]-edges[b]),(edges[b+2]-hz)/(edges[b+2]-edges[b+1])));
      });
      const sum=weights.reduce((a,b)=>a+b,0);
      return weights.map(w=>sum?w/sum:0);
    });
    const frames=[];
    for(let start=0;start<samples.length;start+=hopSize){
      const power=fftPower(samples,start,samples.length);
      const values=filters.map(weights=>{
        const mean=weights.reduce((total,w,k)=>total+w*power[k],0);
        return Number(Math.max(-100,10*Math.log10(Math.max(mean,1e-10))).toFixed(2));
      });
      frames.push({startMs:start/sampleRate*1000,db:values});
    }
    return {method:'HTK Mel triangular filter bank',bands,sampleRate,fftSize,hopSize,
      windowMs:fftSize/sampleRate*1000,hopMs:hopSize/sampleRate*1000,
      minHz:0,maxHz:sampleRate/2,centersHz:edges.slice(1,-1),
      scale:'Weight-normalized mean FFT-bin power per Mel band, in dB relative to digital full scale; display floor -100 dB',
      frames};
  }
  root.MelAnalysis={analyze,toMel,toHz};
})(typeof globalThis!=='undefined'?globalThis:this);
