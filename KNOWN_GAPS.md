# Known Gaps

This file tracks intentional phase-1/phase-2 gaps instead of pretending they are finished.

## iOS

- The iOS project was authored in-repo on Linux, so `xcodebuild` verification could not be executed in this environment.
- The UI relies on native SwiftUI + Material surfaces and standard system bars; it does not use speculative iOS-26-only APIs whose exact signatures were not verifiable here.
- Timeline drag-to-reschedule is not implemented. Time blocks are created/edited through stable native forms.
- Some editor/detail flows are shared through sheets for delivery speed; deeper split-view refinement is phase 2.
- Search/tag detail sheets currently reuse editor/detail views rather than bespoke navigation destinations.

## Web

- Existing web timeline/task UI still contains some legacy `toChina` / `chinaNow` compatibility helpers in front-end components.
- The mobile API is timezone-correct, but the web front-end has not been fully refactored away from those legacy helpers yet.

## Backend

- There is no formal pagination yet on mobile list endpoints.
- AI chat remains stateless request/response streaming, not a persisted conversation/session model.
- Mobile API smoke coverage is still light relative to the full endpoint surface.

## Product

- README-advertised `/today` and `/review` remain removed/ghost features; they were audited and documented, not reintroduced.
- Native reminder scheduling is local-only. There is no cross-device server-side notification fanout yet.

## Assets

- App icon uses generated PNGs derived from existing web icon assets. A richer layered Liquid Glass icon can be added later with Icon Composer.
