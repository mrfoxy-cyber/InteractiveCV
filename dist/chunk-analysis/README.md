# Chunk analysis

Open http://127.0.0.1:4180/chunk-analysis/ using the local workshop server.
Choose a saved training recording in the same browser, upload a short sound, or record five seconds.
The page shows raw/smoothed pitch, energy, chunk boundaries, split reasons and length ranks.
Each chunk can be played separately. This does not change learning data.

## Sound graphs

Type 2 classifies Stable regions longer than 7.5% of full recording duration as white Noise chunks (N1/N2 labels). Exactly 7.5% remains a normal Stable chunk. Raising/falling regions are unchanged. Noise chunks are excluded from the registered chunk list, table, Fourier region selector and individual playback, and do not become Between chunks regions. Their original timing is retained in `pattern.noiseChunks`, and they are shown white in the waveform, amplitude graph and FFT time strips. The original full sound and full-recording FFT remain intact. Noise is an experimental label based on duration/direction, not a reliable acoustic noise classifier.

Type 2 also has a numeric dead-zone input (0–1, decimals allowed, default 0). Samples with `abs(sample) <= deadZone` contribute zero to its amplitude envelope; larger samples retain their original amplitude. No samples are deleted or times shortened. This filter does not change the recording, waveform samples, Fourier spectra or Type 1 pitch detection. Changing it on blur/Enter reanalyzes the current sound and stores `parameters.deadZone` in the report. Invalid values leave the previous analysis intact. It is sample gating, not background-noise subtraction.

The Chunking method dropdown selects Type 1 (existing pitch direction) or Type 2 (rectified amplitude envelope). Type 2 has Balanced (original), Sensitive (new default) and Very sensitive presets, shown only for Type 2. Sensitive uses 30 ms averaging, 30 ms smoothing, a 60 ms slope span, threshold max(0.0003, 1% of peak envelope), and merges direction runs shorter than 40 ms. Very sensitive uses 20 ms averaging, 10 ms smoothing, 40 ms slope span, threshold max(0.00015, 0.5% of peak), and merges runs shorter than 30 ms. Balanced retains the original 40/50/80 ms windows and 80 ms minimum. There is a 300-chunk report limit for noisy recordings. Visible types are Raising / Going down / Stable; JSON directions remain rising/falling/stable for compatibility. These are amplitude changes, not pitch or word recognition. The chunks cover the full recording including stable silence. Existing pitch detection and comparison are unchanged; pitch comparison is disabled while Type 2 is selected. Switching reanalyzes/saves the current recording with method and parameters in JSON, without requesting microphone access. Run `node test-amplitude.cjs` for deterministic tests.

1. Waveform: decoded mono 16 kHz samples, min/max envelope per canvas pixel, chunk shading and an audio-clock playback cursor.
2. Whole-recording FFT: average window power, not a time-frequency spectrogram.
3. Selected-chunk FFT: same frequency and level axes. Select a chunk or use its Play button to inspect it.

Playback markers follow the audio clock in both the waveform and pitch graph. Each FFT canvas has a separate recording-time strip with a red marker (and selected-chunk shading). Frequency spectra stay averaged; time is not incorrectly plotted on their Hz axes. Pausing freezes markers; full-recording and chunk playback, seeking and replay update them.

Between-chunks regions are the complement of the union of detected pitch spans, including leading and trailing gaps. Overlapping pitch spans stay unchanged and do not generate false gaps. Gaps are green, labelled B1/B2/etc., selectable for FFT and playable from the table. They are not assumed to be silence or consonants, and they are excluded from the original pitch-pattern comparison. With no pitch chunks, the entire recording is one between-chunks region. Region boundaries and frequency summaries are also saved in JSON.

The dependency-free radix-2 FFT runs in the existing worker: 2,048-sample Hann windows, 320-sample hops, 7.8125 Hz bins. Partial windows are zero-padded and never include audio beyond the selected chunk. Zero-padding does not improve the actual resolution of short sounds. Only frequencies up to 8 kHz are available after resampling. The dominant FFT bin is not necessarily fundamental pitch. Levels are digital, not calibrated sound-pressure measurements. No Mel filtering or word recognition is added here.

`analysis.json` now includes `frequencyAnalysis`: FFT settings, full-recording spectrum bins and compact chunk summaries (times, frame count, peak frequency/level). Detailed chunk spectra stay in browser memory for graphing, so the saved report stays within the server's existing size limit. Audio and analysis remain local; no external library or third-party API is loaded. The existing local workshop save endpoint still receives recordings. Waveforms/FFT remain available even when pitch detection finds no pattern.

Run `node test-frequency.cjs` to check known tones, silence, chunk isolation and graph rendering.

Each completed analysis is automatically saved in a unique `P:\Marju\chunktest\<UTC timestamp-id>` folder:
- `recording.wav`: mono 16-bit 16 kHz audio used for analysis.
- `analysis.json`: label, source recording key, parameters, pitch/energy trace, chunks and any pitch-analysis error.

No recordings are sent to a third party. The local endpoint checks origin and the workshop token.
`chunktest` lives outside public `dist` and is ignored by the existing root .gitignore.
If saving fails, the page explicitly says so and allows retry without recording again.
No pitch chunks does not prevent saving the audio/error report. Undecodable audio is not saved.

Pitch chunks are not syllables or recognised words. Analysis uses the same pitch algorithm as recognition.
Window spans may overlap: frame-count duration is what the length-rank comparison uses.
