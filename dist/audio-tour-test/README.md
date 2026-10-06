# Audio-tour test

Open `/audio-tour-test/` on the local server. No video or authoring server is required for playback of saved JSON. Nothing replaces the original CV portrait.

## Folder contract

```
audio-tour-test/
  anchored-character/
    character.json       Character identity and relative region/mouth-map paths
    base/                Anchor, blink, hair and bounded region definitions
    mouths/              Mouth images, crop registration and pose mapping
  narrations/
    welcome.preview.json Blink/hair-only starter (explicitly no lip sync)
    welcome.narration.json Your workshop export, including real mouth cues
  tour-config.js         Shared versioned narration validation
  tour-renderer.js       Bounded character rendering, independent of narration
  tour-player.js         Audio-clock-driven playback
```

Sound files remain in `voice-tour/audio/narration/` without duplication. The narration JSON references them; it does not contain encoded audio or character pixels.

## Export and test

1. In the anchored workshop, select audio and generate (or import) mouth timing.
2. Set Eyes and Hair checkboxes as desired. Edit the auto-loaded transcript if needed.
3. In Audio-tour narration export, check character/sound paths and download the narration JSON. A copyable JSON field is provided too.
4. Save it in `dist/audio-tour-test/narrations/`. On the test page, choose that exported JSON. For a recording not on the website yet, choose an optional audio replacement.

Uploaded JSON paths are resolved as if the file lives in this narrations folder, not the Downloads directory. No files are uploaded to a service or silently saved to disk. Audio must match the timing duration within 150 ms. Timing offset is saved within `mouthTiming.mouthOffsetMs`.

## Changing things

- Change `audio.src` to replace sound, then regenerate mouth timing for a different recording.
- Change `character` to another package's `character.json` to replace the character. That package needs the same pose IDs used by the narration (or corresponding remapped cues).
- Change `animations.blink` and `animations.hair` enabled/cycle settings without regenerating mouth timing. Blink close/hold/open times must fit within its cycle.
- Add a new exported JSON for another narration; the same player loads it using the file chooser. This test does not yet wire navigation or speech commands into the main CV.

Schema version 1 uses `kind: audio-tour-narration`, `title`, `character`, `audio.src`, `transcript`, `mouthTiming`, and `animations`. All paths are relative to their containing JSON and restricted to same-site assets. Character region and mouth-map paths are relative to `character.json`; image filenames are relative to their maps. Coordinates use the base image's native pixels, no resizing of mouth patches. Only active masked regions can change; hands, feet and body remain anchored.

The welcome starter intentionally has `mouthTiming: null`. Generate a real narration export to test synchronized mouth movement rather than invented timing.

All twenty recorded narrations now have complete saved JSONs, listed in `narrations/catalogue.json`. The test page loads Welcome with real mouth timing by default and provides a saved-narration dropdown. Every narration uses `mouthTiming.mouthOffsetMs: -30`: mouth movement is 30 ms earlier, without shifting audio or cue timestamps. The older preview JSON remains only as a reference.

## Compact playback images

The character descriptor now uses `base/regions.compact.json` and `mouths/mouth-map.compact.json`. Playback loads sixteen native-pixel patches (two eyes, two hair tips, twelve mouth poses) instead of full-frame animation sources. Patches retain exactly the same source pixels, destination bounds, feathering and root fades. Only the resting anchor stays full-sized.

Full-frame originals and their original maps remain untouched for editing. `tools/lip-sync/crop-character.py` can rebuild compact files into a separate output folder using Pillow; it verifies every saved crop pixel-for-pixel. Existing narration JSON needs no changes.
