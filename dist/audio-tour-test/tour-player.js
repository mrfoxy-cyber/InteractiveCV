"use strict";
(() => {
  const $=id=>document.getElementById(id), audio=$("tour-audio"), reduced=matchMedia("(prefers-reduced-motion: reduce)");
  let config=null, renderer=null, version=0, raf=0, last=-Infinity, blobUrl=null;
  let audioReady=false;
  const microphone=$("tour-microphone");
  const syncMicrophone=()=>{
    const playing=!audio.paused&&!audio.ended, label=playing?"Pause narration":"Play narration";
    microphone.disabled=!audioReady; microphone.dataset.playing=String(playing);
    microphone.setAttribute("aria-label",label); $("tour-microphone-label").textContent=label;
  };
  microphone.addEventListener("click",async()=>{
    if(!audioReady)return;
    if(!audio.paused){audio.pause();return;}
    try {if(audio.ended)audio.currentTime=0;await audio.play();}
    catch(error){status("Could not play narration: "+error.message);syncMicrophone();}
  });
  audio.addEventListener("emptied",()=>{audioReady=false;syncMicrophone();});
  for(const event of ["play","pause","ended"])audio.addEventListener(event,syncMicrophone);
  const status=text=>$("tour-status").textContent=text;
  $("tour-animate").checked=!reduced.matches;
  const frame=()=>{if (renderer && config) renderer.frame(audio.currentTime*1000,config,MouthTimeline.sample(config.mouthTiming,audio.currentTime*1000),$("tour-animate").checked&&!audio.ended);};
  const tick=now=>{if(now-last>1000/30){last=now;frame();} if(!audio.paused&&!audio.ended)raf=requestAnimationFrame(tick);};
  const stop=()=>{audio.pause();cancelAnimationFrame(raf);if(renderer)renderer.render({});};
  async function load(value, baseUrl) {
    const id=++version;stop();audioReady=false;syncMicrophone();config=null;renderer=null; audio.hidden=true;audio.removeAttribute("src");audio.load();$("tour-audio-file").disabled=true;
    if(blobUrl){URL.revokeObjectURL(blobUrl);blobUrl=null;}
    try {
      const checked=AudioTourConfig.validate(value);
      const characterUrl=new URL(checked.character,baseUrl), audioUrl=new URL(checked.audio.src,baseUrl);
      if(characterUrl.origin!==location.origin||audioUrl.origin!==location.origin)throw new Error("Use assets from this website.");
      status("Loading character package…");
      // Detached canvas keeps an older, slower request from repainting a newer selection.
      const canvas=document.createElement("canvas");canvas.id="tour-character";canvas.setAttribute("role","img");
      const loaded=await AudioTourCharacter.load(canvas,characterUrl);
      if(id!==version)return;
      if(checked.mouthTiming && checked.mouthTiming.mouthCues.some(c=>!loaded.poses.has(c.pose)))throw new Error("This character lacks a mouth pose required by the narration.");
      $("tour-character").replaceWith(canvas);config=checked;renderer=loaded;
      $("tour-title").textContent=config.title;$("tour-transcript").textContent=config.transcript || "No transcript included.";
      $("tour-details").textContent=JSON.stringify(config,null,2);$("tour-audio-file").disabled=false;
      audio.src=audioUrl.href;audio.hidden=false;audio.load();
      status(config.mouthTiming ? "Narration loaded. Press Play to test the complete animation." : "Preview only: blink and hair are ready. Generate and export mouth timing in the workshop for lip sync.");
    }catch(error){if(id===version)status("Could not load narration: "+error.message);}
  }
  audio.addEventListener("loadedmetadata",()=>{
    if(config?.mouthTiming && (!Number.isFinite(audio.duration)||Math.abs(audio.duration*1000-config.mouthTiming.durationMs)>150)){stop();audioReady=false;audio.hidden=true;status("Audio duration does not match the mouth timing. Choose the original recording or regenerate timing.");}
    else audioReady=!!config;
    syncMicrophone();
  });
  audio.addEventListener("error",()=>{audioReady=false;syncMicrophone();if(config){stop();status("Audio file not found or unsupported. Save it at the JSON audio path, or choose an audio replacement below.");}});
  audio.addEventListener("play",()=>{cancelAnimationFrame(raf);last=-Infinity;raf=requestAnimationFrame(tick);});
  audio.addEventListener("pause",()=>{cancelAnimationFrame(raf);frame();});audio.addEventListener("seeked",frame);audio.addEventListener("ended",()=>{cancelAnimationFrame(raf);renderer?.render({});});
  $("tour-animate").addEventListener("change",frame);
  reduced.addEventListener("change",event=>{if(event.matches){$("tour-animate").checked=false;frame();}});
  document.addEventListener("visibilitychange",()=>{if(document.hidden)stop();});window.addEventListener("pagehide",()=>{stop();if(blobUrl)URL.revokeObjectURL(blobUrl);});
  $("tour-file").addEventListener("change",async event=>{
    const file=event.target.files[0];if(!file)return;
    try{if(file.size>8*1024*1024)throw new Error("JSON must be smaller than 8 MB.");await load(JSON.parse(await file.text()),new URL("narrations/"+encodeURIComponent(file.name),location.href));}catch(error){status(error.message);}finally{event.target.value="";}
  });
  $("tour-load-paste").addEventListener("click",()=>{
    try {const text=$("tour-paste").value;if(text.length>8*1024*1024)throw new Error("JSON is too large.");load(JSON.parse(text),new URL("narrations/pasted.narration.json",location.href));}catch(error){status("Could not load pasted JSON: "+error.message);}
  });
  $("tour-audio-file").addEventListener("change",event=>{
    const file=event.target.files[0];if(!file||!config)return;stop();audioReady=false;syncMicrophone();if(blobUrl)URL.revokeObjectURL(blobUrl);blobUrl=URL.createObjectURL(file);audio.src=blobUrl;audio.hidden=false;audio.load();status("Testing your chosen audio replacement. Nothing was uploaded.");
  });
  let savedLoadVersion=0;
  const loadSaved=async file=>{
    const id=++savedLoadVersion;
    stop(); audioReady=false;syncMicrophone();status("Loading saved narration…");
    try {
      if(!/^[^/\\]+\.narration\.json$/u.test(file)) throw new Error("Invalid saved narration filename.");
      const url=new URL("narrations/"+encodeURIComponent(file),location.href), response=await fetch(url);
      if(!response.ok)throw new Error("Saved narration could not load.");
      const value=await response.json(); if(id===savedLoadVersion) await load(value,url);
    } catch(error){if(id===savedLoadVersion)status(error.message);}
  };
  $("tour-saved").addEventListener("change",()=>{if($("tour-saved").value)loadSaved($("tour-saved").value);});
  fetch("narrations/catalogue.json",{cache:"no-store"}).then(async response=>{
    if(!response.ok)throw new Error("Saved narration list unavailable.");
    const catalogue=await response.json();if(catalogue.schemaVersion!==1||!Array.isArray(catalogue.narrations))throw new Error("Invalid saved narration list.");
    $("tour-saved").replaceChildren(new Option("Choose a narration…",""));
    for(const item of catalogue.narrations){if(typeof item.title!=="string"||!/^[^/\\]+\.narration\.json$/u.test(item.file))throw new Error("Invalid catalogue entry.");$("tour-saved").append(new Option(item.title,item.file));}
    $("tour-saved").disabled=false;$("tour-saved-status").textContent=catalogue.narrations.length+" saved narrations ready.";
    const welcome=catalogue.narrations.find(item=>item.file==='welcome.narration.json')||catalogue.narrations[0];
    if(welcome){$("tour-saved").value=welcome.file;await loadSaved(welcome.file);}
  }).catch(error=>{$("tour-saved-status").textContent=error.message;status("Load or paste a narration JSON to begin.");});
})();
