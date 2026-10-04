# Voice-tour recording templates

This pack contains two different recording templates:

1. **Narration:** your longer spoken answers and menus, using the script in `voice-tour.templates.json` under `clips`. Each `text` is exactly what to read; each `file` is the MP3 filename.
2. **Recognition references:** short recordings of the words visitors will say. The `commands` list explicitly connects each recognised phrase to its meaning, menu, page object, and answer recording.

These are templates and a recording plan only. They do not contain audio, trained acoustic features, or a working speech recognizer. We will create those from your sound files later. The existing webpage has not been changed.

## Start small

For the first test, record the six main choices and five navigation commands below. Make three separate takes of each phrase: 33 short recordings. Also record `welcome.mp3`, `help.mp3`, `not-understood.mp3`, and one section answer, such as `about-me.mp3`.

Record the rest after testing that first conversation.

## Command recordings

Read **only** the phrase, once per file. Do not say the filename or add an introduction. Record three natural takes, with small variations in pace. Avoid music, added effects, and strong background noise. Leave a little quiet space before and after each phrase.

WAV is preferred for command reference recordings; keep original recordings if your recorder uses another format. We can convert them later. MP3 is fine for the narration.

| Menu | Say | Save three files as |
| --- | --- | --- |
| Main | About me | `about-me-1.wav`, `about-me-2.wav`, `about-me-3.wav` |
| Main | Education | `education-1.wav`, `education-2.wav`, `education-3.wav` |
| Main | Projects | `projects-1.wav`, `projects-2.wav`, `projects-3.wav` |
| Main | Work experience | `work-experience-1.wav`, `work-experience-2.wav`, `work-experience-3.wav` |
| Main | Skills | `skills-1.wav`, `skills-2.wav`, `skills-3.wav` |
| Main | Languages | `languages-1.wav`, `languages-2.wav`, `languages-3.wav` |
| Education | Skövde | `skovde-1.wav`, `skovde-2.wav`, `skovde-3.wav` |
| Education | Tartu | `tartu-1.wav`, `tartu-2.wav`, `tartu-3.wav` |
| Education | Lexicon | `lexicon-1.wav`, `lexicon-2.wav`, `lexicon-3.wav` |
| Education | Komvux | `komvux-1.wav`, `komvux-2.wav`, `komvux-3.wav` |
| Education | Gymnasium | `gymnasium-1.wav`, `gymnasium-2.wav`, `gymnasium-3.wav` |
| Education | Standalone courses | `standalone-courses-1.wav`, `standalone-courses-2.wav`, `standalone-courses-3.wav` |
| Projects | Goatly | `goatly-1.wav`, `goatly-2.wav`, `goatly-3.wav` |
| Projects | Mental Model Graph | `mental-model-graph-1.wav`, `mental-model-graph-2.wav`, `mental-model-graph-3.wav` |
| Projects | Frog Game | `frog-game-1.wav`, `frog-game-2.wav`, `frog-game-3.wav` |
| Languages | Estonian | `estonian-1.wav`, `estonian-2.wav`, `estonian-3.wav` |
| Languages | English | `english-1.wav`, `english-2.wav`, `english-3.wav` |
| Languages | Swedish | `swedish-1.wav`, `swedish-2.wav`, `swedish-3.wav` |
| Languages | German | `german-1.wav`, `german-2.wav`, `german-3.wav` |
| Everywhere | Back | `back-1.wav`, `back-2.wav`, `back-3.wav` |
| Everywhere | Menu | `menu-1.wav`, `menu-2.wav`, `menu-3.wav` |
| Everywhere | Repeat | `repeat-1.wav`, `repeat-2.wav`, `repeat-3.wav` |
| Everywhere | Help | `help-1.wav`, `help-2.wav`, `help-3.wav` |
| Everywhere | Stop | `stop-1.wav`, `stop-2.wav`, `stop-3.wav` |

The complete initial command set is 24 phrases and 72 recordings. Aliases such as “work” or “MMG” are future options, not required recordings yet. A written alias does not magically become an acoustic template: it needs its own recorded samples when enabled.

## Folder layout

```text
voice-tour/
  voice-tour.templates.json
  recording-guide.md
  audio/
    narration/
      welcome.mp3
      about-me.mp3
      ...the other narration clips
    commands/
      about-me-1.wav
      about-me-2.wav
      about-me-3.wav
      ...the other command takes
```

Put this folder next to `index.html` inside `dist` when integrating the tour. All audio paths in the JSON are relative to the JSON file. The four existing spoken-language examples are reused from `../assets/cv/interactive/languages/sound/`; they are not recognition samples.

## Narration checklist

There are 22 narration clips. Read the corresponding `text` in the JSON:

```text
welcome.mp3
about-me.mp3
education.mp3
education-skovde.mp3
education-tartu.mp3
education-lexicon.mp3
education-komvux.mp3
education-gymnasium.mp3
education-courses.mp3
projects.mp3
project-goatly.mp3
project-mmg.mp3
project-frog.mp3
work-experience.mp3
skills.mp3
languages.mp3
next-choice.mp3
help.mp3
not-understood.mp3
nothing-heard.mp3
microphone-unavailable.mp3
goodbye.mp3
```

The narration matches the script discussed in chat, with short instructions added about using the listen button. Check that ongoing studies and projects are still accurate before recording. Say technical names naturally: “C sharp”, “C plus plus”, “dot net”, and “M M G”.

## How a template connects to an answer

Example: the short samples `goatly-1.wav`, `goatly-2.wav`, and `goatly-3.wav` represent the phrase **Goatly**. A confident match while in the projects menu selects the existing page object `project / goatly`, then plays `audio/narration/project-goatly.mp3`. The meaning is supplied by that explicit mapping, not inferred from the waveform.

Only compare against the current menu's choices plus the five global commands. Reuse the same recognition reference recordings across menus where appropriate; do not compare with narration clips.

## Limits and safeguards for the experiment

- Your recordings are a starting reference set. Recognition of other people's voices, accents, microphones, and background noise must be tested; it is not guaranteed by having templates.
- Dynamic Time Warping is a candidate matching technique, not an already implemented system. It aligns a recorded pattern with a stored reference pattern: [ISCA explanation](https://isca-speech.org/DTW).
- Do not set arbitrary confidence claims before testing. Test held-out recordings and reject ambiguous or unrelated speech, silence, and noise rather than always selecting a closest match.
- Start narration only on request. Ask permission before using the microphone. Do not listen while narration is playing.
- Keep an accessible physical listen/stop control, written transcripts, keyboard navigation, and screen-reader-compatible choices. Spoken “stop” only works while listening; a button must still stop playback immediately.
- Plan local processing; disclose and obtain any necessary consent before changing to an external speech service. Do not store visitor recordings by default.
- Back returns to the previous menu; menu returns to the main choices; repeat replays the current answer; help reads the current menu's choices; stop ends the tour.

## What is still needed

Your recordings, acoustic feature extraction and matching, microphone controls, playback/navigation integration, accessibility checks, and testing with different speakers. No changes to the live website or its normal visual interface are included in this template pack.
