/* Portable audio-tour contract. Paths are relative to the narration JSON. */
(function(root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./lip-sync-timeline.js"));
  else root.AudioTourConfig = factory(root.MouthTimeline);
})(typeof globalThis !== "undefined" ? globalThis : this, function(Timeline) {
  "use strict";
  function path(value) {
    if (typeof value !== "string" || !value || value.length > 1024 || /[\\\x00-\x1f]/.test(value) || /^[a-z]+:|^\/\//i.test(value)) throw new Error("Use a relative asset path, not an external URL.");
    return value;
  }
  function validate(config) {
    if (!config || config.schemaVersion !== 1 || config.kind !== "audio-tour-narration" || typeof config.title !== "string" || !config.title.trim()) throw new Error("Not an audio-tour narration JSON.");
    path(config.character); path(config.audio?.src);
    if (typeof config.transcript !== "string") throw new Error("A transcript string is required (it may be empty).");
    for (const name of ["blink", "hair"]) {
      const animation = config.animations?.[name];
      if (!animation || typeof animation.enabled !== "boolean") throw new Error("Missing " + name + " settings.");
      for (const field of name === "blink" ? ["cycleMs", "closeMs", "holdMs", "openMs"] : ["cycleMs"]) {
        if (!Number.isInteger(animation[field]) || animation[field] < 1 || animation[field] > 60000) throw new Error("Invalid " + name + " " + field);
      }
      if (name === "blink" && animation.closeMs + animation.holdMs + animation.openMs >= animation.cycleMs) throw new Error("Blink must fit inside its cycle.");
    }
    if (config.mouthTiming !== null) {
      Timeline.validate(config.mouthTiming);
      const filename = decodeURIComponent(config.audio.src.split("/").pop());
      if (filename !== config.mouthTiming.audioFile) throw new Error("Audio filename and mouth timing do not match.");
    }
    return config;
  }
  function create({filename, title, transcript, timeline, blink = true, hair = true}) {
    return validate({schemaVersion: 1, kind: "audio-tour-narration", title: title || filename,
      character: "../anchored-character/character.json",
      audio: {src: "../../voice-tour/audio/narration/" + encodeURIComponent(filename)},
      transcript: transcript || "", mouthTiming: timeline,
      animations: {blink: {enabled: blink, cycleMs: 4800, closeMs: 70, holdMs: 60, openMs: 100}, hair: {enabled: hair, cycleMs: 7200}}});
  }
  return {validate, create, path};
});
