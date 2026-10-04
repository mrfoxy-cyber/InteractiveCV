# Unity frog logic in the browser

The browser game ports the single-player grid behaviour from `Assets/Scripts/Grid/GridManager.cs`, `GridSlot.cs` and `GridSlotPreviewManager.cs`.

- `frog-logic.js` implements cardinal-neighbour placement, connected group traversal, one-cell gravity and per-frog points multiplied by the chain counter.
- Unity's recursion counts the other frogs in the group, then checks `> 2`: a combo therefore requires at least four frogs.
- The duplicated down/left branch in the original placement function is corrected so it selects DL rather than UD.
- `unity-assets.js` records sprite references from GridSlot.prefab, inherited frog colours/points, and Animator state references from FrogController.controller. Direction is determined by these references, not animation folder names.
- Every animation keyframe keeps its original time. Connection clips play once, then show their corresponding static tile. Repainting the board does not restart a connection unless its placement changes.
- The original explosion clip runs before matched frogs are removed. A preview queue follows the original Pop behaviour.
- The browser draws original unmodified sprites and multiplies their pixels by the frog colour, preserving the black outlines and white body like Unity's sprite renderer.

The cloud drop, pastel styling and lemon frog are the requested browser changes. The web version retains its simplified level progression; Unity multiplayer, timed levels and network messaging are not ported.

Run `node web/tools/read-unity-assets.cjs` from the Unity project directory to read updated asset data (JSON on standard output) and copy the referenced original PNGs. Save that data as the `UNITY_ASSETS` declaration when refreshing the manifest.

Run `node web/tools/verify-unity-port.cjs` to check all 16 neighbour arrangements, combo thresholds, scoring, gravity, animation timing and asset paths.
