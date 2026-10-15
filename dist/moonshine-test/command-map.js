(function(root){
  'use strict';
  const normalize=text=>String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
  const extras={skovde:['skövde','skovde'],tartu:['tartu'],help:['help me']};
  function match(text,commands){
    const phrase=normalize(text).replace(/^(?:please\s+)?(?:tell me about|show me|open|go to)\s+/,'').replace(/^please\s+/,'').replace(/\s+please$/,'');
    const candidates=commands.filter(c=>[c.phrase,c.id,...(extras[c.id]||[])].some(alias=>normalize(alias)===phrase));
    return candidates.length===1?candidates[0]:null;
  }
  function samples(){const names=['about-me','back','education','english','estonian','frog-game','german','goatly','gymnasium','help','komvux','languages','lexicon','mental-model-graph','menu','projects','repeat','skills','skövde','standalone-courses','stop','swedish','tartu','work-experience'];
    return names.flatMap(name=>Array.from({length:name==='mental-model-graph'?4:3},(_,i)=>({file:(name==='gymnasium'&&i===0?'gymnaisum':name)+'-'+(i+1)+'.mp3',expected:name==='skövde'?'skovde':name})));}
  root.MoonshineCommands={normalize,match,samples};
})(globalThis);
