/* Shared, dependency-free validation and seeking. Times are integer milliseconds. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MouthTimeline = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const poses = new Set(["rest", "aei", "o", "u", "cdnstxyz", "gk", "l", "bmp", "fv", "ee", "th", "chjsh", "qw"]);
  function validate(value) {
    if (!value || value.schemaVersion !== 1 || typeof value.audioFile !== "string" || !value.audioFile
        || value.audioFile.length > 255 || /[\\/]/.test(value.audioFile)
        || !Number.isInteger(value.durationMs) || value.durationMs <= 0 || value.durationMs > 600000
        || !Array.isArray(value.mouthCues) || !value.mouthCues.length || value.mouthCues.length > 60000) {
      throw new Error("Invalid mouth timeline. Use a JSON file exported from this workshop.");
    }
    let end = 0;
    if (value.mouthOffsetMs !== undefined && (!Number.isInteger(value.mouthOffsetMs) || Math.abs(value.mouthOffsetMs) > 5000)) {
      throw new Error("Mouth offset must be a whole number between -5000 and 5000 milliseconds.");
    }
    for (const cue of value.mouthCues) {
      if (!cue || !Number.isInteger(cue.startMs) || !Number.isInteger(cue.endMs)
          || cue.startMs !== end || cue.endMs <= cue.startMs || cue.endMs > value.durationMs || !poses.has(cue.pose)) {
        throw new Error("Timeline contains missing, overlapping or unknown mouth cues.");
      }
      end = cue.endMs;
    }
    if (end !== value.durationMs) throw new Error("The mouth timeline does not cover the recording.");
    return value;
  }
  function sample(timeline, timeMs) {
    // Positive offset delays only the mouth: sample an earlier point in its timeline.
    if (timeline) timeMs -= timeline.mouthOffsetMs || 0;
    if (!timeline || !Number.isFinite(timeMs) || timeMs < 0 || timeMs >= timeline.durationMs) return { pose: "rest", previous: "rest", mix: 1, index: -1 };
    const cues = timeline.mouthCues;
    let low = 0, high = cues.length - 1;
    while (low <= high) {
      const mid = (low + high) >> 1, cue = cues[mid];
      if (timeMs < cue.startMs) high = mid - 1;
      else if (timeMs >= cue.endMs) low = mid + 1;
      else {
        const transition = Math.min(40, (cue.endMs - cue.startMs) / 2);
        return { pose: cue.pose, previous: mid ? cues[mid - 1].pose : "rest", mix: Math.min(1, (timeMs - cue.startMs) / transition), index: mid };
      }
    }
    return { pose: "rest", previous: "rest", mix: 1, index: -1 };
  }
  return { validate, sample };
});
