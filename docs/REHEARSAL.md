# Rehearsal workflow

Rehearsal is deterministic show authoring. It does not silently learn or infer operator preferences.

1. Connect LumaStudio and open the intended set/show.
2. Arm RECORD CUES in LumaStage.
3. Run the song. Fire a Scene, energy Variant and Transition when the arrangement reaches a section.
4. LumaStage records the decision against stable song and section identifiers.
5. Re-firing a section during the same rehearsal replaces that section's earlier take when the rehearsal is compiled.
6. Save the compiled Song Show.
7. During performance, AUTO replays authored section cues. Manual Override always wins until Resume Auto.

Authored cues have priority over inferred energy. Energy direction is only a default when a section has no explicit cue. Transition Memory is explicit per scene pair and can be changed without rewriting the scene itself.
