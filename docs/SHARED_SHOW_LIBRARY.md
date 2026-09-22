# Shared Show Library

LumaStage matches the existing LumaViz/LumaRig shared-show-v1 direction instead of replacing each app's native show schema.

## Identity

A shared show owns stable id, name, revision, timestamps, optional locationId, notes and ordered setlist metadata. Location IDs intentionally match the IDs already shared by Rig and Viz, including cornerstone-main-sanctuary and rosen-signature-2-ad26.

## Namespaced documents

Each application keeps authority over its own document:

- lumarig: existing lighting ShowFile schema, currently version 3.
- lumaviz: venue/location and visualization state.
- lumastage: visual scenes, song/section cues, media dependencies and output profile references.
- lumastudio: arrangement/transport/setlist document when wired.

The shared manifest stores schema/version/revision metadata for each app. This prevents a Stage schema change from invalidating a Rig show.

## Conflict rule

Updates are revisioned. Higher shared-show revision wins for manifest state. App documents have their own revisions. Equal manifest revisions merge non-overlapping namespaced documents. Conflicting writes to the same app document must surface shared-show.conflict rather than silently choosing one.

## Packages

Portable luma-show-package v1 wraps a shared-show snapshot plus an asset manifest. Assets may be embedded or referenced. Package validation and preflight must occur before a package can replace an active show.
