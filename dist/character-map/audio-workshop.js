"use strict";
(() => {
  const $ = id => document.getElementById(id);
  const audio = $("speech-audio"), status = $("audio-status"), reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let timeline = null, sourceName = "", sourceBytes = null, audioUrl = null, downloadUrl = null;
  let ready = false, token = null, busy = false, raf = 0, lastFrame = -Infinity, loadVersion = 0;
  let catalogueLoading = false;
  let sourceReady = false;
  const scriptCatalogue = fetch("narration-scripts.json", { cache: "no-store" }).then(response => {
    if (!response.ok) throw new Error("Narration script unavailable"); return response.json();
  }).catch(() => null);
  const narrationRoot = "../voice-tour/audio/narration/";
  const narrationSelect = $("narration-select");
  const validNarrationFile = file => typeof file === "string" && file.length <= 255 && !file.startsWith(".") && !/[\\/\x00-\x1f]/.test(file) && /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file);
  const narrationLabel = file => file.replace(/\.[^.]+$/, "").replace(/-/g, " ").replace(/\b\w/g, character => character.toUpperCase());
  $("audio-animate").checked = !reduced.matches;
  const message = text => { status.textContent = text; };
  const offsetInput = $("mouth-offset");
  const readOffset = () => {
    if (!offsetInput.validity.valid) throw new Error("Enter a whole-number mouth offset between -5000 and 5000 ms.");
    return offsetInput.valueAsNumber;
  };
  const controls = () => {
    $("generate-timing").disabled = !ready || !sourceBytes || !sourceReady || !token || busy || !offsetInput.validity.valid;
    offsetInput.disabled = busy;
    $("audio-file").disabled = $("audio-example").disabled = $("load-example").disabled = busy;
    narrationSelect.disabled = busy || catalogueLoading || narrationSelect.options.length < 2;
    $("load-narration").disabled = busy || catalogueLoading || !narrationSelect.value;
    $("refresh-narrations").disabled = busy || catalogueLoading;
    $("timeline-file").disabled = busy || !sourceBytes;
    $("speech-recognizer").disabled = busy;
    $("speech-script").disabled = busy || $("speech-recognizer").value !== "pocketSphinx";
    $("speech-audio").hidden = !sourceBytes;
  };
  const resetTimeline = () => {
    timeline = null;
    $("timing-list").replaceChildren(); $("timing-summary").textContent = "No timing generated yet."; $("timing-json").value = "";
    $("download-timing").hidden = true;
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = null;
  };
  const dispatchFrame = (forceRest = false) => {
    const timeMs = audio.currentTime * 1000;
    const cue = MouthTimeline.sample(timeline, timeMs);
    const animate = $("audio-animate").checked && !forceRest && !audio.ended;
    document.dispatchEvent(new CustomEvent("lip-sync:render", { detail: { ...cue, timeMs, animate, running: !audio.paused && !audio.ended } }));
    // This changing label deliberately isn't an ARIA live region.
    $("audio-clock").textContent = `${Math.round(timeMs)} ms · ${timeline ? cue.pose : "rest"}`;
  };
  const tick = now => {
    if (now - lastFrame >= 1000 / 30) { lastFrame = now; dispatchFrame(); }
    if (!audio.paused && !audio.ended) raf = requestAnimationFrame(tick);
  };
  const pause = () => { audio.pause(); cancelAnimationFrame(raf); raf = 0; };
  const stop = () => { pause(); dispatchFrame(true); };
  document.addEventListener("lip-sync:pause", pause);
  document.addEventListener("character:ready", () => { ready = true; controls(); });
  audio.addEventListener("play", () => {
    document.dispatchEvent(new Event("lip-sync:start"));
    lastFrame = -Infinity; cancelAnimationFrame(raf); raf = requestAnimationFrame(tick);
  });
  audio.addEventListener("pause", () => { cancelAnimationFrame(raf); raf = 0; dispatchFrame(); });
  audio.addEventListener("seeked", () => dispatchFrame());
  audio.addEventListener("ended", () => dispatchFrame(true));
  audio.addEventListener("error", () => message("This audio could not be played. Try a supported MP3 or WAV file."));
  $("audio-animate").addEventListener("change", () => dispatchFrame());
  reduced.addEventListener("change", event => { if (event.matches) { $("audio-animate").checked = false; dispatchFrame(true); } });
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });
  window.addEventListener("pagehide", () => {
    stop(); if (audioUrl) URL.revokeObjectURL(audioUrl); if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  });

  const selectAudio = async (bytes, name, mime, version) => {
    if (version !== loadVersion) return;
    if (bytes.byteLength > 40 * 1024 * 1024) throw new Error("Use an audio file smaller than 40 MB.");
    if (!/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(name)) throw new Error("Choose a supported audio file such as MP3 or WAV.");
    stop(); resetTimeline();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    sourceBytes = bytes; sourceName = name;
    audioUrl = URL.createObjectURL(new Blob([bytes], { type: mime || "audio/mpeg" }));
    audio.src = audioUrl; audio.load();
    $("selected-audio").textContent = name;
    const catalogue = await scriptCatalogue;
    if (version !== loadVersion) return;
    const clip = NarrationScript.match(catalogue, name);
    $("speech-script").value = clip ? clip.text : "";
    if (clip) {
      $("speech-recognizer").value = "pocketSphinx";
      $("script-option").open = true;
      $("script-status").textContent = `Loaded automatically from ${catalogue.source || "your narration script"}: ${clip.title || clip.file}. Edit or clear the text if your recording differs. Used only in English mode.`;
    } else {
      $("script-status").textContent = catalogue ? "No matching script for this filename. Enter text yourself, or generate from audio only." : "The saved narration script could not load. Enter text yourself, or generate from audio only.";
    }
    sourceReady = true;
    message(token ? "Audio selected. Generate the mouth timing, or load an existing JSON timeline." : "Audio selected. Load existing timing, or open the local generator on port 4180.");
    controls();
  };
  const clearAudio = () => {
    stop(); resetTimeline(); sourceBytes = null; sourceName = ""; sourceReady = false;
    $("speech-script").value = "";
    $("script-status").textContent = "Choose a narration to load its matching script automatically.";
    if (audioUrl) URL.revokeObjectURL(audioUrl); audioUrl = null;
    audio.removeAttribute("src"); audio.load(); $("selected-audio").textContent = "No recording selected."; controls();
  };
  $("audio-file").addEventListener("change", async event => {
    narrationSelect.value = "";
    const file = event.target.files[0], version = ++loadVersion; clearAudio();
    if (!file) return;
    try {
      if (file.size > 40 * 1024 * 1024) throw new Error("Use an audio file smaller than 40 MB.");
      await selectAudio(await file.arrayBuffer(), file.name, file.type, version);
    } catch (error) { message(error.message); }
  });
  $("load-example").addEventListener("click", async () => {
    narrationSelect.value = "";
    const name = $("audio-example").value, version = ++loadVersion; clearAudio();
    message("Loading the existing " + name + " recording…");
    try {
      const response = await fetch("../assets/cv/interactive/languages/sound/" + name + ".mp3");
      if (!response.ok) throw new Error("The example recording could not be loaded.");
      await selectAudio(await response.arrayBuffer(), name + ".mp3", "audio/mpeg", version);
      if (version === loadVersion) { $("speech-recognizer").value = name === "English" ? "pocketSphinx" : "phonetic"; controls(); }
    } catch (error) { if (version === loadVersion) message(error.message); }
  });
  $("speech-recognizer").addEventListener("change", controls);

  const loadCatalogue = async () => {
    if (catalogueLoading || busy) return;
    catalogueLoading = true; controls();
    $("narration-status").textContent = "Finding your narration recordings…";
    try {
      let files = null, live = false;
      // The local static server lists the real folder, including newly added files.
      // Public static hosts often disable directory listings: use the checked-in
      // catalogue there, without contacting a visitor's local computer.
      if (["127.0.0.1", "localhost"].includes(location.hostname)) {
        try {
          const response = await fetch(narrationRoot, { cache: "no-store" });
          if (response.ok) {
            const listing = new DOMParser().parseFromString(await response.text(), "text/html");
            const found = [...listing.querySelectorAll("a[href]")].flatMap(link => {
              try { const file = decodeURIComponent(link.getAttribute("href")); return validNarrationFile(file) ? [file] : []; }
              catch { return []; }
            });
            if (found.length) { files = found; live = true; }
          }
        } catch { /* A bundled catalogue keeps the picker usable without a listing. */ }
      }
      if (!files) {
        const response = await fetch("narration-recordings.json", { cache: "no-store" });
        if (!response.ok) throw new Error("The narration list could not be loaded.");
        const catalogue = await response.json();
        if (catalogue.version !== 1 || !Array.isArray(catalogue.files)) throw new Error("The narration list is invalid.");
        files = catalogue.files.filter(validNarrationFile);
      }
      files = [...new Set(files)].sort((a, b) => a === "welcome.mp3" ? -1 : b === "welcome.mp3" ? 1 : a.localeCompare(b));
      const previous = narrationSelect.value;
      narrationSelect.replaceChildren(new Option("Choose a narration…", ""));
      for (const file of files) narrationSelect.append(new Option(narrationLabel(file) + " · " + file, file));
      if (files.includes(previous)) narrationSelect.value = previous;
      $("narration-status").textContent = `${files.length} narrations available${live ? " · from your local folder" : " · saved catalogue"}.`;
    } catch (error) {
      $("narration-status").textContent = error.message + " You can still choose an audio file below.";
    } finally { catalogueLoading = false; controls(); }
  };
  const loadNarration = async () => {
    const file = narrationSelect.value;
    if (busy || !validNarrationFile(file)) return;
    const version = ++loadVersion; clearAudio(); $("audio-file").value = "";
    message("Loading narration: " + narrationLabel(file) + "…");
    try {
      const response = await fetch(narrationRoot + encodeURIComponent(file), { cache: "no-store" });
      if (!response.ok) throw new Error("This narration could not be loaded. Refresh the list or choose the file below.");
      const size = Number(response.headers.get("Content-Length"));
      if (size > 40 * 1024 * 1024) throw new Error("Use an audio file smaller than 40 MB.");
      await selectAudio(await response.arrayBuffer(), file, response.headers.get("Content-Type"), version);
      if (version === loadVersion) {
        // The current CV narration script is English; the mode remains adjustable.
        $("speech-recognizer").value = "pocketSphinx"; controls();
      }
    } catch (error) { if (version === loadVersion) message(error.message); }
  };
  narrationSelect.addEventListener("change", loadNarration);
  $("load-narration").addEventListener("click", loadNarration);
  $("refresh-narrations").addEventListener("click", loadCatalogue);

  const base64Wav = async bytes => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass || !window.OfflineAudioContext) throw new Error("This browser cannot decode audio. Try a current Chrome, Edge or Firefox.");
    const context = new AudioContextClass();
    let decoded;
    try { decoded = await context.decodeAudioData(bytes.slice(0)); }
    finally { await context.close(); }
    if (!Number.isFinite(decoded.duration) || decoded.duration < .02 || decoded.duration > 600) throw new Error("Use a recording between 20 milliseconds and 10 minutes.");
    const length = Math.ceil(decoded.duration * 16000), offline = new OfflineAudioContext(1, length, 16000);
    const source = offline.createBufferSource(); source.buffer = decoded; source.connect(offline.destination); source.start();
    const rendered = await offline.startRendering(), samples = rendered.getChannelData(0);
    const wav = new ArrayBuffer(44 + samples.length * 2), view = new DataView(wav);
    const ascii = (offset, text) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); };
    ascii(0, "RIFF"); view.setUint32(4, wav.byteLength - 8, true); ascii(8, "WAVE"); ascii(12, "fmt ");
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    ascii(36, "data"); view.setUint32(40, samples.length * 2, true);
    for (let i = 0; i < samples.length; i++) { const s = Math.max(-1, Math.min(1, samples[i])); view.setInt16(44 + i * 2, Math.round(s * (s < 0 ? 32768 : 32767)), true); }
    const bytesView = new Uint8Array(wav), chunks = [];
    for (let i = 0; i < bytesView.length; i += 8192) chunks.push(String.fromCharCode(...bytesView.subarray(i, i + 8192)));
    return btoa(chunks.join(""));
  };
  const updateExport = () => {
    const offset = timeline.mouthOffsetMs || 0;
    $("timing-summary").textContent = `${timeline.mouthCues.length} mouth cues · ${timeline.durationMs} ms · ${timeline.recognizer || "imported timing"} · mouth offset ${offset > 0 ? "+" : ""}${offset} ms. Listed times are before the offset.`;
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    const json = JSON.stringify(timeline, null, 2) + "\n";
    $("timing-json").value = json;
    downloadUrl = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const link = $("download-timing"); link.href = downloadUrl; link.download = sourceName.replace(/\.[^.]+$/, "") + ".mouth-timing.json"; link.hidden = false;
  };
  offsetInput.addEventListener("input", () => {
    controls();
    if (!offsetInput.validity.valid) return;
    if (timeline) {
      timeline.mouthOffsetMs = readOffset(); updateExport(); dispatchFrame();
    }
  });
  offsetInput.addEventListener("change", () => {
    if (!offsetInput.validity.valid) message("Enter a whole-number mouth offset between -5000 and 5000 ms.");
    else if (timeline) message("Mouth offset updated. No need to generate again; the exported JSON includes your adjustment.");
  });
  const acceptTimeline = value => {
    const checked = MouthTimeline.validate(value);
    if (checked.audioFile !== sourceName) throw new Error("This timeline belongs to " + checked.audioFile + ". Select that same recording first.");
    if (!Number.isFinite(audio.duration) || Math.abs(audio.duration * 1000 - checked.durationMs) > 150) throw new Error("The recording and timeline durations do not match. Wait for the audio to load, or use the original recording.");
    timeline = { ...checked, mouthOffsetMs: checked.mouthOffsetMs ?? readOffset() };
    offsetInput.value = String(timeline.mouthOffsetMs);
    const rows = document.createDocumentFragment();
    for (const cue of timeline.mouthCues) {
      const row = document.createElement("tr");
      for (const text of [cue.startMs, cue.endMs, cue.pose]) { const td = document.createElement("td"); td.textContent = text; row.append(td); }
      rows.append(row);
    }
    $("timing-list").replaceChildren(rows);
    updateExport();
    dispatchFrame();
    message("Timing ready. Press Play in the audio player to hear the recording and see the matched mouth movements.");
  };
  $("generate-timing").addEventListener("click", async () => {
    if (busy || !sourceBytes || !sourceReady || !token || !ready || !offsetInput.validity.valid) return;
    busy = true; stop(); resetTimeline(); controls(); $("analysis-progress").hidden = false;
    message("Preparing audio locally…");
    try {
      const audioBase64 = await base64Wav(sourceBytes);
      message("Matching speech sounds locally. Longer recordings can take a few minutes…");
      const response = await fetch("/api/lipsync", { method: "POST", headers: { "Content-Type": "application/json", "X-Workshop-Token": token },
        body: JSON.stringify({ audioBase64, filename: sourceName, recognizer: $("speech-recognizer").value,
          script: $("speech-recognizer").value === "pocketSphinx" ? $("speech-script").value : "" }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The local recognizer could not generate timing.");
      acceptTimeline(result);
    } catch (error) { message("Could not generate timing: " + error.message); }
    finally { busy = false; $("analysis-progress").hidden = true; controls(); }
  });
  $("timeline-file").addEventListener("change", async event => {
    const file = event.target.files[0]; if (!file || busy) return;
    stop(); resetTimeline();
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error("This timing file is too large.");
      acceptTimeline(JSON.parse(await file.text()));
    } catch (error) { message("Could not load timing: " + error.message); }
    finally { event.target.value = ""; }
  });
  controls();
  loadCatalogue();
  // No attempt to reach a visitor's localhost from a deployed site.
  if (["127.0.0.1", "localhost"].includes(location.hostname) && location.port === "4180") {
    fetch("/api/status").then(response => {
      if (!response.ok) throw new Error("Generator unavailable"); return response.json();
    }).then(info => {
      if (!info.ready || typeof info.token !== "string") throw new Error("Recognizer unavailable");
      token = info.token; controls(); message("Local recognizer ready. Choose a recording; no script is required.");
    }).catch(() => message("Local generator unavailable. Start tools/lip-sync/start-workshop.cmd, or load saved timing."));
  } else message("To generate new timing, start tools/lip-sync/start-workshop.cmd and open the workshop on port 4180. Saved timing can still be loaded here.");
})();
