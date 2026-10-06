# InteractiveCV

An illustrated, interactive CV for Marju Halmann, junior software developer.

**Explore the live website: [marjuhalmann.com](https://marjuhalmann.com/)**

![Illustrated portrait of Marju](dist/assets/cv/interactive/character/marju-natural-v2.png)

## Explore the scene

- Potatoes and the potato bag open individual projects or an expandable project list.
- Books open education details and grouped courses.
- An old brown suitcase opens work experience.
- Skill illustrations open development, testing, and support experience.
- Speech bubbles open language information and recordings spoken by Marju.
- The portrait opens a personal profile.
- A playable JavaScript Frog Game is available on its own subpage.

The site includes keyboard navigation, screen-reader labels and image descriptions, dialog focus handling, and reduced-motion support. Language recordings start only when the visitor chooses Play. A full assistive-technology audit has not yet been completed.

## Run locally

This is a static HTML, CSS, and JavaScript site. No build step or package installation is required.

From the repository folder, with Python installed:

```sh
python -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Open [http://127.0.0.1:4173/](http://127.0.0.1:4173/). The Frog Game is at `/frog-game/`, and the visitor-facing audio tour is at `/audio-tour-v2/`, also linked from the CV header.

Saved narration playback works on a static server. Voice input additionally requires a supported browser, microphone permission and an installed English speech pack. Use localhost when testing, or HTTPS when hosting. For local mouth-timing generation and automatic chunk-report saving, use the separate workshop server described below.

For hosting, publish the contents of `dist/` as the website root.

## Project layout

```text
dist/
  index.html            Main illustrated CV
  styles.css            Layout, animation, and accessibility styling
  app.js                CV content, dialogs, and language playback
  image-hit-areas.js    Image-shaped pointer targeting
  assets/               Website artwork and recordings
  frog-game/            Playable browser game and its assets
  voice-tour/           Narration recordings, command examples, and recording guide
  character-map/        Separate anchored character and audio timing workshop
  chunk-analysis/       Experimental pitch/chunk visualisation and comparison
  audio-tour-test/      Original audio-tour sandbox and sound-pattern experiments
  audio-tour-v2/        Visitor-facing, class-based conversational audio tour
tools/
  lip-sync/             Local-only audio-to-mouth authoring pipeline
```

The current files in `dist/` are the editable website source, not generated build output.

## Frog Game

The original game was made in Unity. The browser version recreates similar gameplay in JavaScript using the remaining game assets. The latest Unity version was unfortunately lost.

## Audio and interaction experiments

This CV is also a playground for exploring spoken navigation, sound-pattern recognition and a lightly animated guide. These are practical experiments, not a claim of production-grade speech recognition or a completed accessibility solution. Accessible buttons, keyboard navigation and narration text remain available alongside voice controls.

### Recorded narration and anchored animation

Instead of video, the guide combines a fixed character image with small masked patches for eyes, mouth and loose hair. The body, hands and feet remain anchored. Animation follows the recording's playback clock, and visitors can disable it; reduced-motion preferences are respected. The original portrait in the illustrated CV stays unchanged.

Each narration JSON describes its audio, transcript, character package, mouth cues, blinking and hair movement. The twenty generated narration configurations use a **−30 ms mouth offset**, so the mouth animation runs slightly ahead of the sound. Compact cropped patches reduce image loading without changing their alignment. Existing language samples can also be played, but do not yet have transcripts or lip-sync timing.

The [character workshop](dist/character-map/anchored.html) generates approximate mouth-pose timelines locally with Rhubarb Lip Sync. It does not require a transcript; English mode accepts an optional script. Double-click `tools/lip-sync/start-workshop.cmd` and open [the local workshop](http://127.0.0.1:4180/character-map/anchored.html). See [setup and privacy details](tools/lip-sync/README.md). Generated timing is visual guidance, not speech transcription, precise vowel identification or a lip-reading aid.

### Sound templates, pitch patterns and chunk analysis

Earlier experiments tried recognising short commands by comparing recordings rather than using full speech recognition:

- Frequency-based templates use MFCC audio features and dynamic time warping to compare examples with different speaking speeds.
- Pitch-pattern experiments split the sound into rising, falling, stable and discontinuity-related segments. Chunk count, types and relative ranks were explored instead of relying on exact pitch or duration.
- A hybrid approach shortlisted candidates using chunks, then compared their frequency features.

These approaches were not reliable enough for general spoken navigation. The recognisers, analysis tools and recorded examples remain useful for experimentation, but they are not the command engine used by Audio Tour v2.

The separate [chunk-analysis page](dist/chunk-analysis/index.html) shows pitch and energy traces, chunk boundaries, split reasons and duration ranks. Recordings and individual chunks can be played back for inspection. Pitch chunks are **not** syllables, vowels or recognised words. With the local workshop server, completed analyses save audio and JSON reports into the private, Git-ignored `chunktest/` working folder; they are not sent to a third-party service. Older labelled command captures are kept separately in the ignored `voice-commands/` working folder.

### Audio Tour v2: spoken navigation

The [visitor-facing audio tour](dist/audio-tour-v2/index.html) uses the browser's on-device English speech recognition, not the earlier template matcher. It explicitly requests local processing and has no deliberate online recognition fallback. The browser may need a one-time English language-pack download before it can listen.

Start the tour, allow microphone access, and say a mapped choice such as “education”, “projects”, “skills”, “languages”, “help”, “back”, “menu” or “repeat”. The current experiment accepts **all 22 mapped commands during narration as well as between recordings**. A recognised choice interrupts the current recording and opens its corresponding narration. Ordinary choices wait for a final recognised phrase; “stop” can respond to an interim match, interrupts to the goodbye recording, then closes the microphone. Nothing-heard plays a reminder and listens again. Pause, Escape, leaving the page or hiding its tab cancels playback and microphone capture.

Microphone input requests echo cancellation, noise suppression and automatic gain control, and supplies the filtered audio track to local recognition. This aims to keep speaker playback from triggering voice commands; it is not perfect subtraction of the narration. Audio-track recognition and on-device processing depend on browser support. **Headphones are recommended**, especially with all-command interruption enabled. Button-only mode needs no microphone. The tour does not save microphone recordings or recognised words.

Known gaps: Tartu and Lexicon do not yet have individual narrations; language samples lack transcripts and mouth timing; the older nothing-heard recording still mentions a Listen button that the automatic tour no longer uses. In current testing, “Komvux” and “Skövde” are still not recognised reliably as voice commands, although their buttons and narrations work. Their Swedish names may be difficult for the English recognition model; this suspected cause has not been confirmed. Recognition accuracy, echo rejection and assistive-technology behaviour still need wider real-device testing.

Version 2 keeps responsibilities in small classes: `NarrationLibrary`, `NarrationPlayer`, `TourView`, `SpeechInput` and `TourController`. JSON mappings and character definitions are separate from playback and navigation logic. See the [version 2 architecture and content guide](dist/audio-tour-v2/README.md).

The original tour sandbox, character workshop and chunk-analysis page are retained separately. Only static website files should be published; **never expose the local authoring server to the internet**.

### Checks

The version 2 checks cover narration contracts and paths, −30 ms offsets, cached JSON, goodbye cleanup, button-only mode, cancelled microphone requests, all-command interruption and rejection of stale recognition callbacks:

```sh
node dist/audio-tour-v2/test-v2.mjs
node dist/audio-tour-v2/test-all-commands.cjs
```

These automated checks use controlled inputs; they do not establish real microphone accuracy, browser compatibility or a complete accessibility audit.

## Credits and public demos

The website was developed with AI assistance, and its illustrated artwork includes AI-generated assets. Marju provides the CV content, project direction, and language recordings.

The Goatly login details shown on the website are deliberately public demo credentials, not credentials for this CV. Use them only with the linked demo environment.

Private source documents, duplicate working assets, recording documents, temporary files, and local configuration are excluded from this repository.
