/* Explicit filename aliases: never guess a transcript for an unknown recording. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.NarrationScript = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const aliases = {"goatly": "project-goatly", "mental-model-graph": "project-mmg", "frog-game": "project-frog",
    "komvux": "education-komvux", "gymnasium": "education-gymnasium"};
  const normalize = file => String(file).replace(/\.[^.]+$/, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  function match(catalogue, file) {
    if (!catalogue || catalogue.version !== 1 || !Array.isArray(catalogue.clips)) return null;
    const key = normalize(file), candidates = [key, aliases[key]].filter(Boolean);
    for (const candidate of candidates) {
      const clip = catalogue.clips.find(item => item && typeof item.file === "string" && typeof item.text === "string" && item.text.trim() && normalize(item.file) === candidate);
      if (clip) return clip;
    }
    return null;
  }
  return { match };
});
