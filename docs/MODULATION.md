# Modulation architecture

Visual reactivity is routed through a normalized modulation engine instead of being embedded inside generators or effects. Sources currently model low/mid/high audio energy, overall level, beat, bar, section progress and LFO. Targets are string-addressed engine parameters so the same signal can animate generator energy, effect amount, transform scale, particle rate or typography.

This keeps LumaStudio timing and future live audio analysis interchangeable at the scene level. A scene can react to beat even when no microphone/audio capture is configured, and audio-reactive scenes remain usable when Studio is absent.
