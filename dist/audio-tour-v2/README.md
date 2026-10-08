# Audio tour version 2

Visitor-facing tour at `/audio-tour-v2/`, linked from the CV header. Nothing starts or captures a microphone until a visitor chooses to start. Version 1, the character workshop and chunk analysis remain separate.

## Classes and responsibilities

- `js/narration-library.js`: validates command mappings, resolves paths and caches narration JSON.
- `js/narration-player.js`: loads recordings, checks timing, caches the character renderer, and controls animation. Cancels stale loads.
- `js/tour-view.js`: labelled buttons, transcripts, status announcements and other DOM updates.
- `js/speech-input.js`: local language-pack setup, filtered microphone lifetime and all-command recognition during playback or between narrations.
- `js/tour-controller.js`: user actions, narration selection, lifecycle cleanup and composition of the state machine.
- `js/app.js`: small composition root; constructs the application.
- `lib/`: snapshots of the proven shared contracts, anchored renderer, recognition helpers, echo-cancelled input class and tour-flow state machine. Version 2 does not load scripts from the test page.

## Content

Edit `commands.json` to map a phrase to a narration or language sample. Narration configurations live in `narrations/`; character definitions and cropped artwork live in `anchored-character/`. Existing audio remains shared under `../voice-tour/` and `../assets/`. Narration mouth offsets remain -30 ms.

Every mapped command can interrupt narration or be spoken afterwards. Normal choices wait for a final recognised phrase; Stop also accepts an interim match for faster interruption. Unmatched speech during playback is ignored. Stop interrupts to goodbye, closes the microphone and finishes without restarting listening. Escape, Pause, hiding the page and leaving it cancel everything immediately. Button-only mode needs no microphone. Nothing-heard plays the existing reminder then reopens the choice window. Its old recording still mentions a Listen button and should be re-recorded. This all-command mode is experimental: headphones help avoid narration triggering its own choices.

Local recognition requires browser support and an installed English pack; pack installation needs a connection. Echo cancellation requires a supported microphone and recognition accepting an audio track. The page explicitly supplies the filtered track, checks microphone settings and has no deliberate raw-input or online fallback. Browser implementations may vary; real speaker/microphone tests are still necessary. Narration echo rejection is not guaranteed. Existing language samples lack transcripts and lip-sync timing. Tartu and Lexicon now have individual recordings, complete mouth timelines with a -30 ms offset, and mapped education commands.

In current testing, “Komvux” and “Skövde” are still not recognised reliably as voice commands, although their buttons and narrations work. Their Swedish names may be difficult for the English recognition model; this suspected cause has not been confirmed.
