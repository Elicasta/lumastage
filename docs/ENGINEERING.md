# Professional-grade direction

LumaStage should stay simpler to operate than a traditional media server while borrowing the engineering properties that make those systems safe on a live show.

## Current sequence

1. Shared show protocol and compatibility adapter.
2. Central Stage runtime with deterministic manual override.
3. Hybrid local transport with reconnect and capability hello.
4. Tauri desktop shell.
5. RenderGraph, MediaPool and OutputRouter boundaries.
6. Engine telemetry and crash-recovery snapshot primitives.

## Next upgrades

### GPU compositor
Move RenderGraph execution into a GPU-backed compositor. Preview, Program and every output must reference the same evaluated scene graph. Never run independent animation clocks per output.

### Media clock
Use the LumaStudio transport timestamp as an optional external clock. Stage owns visual animation time by default, but song-bound media can phase-lock to Studio without seeking on every frame.

### Preflight
Before GO LIVE, validate missing media, unsupported codecs, unavailable outputs, mismatched resolutions, disconnected peers and scenes that exceed a configurable memory budget.

### Output safety
Outputs retain last-good frame on recoverable renderer faults. Black is an explicit operator state, never an automatic error fallback.

### Recovery
Persist show-safe state locally. On relaunch offer Restore Show rather than silently firing previous outputs.

### Diagnostics
Expose frame time, dropped frames, decoder queue depth, output latency, peer latency and media cache pressure in a diagnostics drawer. Keep it out of the normal volunteer workflow.
