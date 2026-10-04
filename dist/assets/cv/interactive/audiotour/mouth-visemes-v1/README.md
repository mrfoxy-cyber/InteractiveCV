# Mouth poses · visual draft v1

Built-in image generation created `mouth-atlas.png` (1916 × 821 RGBA), a 4 × 3 sheet based on the user's supplied chart and the separate audio-tour anchor. Additional `mouth-fv.png` and `mouth-th.png` full-frame variants refine the teeth/lip and tongue poses. The original images are preserved unchanged; masking and registration happen in the web renderer.

`mouth-map.json` contains twelve named poses in chart order, measured source rectangles, the fixed target mouth rectangle, and cycle timing. F/V and T/H use their refined images rather than the less distinct atlas cells. Rest uses the original anchor mouth. Generation prompts are saved in `generation-prompts.json`.

The character workshop lets you select each pose using a native dropdown or labeled thumbnail button, inspect the mouth close up, and run a visual cycle alongside hair and blinking. Pausing stops cycling and returns to the original resting mouth. Selecting a pose stops playback for inspection. Reduced-motion preferences and hidden tabs pause animation.

The locked-area check tests every pose, half-blends, transitions and combined eye/hair/mouth frames. Mouth-only test frames must leave all non-mouth regions unchanged, including the eyes and hair. This is a set of draft visual visemes, not speech recognition, letter-based lip sync, a pronunciation lesson, or a claim of phonetic accuracy. Recorded audio will need timed pose cues before the audio tour can speak in sync. F/V, tongue shapes and lip proportions remain available for visual refinement.

The main CV portrait, body, hands and feet are not replaced or animated. No Git commit, push or site deployment is part of this update.
