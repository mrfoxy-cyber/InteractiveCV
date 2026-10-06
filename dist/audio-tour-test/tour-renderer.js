"use strict";
window.AudioTourCharacter = {
  async load(canvas, characterUrl) {
    const localUrl = (path, base) => {
      AudioTourConfig.path(path);
      const url = new URL(path, base);
      if (url.origin !== location.origin) throw new Error("Character assets must be on this website.");
      return url;
    };
    const json = async url => { const response = await fetch(url); if (!response.ok) throw new Error("Missing character asset: " + url.pathname); return response.json(); };
    const character = await json(characterUrl);
    if (character.schemaVersion !== 1 || typeof character.description !== "string") throw new Error("Unsupported character package.");
    const regionUrl = localUrl(character.regions, characterUrl), mouthUrl = localUrl(character.mouths, characterUrl);
    const regions = await json(regionUrl), mouths = await json(mouthUrl);
    const {width, height} = regions.canvas || {};
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > 4000000) throw new Error("Invalid character canvas.");
    if (!Array.isArray(regions.layers) || !Array.isArray(mouths.poses) || regions.layers.length > 100 || mouths.poses.length > 100) throw new Error("Invalid character layers.");
    const make = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
    const image = async (file, base, expected) => {
      const img = new Image(); img.src = localUrl(file, base).href; await img.decode();
      if (!expected || img.naturalWidth !== expected.width || img.naturalHeight !== expected.height) throw new Error("Unregistered image size: " + file);
      return img;
    };
    canvas.width = width; canvas.height = height; canvas.setAttribute("aria-label", character.description);
    const base = make(width, height), baseCtx = base.getContext("2d", {willReadFrequently:true});
    baseCtx.drawImage(await image(regions.anchor, regionUrl, regions.canvas), 0, 0);
    const pixels = baseCtx.getImageData(0, 0, width, height), layers = [];
    const patch = (definition, source, group) => {
      const [x,y,w,h] = definition.bounds || [];
      if (![x,y,w,h].every(Number.isInteger) || x < 0 || y < 0 || w < 1 || h < 1 || x+w > width || y+h > height || !Number.isFinite(definition.feather) || definition.feather < 1) throw new Error("Invalid bounded animation region.");
      const rect = definition.sourceRect || [x,y,w,h];
      if (rect.length !== 4 || !rect.every(Number.isInteger) || rect[0] < 0 || rect[1] < 0 || rect[2] !== w || rect[3] !== h || rect[0]+w > source.naturalWidth || rect[1]+h > source.naturalHeight) throw new Error("Invalid source registration.");
      const c = make(w,h), ctx = c.getContext("2d"); ctx.drawImage(source, ...rect, 0,0,w,h);
      const data = ctx.getImageData(0,0,w,h).data;
      for (let v=0; v<h; v++) for (let u=0; u<w; u++) {
        const edge = Math.min(u,v,w-1-u,h-1-v), fade = definition.rootFade ? Math.min(1,v/definition.rootFade) : 1;
        data[(v*w+u)*4+3] = Math.round(data[(v*w+u)*4+3] * Math.min(1,edge/definition.feather) * fade);
      }
      layers.push({x,y,w,h,data,group});
    };
    const cache = new Map();
    const cached = async (file, url, size) => { const key = localUrl(file,url).href; if (!cache.has(key)) cache.set(key,image(file,url,size)); return cache.get(key); };
    for (const layer of regions.layers.filter(item => ["blink","hair"].includes(item.group))) patch(layer, await cached(layer.source,regionUrl,layer.sourceSize || regions.canvas), layer.group);
    const poses = new Set(["rest"]);
    for (const pose of mouths.poses) {
      if (typeof pose.id !== "string" || poses.has(pose.id)) throw new Error("Duplicate mouth pose.");
      poses.add(pose.id);
      patch({...mouths.target,sourceRect:pose.sourceRect}, await cached(pose.source,mouthUrl,mouths.sources[pose.source]), "mouth-"+pose.id);
    }
    const ctx = canvas.getContext("2d");
    const render = state => {
      const frame = new ImageData(new Uint8ClampedArray(pixels.data),width,height), output=frame.data;
      for (const layer of layers) {
        const strength = Math.max(0,Math.min(1,state[layer.group] || 0)); if (!strength) continue;
        for (let v=0;v<layer.h;v++) for (let u=0;u<layer.w;u++) {
          const si=(v*layer.w+u)*4, alpha=layer.data[si+3]/255*strength; if (!alpha) continue;
          const di=((layer.y+v)*width+layer.x+u)*4, da=output[di+3]/255, combined=alpha+da*(1-alpha);
          for (let channel=0;channel<3;channel++) output[di+channel]=Math.round((layer.data[si+channel]*alpha+output[di+channel]*da*(1-alpha))/combined);
          output[di+3]=Math.round(combined*255);
        }
      }
      ctx.putImageData(frame,0,0);
    };
    render({});
    return {poses, render, frame(time, config, cue, animate) {
      const state = {};
      if (animate) {
        const blink=config.animations.blink, hair=config.animations.hair;
        const elapsed=time%blink.cycleMs-(blink.cycleMs-blink.closeMs-blink.holdMs-blink.openMs);
        if (blink.enabled && elapsed >= 0) state.blink=elapsed<blink.closeMs ? elapsed/blink.closeMs : elapsed<blink.closeMs+blink.holdMs ? 1 : Math.max(0,1-(elapsed-blink.closeMs-blink.holdMs)/blink.openMs);
        if (hair.enabled) state.hair=(1-Math.cos(time*Math.PI*2/hair.cycleMs))/2;
        if (cue.pose===cue.previous) state['mouth-'+cue.pose]=1;
        else { state['mouth-'+cue.previous]=1-cue.mix; state['mouth-'+cue.pose]=cue.mix; }
      }
      render(state);
    }};
  }
};
