# Chunk analysis

Open http://127.0.0.1:4180/chunk-analysis/ using the local workshop server.
Choose a saved training recording in the same browser, upload a short sound, or record five seconds.
The page shows raw/smoothed pitch, energy, chunk boundaries, split reasons and length ranks.
Each chunk can be played separately. This does not change learning data.

Each completed analysis is automatically saved in a unique `P:\Marju\chunktest\<UTC timestamp-id>` folder:
- `recording.wav`: mono 16-bit 16 kHz audio used for analysis.
- `analysis.json`: label, source recording key, parameters, pitch/energy trace, chunks and any pitch-analysis error.

No recordings are sent to a third party. The local endpoint checks origin and the workshop token.
`chunktest` lives outside public `dist` and is ignored by the existing root .gitignore.
If saving fails, the page explicitly says so and allows retry without recording again.
No pitch chunks does not prevent saving the audio/error report. Undecodable audio is not saved.

Pitch chunks are not syllables or recognised words. Analysis uses the same pitch algorithm as recognition.
Window spans may overlap: frame-count duration is what the length-rank comparison uses.
