# Command reference blueprints

The current training source is `dist/voice-tour/audio/commands/*.mp3`. The import removes numeric recording suffixes to group each command, and maps the filename typo `gymnaisum` to `gymnasium`. Original MP3s are unchanged; analysis WAVs and individual blueprints are in `commands/blueprints`, and grouped reference JSONs in `commands/references`.

For new source MP3s, use `decode-command-audio.py SOURCE_FOLDER TEMP_WAV_FOLDER` (requires NumPy and SoundFile), then `node tools/lip-sync/import-command-audio.cjs P:/Marju TEMP_WAV_FOLDER`. Decode produces mono PCM16 16 kHz copies with Fourier resampling. Import uses the same shared settings as the Commands matcher. It updates only its own source-linked blueprint folders and does not remove unrelated training data.

The Commands page compares a new recording against one ordered reference per name, not against the best individual saved example.

All recordings are reanalysed with Type 2 / Sensitive / dead zone 0.075. Samples between -0.075 and +0.075 are ignored for the amplitude envelope, not removed from time or the Fourier/MFCC audio. The rebuild tool reads the shared matcher settings to keep references and queries consistent. Normalized analysis is added as `normalizedBlueprint` inside each existing blueprint; historic analysis and WAVs remain intact. SHA-256 of the WAV identifies duplicate saves within each command.

The most central sequence (minimum total pairwise alignment distance) supplies the scaffold. Ordered edit alignment uses chunk MFCC distance and chunk type. Corresponding positions are averaged and use the majority chunk type. Unmatched insertions are not added to the scaffold. Each slot includes its support count. A single recording remains a single-example reference. An average of fingerprint standard deviations is a descriptor average, not the pooled variance of raw frames.

Scoring: 35% whole-recording fingerprint distance, 45% ordered chunk acoustic/type alignment, 15% chunk-type edit distance and 5% count difference. Cutoffs are experimental, not probabilities. Closed chunks without useful MFCCs retain their type; missing fingerprints receive a penalty.

To rebuild after adding recordings, run `node tools/lip-sync/normalize-command-blueprints.cjs P:/Marju` from the project. It also saves one JSON per command in `commands/references`. Refresh blueprints on the Commands page afterwards. The browser rebuilds the same references from the normalized examples, so saved reference JSONs are inspection/export snapshots.

Test recordings are saved to `chunktest`, never automatically added to training.
