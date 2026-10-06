# Anchored audio-tour character · v2

This separate prototype does not replace the main CV portrait or integrate the audio tour.

The built-in image generation tool produced four transparent, same-size 1261 × 1247 PNGs: `anchor.png`, `blink.png`, `hair.png`, and `mouth.png`. The anchor is a newly coherent resting pose rather than the original portrait pose. Exact generation prompts are in `generation-prompts.json`.

Generated variants can drift outside the requested edit. Therefore they are never shown wholesale in the animation. `regions.json` defines bounded masks, a feather at the edges, and a longer fade at hair roots. The renderer draws the immutable anchor, then blends variant pixels ONLY through these masks. No head, body, hands, feet, or whole-image transform is applied. Hair roots above each mask remain fixed.

`anchored.html` is a separate workshop. Play starts subtle hair crossfading and an occasional blink; Pause returns to the resting anchor. Mouth motion is an optional visual speaking test, not audio synchronization. Still-frame checkboxes allow inspecting closed eyes and an open mouth. Reduced-motion and background-tab changes pause animation. All controls are keyboard accessible, and the canvas has a textual description. Hands and feet have no animation layers.

The page's locked-area check compares a resting render against closed-eye, hair, mouth, combined and half-blended frames pixel by pixel. Every pixel outside the nonzero mask union must match. The test also requires that each effect changes some pixels inside its region.

This is bounded frame blending, not skeletal deformation or speech lip synchronization. Masks are specific to this new anchor and must not be reused on the original portrait. Additional speech mouth shapes need matching source frames. Hands and feet are intentionally excluded. Keep previous layer assets as drafts, do not overwrite them.

The renderer clones canonical anchor pixel bytes for every frame, then blends source pixels only within bounded masks. Animation is capped at 30 frames per second. The locked-area test compares the rendered canvas readback, not just the region metadata.
