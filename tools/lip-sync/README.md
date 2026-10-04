# Local audio-to-mouth workshop

Double-click `start-workshop.cmd`, leave its window running, and open
http://127.0.0.1:4180/character-map/anchored.html.

Choose an MP3/WAV or try an existing language recording. Press **Generate mouth timing**, wait, then use the audio player's Play button. Download the JSON timeline when happy. If an embedded browser does not handle downloads, use **Copyable JSON** inside **Timing list & export**. You can reload that JSON with the same audio on the ordinary static preview too; the recognizer is needed only to generate new timing.

## Pipeline

Audio → decode and resample locally to mono 16 kHz WAV → Rhubarb speech-sound recognition → timed visual mouth cues → mapped anchored mouth sprites. The generated list has integer `startMs` and `endMs` timestamps. Playback uses the audio player's actual clock, including pause, seeking and playback-speed changes, rather than an independent animation timer. Silence and the end of playback return to the original resting mouth. Short transitions soften pose changes without stretching the patches.

Default **Any language** uses the language-independent phonetic recognizer. **English** uses PocketSphinx; a plain-text script is optional in that mode and may improve results. No transcript is required. This is not the earlier DTW whole-command template experiment: speech-sound recognition needs context, not independent nearest matches to tiny waveform slices. The existing model supplies the sound recognition; you do not need to record vowel templates first.

It generates approximate visual mouth shapes, not a reliable transcript, exact vowel labels, or lip-reading aid. Background music, noise and unclear speech reduce accuracy. Listen and inspect before publishing. Rhubarb provides nine shape categories; these map to eight of the existing poses because C and D both use the preferred gentle open mouth. The other five artwork poses (including rest in the thirteen total choices) are not automatically distinguished by this recognizer. The 12-pose gallery remains for manual inspection/refinement. Mapping: A→bmp, B→cdnstxyz, C/D→aei, E→o, F→u, G→fv, H→l, X→rest.

Only the separate audio-tour workshop changes. The original CV portrait, body, hands and feet remain untouched. Audio requires explicit Play; decorative movement can be disabled independently. Hidden tabs pause playback. Generated timing is not a substitute for accessible controls or a narration transcript.

## Setup on another computer

Python 3.10+ (standard library only) and the official Windows Rhubarb release are required. Download [Rhubarb 1.14.0](https://github.com/DanielSWolf/rhubarb-lip-sync/releases/tag/v1.14.0), extract `Rhubarb-Lip-Sync-1.14.0-Windows` into `tools/lip-sync/vendor/`, keeping the executable, dependencies and `res` directory together. The vendor directory is ignored by Git. Keep its upstream license files with the local distribution. For other systems pass `--rhubarb /path/to/rhubarb` to `server.py`. No FFmpeg or paid API is required: the browser converts supported audio to WAV.

Run `python tools/lip-sync/server.py`. Port 4180 is deliberately separate from the existing static preview on 4173. The server binds only to 127.0.0.1 and accepts generation requests only from its own origin with a per-session token. Do not expose this authoring server to the internet; deploy only the static artwork, approved audio and exported timing. Recording size is limited to 40 MB in the browser / ten minutes after decoding. Analysis has a five-minute timeout and only one analysis runs at a time.

Recordings and scripts are sent only to this computer's local server. Temporary WAV/script files are removed after analysis, including failures; output JSON contains only the audio basename, never its private absolute path. Uploaded audio is not automatically copied into the website or committed. Browser-selected files and generated timings remain in memory until explicitly downloaded. If you add published recordings later, review consent and transcripts first.

See the [official recognizer and mouth-shape documentation](https://github.com/DanielSWolf/rhubarb-lip-sync) for limitations and the original category definitions.

Tests: `python -m unittest discover -s tools/lip-sync -p "test_*.py"` and `node tools/lip-sync/test-timeline.cjs`.
