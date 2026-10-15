# Moonshine test

Open `/moonshine-test/` on the workshop server. Load the model, then record a command or test saved MP3s. This is separate from the chunk matcher and production audio tour; matches are displayed only.

Pinned browser package: `@moonshine-ai/moonshine-wasm@0.1.5`. Uses `Transcriber.load` and `TinyStreaming` English model in a module worker. The model and runtime download from external hosts; audio inference stays in the browser. No recordings or results are uploaded or saved. Unload terminates the worker, frees its model, and stops microphone tracks. Leaving or hiding the page unloads too. Browser caching may keep downloaded model bytes.

Start recording explicitly; finish early or wait five seconds. Cancel discards input. Batch tests use the existing 73 source MP3s, not learned templates. English proper nouns remain uncertain. Text maps only to explicit command phrases/IDs and a small alias list; no semantic or fuzzy guessing.

The workshop server sets COOP `same-origin` and COEP `require-corp` only for `/moonshine-test/`. Restart it after installing the update. Production hosting must supply the same page headers for threaded WASM. This page is not yet wired into the real tour.

Official API: https://github.com/moonshine-ai/moonshine/blob/main/docs/quickstart.md
