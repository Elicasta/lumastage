# LumaStage

LumaStage is the Luma ecosystem live visual engine: a focused operator app for stage visuals, scene creation, song-aware playback and screen routing.

## Current operator surface

- **LIVE**: Preview/Program workflow, scene bank, TAKE, master controls and local blackout.
- **CREATE**: layer-based visual composer with text, generator, particles and video layer concepts.
- **SHOW**: LumaStudio-aware song map and section cues.
- **SCREENS**: output selection, fit/brightness/rotation controls and LumaViz relay status.
- **MEDIA**: shared library drawer available from every operating page.

## Ecosystem

See [docs/ECOSYSTEM.md](docs/ECOSYSTEM.md). Protocol types and the existing LumaStudio media compatibility adapter live in `src/integrations/showBus.ts`.

## Run

```bash
npm install
npm run dev
```

## Verify

```bash
npm run typecheck
npm test
npm run build
```

## Next engineering pass

Move the UI demo state into a runtime store, add the local desktop transport, wire LumaStudio show frames into SHOW auto-follow, then publish Stage output surfaces to LumaViz. Native output adapters follow after the state path is proven.
