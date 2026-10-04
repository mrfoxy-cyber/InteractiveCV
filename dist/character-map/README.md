# Character coordinate map

This is a developer preview, separate from the interactive CV. It does not change or animate the main page.

Open `/character-map/` through the existing local server to inspect the original portrait, select layers, and adjust pivot points. Click **Download coordinate map** to save a revised JSON file; changes are not silently written to disk.

## Coordinate contract

The original portrait is **1261 × 1247 pixels**. All coordinates are measured from its top-left corner: X increases rightward, Y downward. These coordinates are independent of browser size. The preview scales the portrait and the overlay together.

Each layer defines an ID, parent, paint order, pivot, rough selection polygon, and planned motion. Parent transforms will be inherited; for example, moving the head should carry the eyes, mouth, and hair with it. Image-left and image-right refer to the viewer's left and right, not anatomical sides.

The current polygons are **draft location guides**, not clean segmentation masks or finished movement sprites. The `sprites` arrays are intentionally empty.

## Preparing sprites

For the simplest reliable alignment, export every transparent layer and each of its movement frames on a **1261 × 1247 canvas**, with the part at its original coordinates. Do not crop or re-centre individual frames.

If a sprite needs a smaller canvas, save its fixed `[x, y]` offset into the original coordinate system. Every frame must use the same crop bounds. Convert a global pivot to local sprite coordinates by subtracting that offset.

To actually move a cutout, its pixels must also be removed from the underlying base, and any surface hidden behind it must be reconstructed. Simply moving a copy over the unchanged portrait would produce a double image. The original portrait remains the fallback until the separate layers are ready.

First sprite set: open / half-closed / closed eyelids and loose hair strands. Keep head, body, hands, mouth, legs, and feet still initially. Any eventual animation must allow pausing, respect reduced-motion settings, and remain decorative to screen readers.
