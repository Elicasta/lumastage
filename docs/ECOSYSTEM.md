# LumaStage ecosystem

LumaStudio owns transport, song, section, tempo and beat. LumaStage owns visual scenes, media, Preview/Program and screen outputs. LumaViz owns venue visualization and consumes Stage output metadata/previews without taking playback ownership. LumaRig remains lighting control.

## Pages
1. LIVE: Preview/Program, scenes, transitions and safe blackout.
2. CREATE: layer composer for text, media, generators, effects and audio reaction.
3. SHOW: Studio song/section following with manual override and deterministic Resume Auto.
4. SCREENS: output routing and LumaViz relay mapping.

Media is a shared library drawer, not a fifth operating mode.

## Contracts
The first protocol is in src/integrations/showBus.ts. It accepts the media frame already used by LumaViz and normalizes it to luma.show@1. Stage publishes lumastage.program@1 and lumastage.viz@1 envelopes. Unknown versions are ignored.

## Failure rules
- Studio disconnect freezes the current visual state. Never blackout.
- Viz disconnect never changes Program.
- Manual Stage override stops auto scene changes until Resume Auto.
- Stage blackout affects pixels only. Never stop Studio or Rig.
- Preview and Program are separate state machines.

## Native transport path
Desktop builds add local peer discovery/WebSocket plus direct display windows, Syphon on macOS, Spout on Windows and NDI when installed. LumaViz maps Stage output IDs onto its existing DisplaySurface.sourceOutputId.
