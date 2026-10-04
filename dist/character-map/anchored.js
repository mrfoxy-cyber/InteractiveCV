/* Separate audio-tour prototype. Never loaded by the main CV. */
"use strict";
(async () => {
  const assetRoot = "../assets/cv/interactive/audiotour/character-anchor-v2/";
  const mouthRoot = "../assets/cv/interactive/audiotour/mouth-visemes-v2/";
  const $ = id => document.getElementById(id);
  const canvas = $("character");
  const ctx = canvas.getContext("2d");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let playing = false, raf = 0, start = 0, lastFrame = -Infinity;
  let manifest, anchor, anchorPixels, sprites, mouthMap;
  const poseButtons = new Map();
  const makeCanvas = (w, h) => {
    const c = document.createElement("canvas"); c.width = w; c.height = h; return c;
  };
  const loadImage = async (name, root = assetRoot, fullFrame = true) => {
    const img = new Image();
    img.src = root + name;
    await img.decode();
    if (fullFrame && (img.naturalWidth !== manifest.canvas.width || img.naturalHeight !== manifest.canvas.height)) {
      throw new Error("Source frame dimensions differ from the anchor; refusing to stretch a layer.");
    }
    return img;
  };
  const buildSprite = (layer, source) => {
    const [x, y, w, h] = layer.bounds;
    const mask = makeCanvas(w, h), m = mask.getContext("2d");
    const pixels = m.createImageData(w, h);
    for (let v = 0; v < h; v++) for (let u = 0; u < w; u++) {
      const edge = Math.min(u, v, w - 1 - u, h - 1 - v);
      const border = Math.min(1, Math.max(0, edge / layer.feather));
      const root = layer.rootFade ? Math.min(1, v / layer.rootFade) : 1;
      const i = (v * w + u) * 4;
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = 255;
      pixels.data[i + 3] = Math.round(255 * border * root);
    }
    m.putImageData(pixels, 0, 0);
    const sprite = makeCanvas(w, h), s = sprite.getContext("2d");
    s.drawImage(source, ...(layer.sourceRect || [x, y, w, h]), 0, 0, w, h);
    s.globalCompositeOperation = "destination-in";
    s.drawImage(mask, 0, 0);
    return { ...layer, pixels: s.getImageData(0, 0, w, h).data, maskAlpha: pixels.data };
  };
  const render = (target, state, guides = false) => {
    // Copy the canonical base bytes. Only bounded sprite loops may alter this copy.
    // This also avoids browser compositing/readback drift outside dirty rectangles.
    const framePixels = new ImageData(new Uint8ClampedArray(anchorPixels.data), manifest.canvas.width, manifest.canvas.height);
    const output = framePixels.data;
    for (const layer of sprites) {
      const strength = Math.max(0, Math.min(1, state[layer.group] || 0));
      if (!strength) continue;
      const [x, y, w, h] = layer.bounds;
      for (let v = 0; v < h; v++) for (let u = 0; u < w; u++) {
        const si = (v * w + u) * 4;
        const sa = layer.pixels[si + 3] / 255 * strength;
        if (!sa) continue;
        const di = ((y + v) * manifest.canvas.width + x + u) * 4;
        const da = output[di + 3] / 255;
        const combinedAlpha = sa + da * (1 - sa);
        for (let channel = 0; channel < 3; channel++) {
          output[di + channel] = Math.round((layer.pixels[si + channel] * sa + output[di + channel] * da * (1 - sa)) / combinedAlpha);
        }
        output[di + 3] = Math.round(combinedAlpha * 255);
      }
    }
    target.putImageData(framePixels, 0, 0);
    if (guides) for (const layer of sprites.filter(item => !item.viseme)) {
      const [x, y, w, h] = layer.bounds;
      target.save();
      target.strokeStyle = layer.group === "blink" ? "#33688d" : layer.group === "mouth" ? "#a35a60" : "#507a48";
      target.lineWidth = 3; target.setLineDash([8, 5]); target.strokeRect(x, y, w, h);
      target.fillStyle = target.strokeStyle;
      target.beginPath(); target.arc(...layer.pivot, 4, 0, Math.PI * 2); target.fill();
      target.restore();
    }
  };
  const poseState = (id, strength = 1) => id === "rest" ? {} : { ["viseme-" + id]: strength };
  const labelFor = id => id === "rest" ? "rest" : mouthMap.poses.find(pose => pose.id === id).label;
  const closeup = () => {
    const [x, y, w, h] = mouthMap.target.bounds;
    const c = $("mouth-closeup"), context = c.getContext("2d");
    context.clearRect(0, 0, c.width, c.height);
    context.drawImage(canvas, x, y, w, h, 0, 0, c.width, c.height);
  };
  const showPoseName = id => {
    const name = labelFor(id);
    const text = "Mouth: " + name;
    if ($("pose-status").textContent !== text) $("pose-status").textContent = text;
    $("mouth-closeup").setAttribute("aria-label", "Close-up of mouth pose: " + name);
  };
  const still = () => {
    const id = $("mouth-pose").value;
    render(ctx, { blink: $("closed").checked ? 1 : 0, ...poseState(id) }, $("guides").checked);
    for (const [poseId, button] of poseButtons) button.setAttribute("aria-pressed", String(id === poseId));
    showPoseName(id); closeup();
  };
  const stop = (message = "Paused. The anchor is still.") => {
    document.dispatchEvent(new Event("lip-sync:pause"));
    playing = false; cancelAnimationFrame(raf); raf = 0;
    $("play").textContent = "Play animation"; $("mode").textContent = "Resting";
    $("closed").checked = false; $("mouth-pose").value = "rest";
    still(); $("status").textContent = message;
  };
  const movementState = t => {
    const timing = manifest.timing;
    const cycle = t % timing.blinkCycleMs;
    // The eye mask is inactive except for a short blink near the end of each cycle.
    const closeAt = timing.blinkCycleMs - timing.blinkCloseMs - timing.blinkHoldMs - timing.blinkOpenMs;
    const elapsed = cycle - closeAt;
    let blink = 0;
    if (elapsed >= 0 && elapsed < timing.blinkCloseMs) blink = elapsed / timing.blinkCloseMs;
    else if (elapsed >= timing.blinkCloseMs && elapsed < timing.blinkCloseMs + timing.blinkHoldMs) blink = 1;
    else if (elapsed >= timing.blinkCloseMs + timing.blinkHoldMs) blink = 1 - (elapsed - timing.blinkCloseMs - timing.blinkHoldMs) / timing.blinkOpenMs;
    const hair = (1 - Math.cos(t * Math.PI * 2 / timing.hairCycleMs)) / 2;
    return { blink: $("eyes").checked ? blink : 0, hair: $("hair").checked ? hair : 0 };
  };
  const frame = now => {
    if (!playing) return;
    if (now - lastFrame < 1000 / 30) { raf = requestAnimationFrame(frame); return; }
    lastFrame = now;
    const t = now - start;
    let mouthState = poseState($("mouth-pose").value), currentId = $("mouth-pose").value;
    if ($("mouth").checked) {
      const sequence = ["rest", ...mouthMap.poses.map(pose => pose.id)];
      const step = Math.floor(t / mouthMap.cycle.holdMs) % sequence.length;
      currentId = sequence[step];
      const previousId = sequence[(step + sequence.length - 1) % sequence.length];
      const progress = Math.min(1, t % mouthMap.cycle.holdMs / mouthMap.cycle.transitionMs);
      mouthState = { ...poseState(previousId, 1 - progress), ...poseState(currentId, progress) };
    }
    render(ctx, { ...movementState(t), ...mouthState }, $("guides").checked);
    showPoseName(currentId); closeup();
    raf = requestAnimationFrame(frame);
  };
  const verify = () => {
    const { width: w, height: h } = manifest.canvas;
    const test = makeCanvas(w, h), c = test.getContext("2d", { willReadFrequently: true });
    render(c, {});
    const base = c.getImageData(0, 0, w, h).data;
    const states = [{ blink: 1 }, { hair: 1 }, { mouth: 1 }, ...mouthMap.poses.map(pose => poseState(pose.id)), ...mouthMap.poses.map(pose => poseState(pose.id, .5)), { blink: 1, hair: 1, ...poseState("o") }, { blink: .5, hair: .5, ...poseState("aei", .5) }, { ...poseState("o", .5), ...poseState("u", .5) }];
    let outside = 0;
    const changes = [];
    for (const state of states) {
      // Each frame is allowed to change only its ACTIVE regions. Mouth-only
      // poses must keep the eyes, hair and every other pixel unchanged too.
      const allowed = new Uint8Array(w * h);
      for (const layer of sprites.filter(item => state[item.group] > 0)) {
        const [x, y, lw, lh] = layer.bounds;
        for (let v = 0; v < lh; v++) for (let u = 0; u < lw; u++) {
          if (layer.maskAlpha[(v * lw + u) * 4 + 3]) allowed[(y + v) * w + x + u] = 1;
        }
      }
      render(c, state);
      const pixels = c.getImageData(0, 0, w, h).data;
      let inside = 0;
      for (let p = 0; p < w * h; p++) {
        const i = p * 4;
        if (pixels[i] !== base[i] || pixels[i + 1] !== base[i + 1] || pixels[i + 2] !== base[i + 2] || pixels[i + 3] !== base[i + 3]) {
          if (allowed[p]) inside++; else outside++;
        }
      }
      changes.push(inside);
    }
    // The user's preferred earlier mouth must render identically, not merely
    // resemble it. Its original layer and A/E/I copy share the same native mask.
    render(c, { mouth: 1 });
    const preferred = c.getImageData(0, 0, w, h).data;
    render(c, poseState("aei"));
    const restored = c.getImageData(0, 0, w, h).data;
    let preferredChanges = 0;
    for (let i = 0; i < preferred.length; i++) if (preferred[i] !== restored[i]) preferredChanges++;
    const passed = outside === 0 && preferredChanges === 0 && changes.every(n => n > 0);
    $("audit").textContent = `${passed ? "Passed" : "FAILED"}: ${mouthMap.poses.length} mouth poses, ${states.length + 2} test frames; ${outside} changed pixels outside their active masks. Original gentle open: ${preferredChanges === 0 ? "identical" : "CHANGED"}.`;
    $("audit").dataset.insideChanges = changes.join(",");
    $("audit").dataset.passed = String(passed);
    if (!passed) throw new Error("Anchor-region protection check failed.");
  };
  try {
    const response = await fetch(assetRoot + "regions.json");
    if (!response.ok) throw new Error("Unable to load the region map.");
    manifest = await response.json();
    const mouthResponse = await fetch(mouthRoot + "mouth-map.json");
    if (!mouthResponse.ok) throw new Error("Unable to load mouth poses.");
    mouthMap = await mouthResponse.json();
    canvas.width = manifest.canvas.width; canvas.height = manifest.canvas.height;
    anchor = await loadImage(manifest.anchor);
    const baseCanvas = makeCanvas(manifest.canvas.width, manifest.canvas.height);
    const baseContext = baseCanvas.getContext("2d", { willReadFrequently: true });
    baseContext.drawImage(anchor, 0, 0);
    anchorPixels = baseContext.getImageData(0, 0, manifest.canvas.width, manifest.canvas.height);
    const files = [...new Set(manifest.layers.map(layer => layer.source))];
    const sources = Object.fromEntries(await Promise.all(files.map(async file => [file, await loadImage(file)])));
    sprites = manifest.layers.map(layer => buildSprite(layer, sources[layer.source]));
    const mouthFiles = [...new Set(mouthMap.poses.map(pose => pose.source))];
    const mouthSources = Object.fromEntries(await Promise.all(mouthFiles.map(async file => {
      const source = await loadImage(file, mouthRoot, false);
      const expected = mouthMap.sources[file];
      if (!expected || source.naturalWidth !== expected.width || source.naturalHeight !== expected.height) throw new Error("Mouth source dimensions differ from the registered map: " + file);
      return [file, source];
    })));
    for (const pose of mouthMap.poses) {
      const [sx, sy, sw, sh] = pose.sourceRect, source = mouthSources[pose.source];
      if (sw !== mouthMap.target.bounds[2] || sh !== mouthMap.target.bounds[3] || sx < 0 || sy < 0 || sx + sw > source.naturalWidth || sy + sh > source.naturalHeight) throw new Error("Mouth registration would crop out of bounds or resize a patch: " + pose.id);
      sprites.push(buildSprite({ ...mouthMap.target, id: "viseme-" + pose.id, label: pose.label, group: "viseme-" + pose.id, sourceRect: pose.sourceRect, viseme: true }, mouthSources[pose.source]));
      const option = document.createElement("option"); option.value = pose.id; option.textContent = pose.label + " · " + pose.description; $("mouth-pose").append(option);
    }
    $("mouth-pose").value = mouthMap.defaultPose || "rest";
    $("mode").textContent = "Still-frame inspection";
    const thumbFrame = makeCanvas(manifest.canvas.width, manifest.canvas.height), thumbContext = thumbFrame.getContext("2d");
    for (const pose of mouthMap.poses) {
      const button = document.createElement("button"); button.type = "button"; button.className = "pose-card";
      button.setAttribute("aria-label", "Preview mouth: " + pose.label); button.setAttribute("aria-pressed", "false");
      const thumb = makeCanvas(210, 120); thumb.setAttribute("aria-hidden", "true");
      render(thumbContext, poseState(pose.id));
      thumb.getContext("2d").drawImage(thumbFrame, ...mouthMap.target.bounds, 0, 0, 210, 120);
      const label = document.createElement("span"); label.textContent = pose.label;
      button.append(thumb, label); $("mouth-gallery").append(button); poseButtons.set(pose.id, button);
      button.addEventListener("click", () => {
        document.dispatchEvent(new Event("lip-sync:pause"));
        playing = false; cancelAnimationFrame(raf); raf = 0;
        $("play").textContent = "Play animation"; $("mode").textContent = "Still-frame inspection";
        $("mouth-pose").value = pose.id;
        $("status").textContent = "Inspecting mouth pose: " + pose.label + ". Everything outside its region remains fixed.";
        still();
      });
    }
    still(); verify();
    document.addEventListener("lip-sync:start", () => {
      playing = false; cancelAnimationFrame(raf); raf = 0;
      $("play").textContent = "Play animation";
      for (const button of poseButtons.values()) button.setAttribute("aria-pressed", "false");
    });
    document.addEventListener("lip-sync:render", event => {
      const { pose, previous, mix, timeMs, animate, running } = event.detail;
      let state = {};
      if (animate) {
        // Matching poses must not overwrite one another's blend strength.
        const mouthState = pose === previous ? poseState(pose) : { ...poseState(previous, 1 - mix), ...poseState(pose, mix) };
        state = { ...movementState(timeMs), ...mouthState };
      }
      render(ctx, state, $("guides").checked);
      for (const button of poseButtons.values()) button.setAttribute("aria-pressed", "false");
      $("mode").textContent = animate ? (running ? "Following audio" : "Audio · paused") : "Audio · still character";
      showPoseName(animate ? pose : "rest"); closeup();
    });
    document.dispatchEvent(new Event("character:ready"));
    $("play").disabled = false; $("verify").disabled = false;
    $("options").disabled = false; $("inspection").disabled = false;
    $("status").textContent = reducedMotion.matches ? "Ready. Reduced motion is enabled; the character starts still." : "Ready. Choose a mouth pose, or enable mouth cycling and press Play.";
    $("play").addEventListener("click", () => {
      document.dispatchEvent(new Event("lip-sync:pause"));
      if (playing) { stop(); return; }
      playing = true; start = performance.now(); lastFrame = -Infinity;
      $("closed").checked = false;
      for (const button of poseButtons.values()) button.setAttribute("aria-pressed", "false");
      $("play").textContent = "Pause animation"; $("mode").textContent = "Animating";
      $("status").textContent = "Playing only within the selected regions. Pause whenever you like.";
      raf = requestAnimationFrame(frame);
    });
    for (const id of ["closed", "mouth-pose"]) $(id).addEventListener("change", () => {
      document.dispatchEvent(new Event("lip-sync:pause"));
      playing = false; cancelAnimationFrame(raf); raf = 0;
      $("play").textContent = "Play animation"; $("mode").textContent = "Still-frame inspection";
      $("status").textContent = "Inspecting a still frame. The rest of the base remains locked."; still();
    });
    $("guides").addEventListener("change", () => { if (!playing) still(); });
    $("verify").addEventListener("click", () => {
      try { verify(); $("status").textContent = "Locked-area check passed."; }
      catch (error) { stop("Locked-area check failed; animation has been stopped."); console.error(error); }
    });
    reducedMotion.addEventListener("change", event => { if (event.matches) stop("Paused because reduced motion was enabled."); });
    document.addEventListener("visibilitychange", () => { if (document.hidden && playing) stop("Paused while this tab was hidden."); });
    window.addEventListener("pagehide", () => cancelAnimationFrame(raf));
  } catch (error) {
    $("status").textContent = "The prototype could not load safely: " + error.message;
    console.error(error);
  }
})();
