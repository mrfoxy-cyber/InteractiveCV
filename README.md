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

Open [http://127.0.0.1:4173/](http://127.0.0.1:4173/). The Frog Game is at `/frog-game/`.

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
  voice-tour/           Planned voice-tour templates and recording guide
  character-map/        Separate anchored character and audio timing workshop
tools/
  lip-sync/             Local-only audio-to-mouth authoring pipeline
```

The current files in `dist/` are the editable website source, not generated build output.

## Frog Game

The original game was made in Unity. The browser version recreates similar gameplay in JavaScript using the remaining game assets. The latest Unity version was unfortunately lost.

## Voice-tour experiment

The voice-tour folder contains a recording plan and command templates. Visitor voice-command recognition and the conversational audio tour are not implemented yet. Existing language recordings are separate from this planned experiment.

The separate character workshop can now analyse recordings locally with Rhubarb Lip Sync and export millisecond mouth-pose timelines. Double-click `tools/lip-sync/start-workshop.cmd` and open http://127.0.0.1:4180/character-map/anchored.html. A transcript is not required; English mode accepts an optional script. See [setup and privacy details](tools/lip-sync/README.md). Timing is approximate; it is not a transcript or exact vowel identification. Saved timelines can be replayed on the static workshop without the recognizer. The original CV portrait is not replaced or animated, and the local authoring server must not be publicly hosted.

## Credits and public demos

The website was developed with AI assistance, and its illustrated artwork includes AI-generated assets. Marju provides the CV content, project direction, and language recordings.

The Goatly login details shown on the website are deliberately public demo credentials, not credentials for this CV. Use them only with the linked demo environment.

Private source documents, duplicate working assets, recording documents, temporary files, and local configuration are excluded from this repository.
