# Migration Audit

Date: 2026-03-25

## Executive Summary

This repository is a Next.js 16 App Router web application with Prisma + PostgreSQL, cookie-based `iron-session` auth, server actions for most mutations, and a single streaming AI route. It is not currently structured to serve a native mobile client safely.

The migration target in this repo is:

- Keep Next.js + Prisma + PostgreSQL as backend/BFF.
- Preserve current web behavior.
- Add a versioned mobile API for a native SwiftUI iOS app.
- Keep browser cookie auth for web, but add bearer-token mobile auth backed by server-side hashed session storage.
- Converge product naming on `Sage` for the app target, navigation, and bundle display name.

## Actual Route Tree

Observed from `src/app`:

- `/`
  - redirects to `/inbox`
- `/login`
- `/register`
- `/inbox`
- `/tasks`
  - redirects to `/ddl`
- `/ddl`
  - actual task workbench
- `/timeline`
- `/notes`
- `/notes/new`
- `/notes/[id]`
- `/notes/[id]/edit`
- `/tags`
- `/tags/[slug]`
- `/search`
- `/settings`
- `/ai`
- `/api/auth/logout`
- `/api/ai`

Missing routes claimed by README:

- `/today`
- `/review`

## Actual Feature Tree

Implemented in code today:

- Auth
  - username/password login
  - username/password register
  - cookie session via `iron-session`
- Inbox
  - list unprocessed items
  - create capture
  - convert inbox item to task / note / both
  - delete inbox item
- Tasks
  - CRUD via server actions
  - `/tasks` is only an alias redirect to `/ddl`
  - list/week/month UI exists inside `DdlPageView`
  - status cycle
  - tag assignment
  - due date editing
  - schedule/time block create/update/delete
  - subtasks are displayed, but current web detail panel shows them read-only
- Timeline
  - week/month views over `TimeBlock`
  - task detail access
  - time block editing from task detail
- Notes
  - list, create, edit, delete
  - markdown display
  - markdown editing via `Vditor`
  - type / importance / tags
- Tags
  - list
  - create / edit / delete
  - detail view with tasks and notes
- Search
  - grouped search across tasks / notes / tags
- Settings
  - theme
  - timezone
  - logout
  - locale toggle is exposed in nav, not in a true backend-backed settings system
- AI
  - streaming chat UI
  - `/api/ai` supports OpenAI streaming and function/tool execution

Not truly implemented despite traces in docs or code:

- `/today` page
- `/review` page
- spaced repetition / review workflow
- note review fields in schema
- backend-backed settings sync
- mobile-safe public API
- mobile auth
- local notifications
- native iOS client

## Actual Data Model

Current Prisma schema models:

- `User`
- `Tag`
- `Task`
- `TimeBlock`
- `TaskTag`
- `SubTask`
- `Note`
- `NoteTag`
- `NoteTask`
- `NoteLink`
- `InboxItem`
- `Setting`

Current enums:

- `TaskStatus`
- `Priority`
- `NoteType`
- `Importance`
- `RelationType`
- `ProcessType`

Important observations:

- `Setting` exists but is not meaningfully used by current web app.
- `Task.reminderAt` and `Task.estimateMinutes` exist in schema and server actions.
- `NoteTask` exists in schema and note detail includes it, but current app rarely creates these links.
- `sourceNoteId` exists on `Task`, but there is no meaningful cross-feature flow built around it.
- There is no mobile session or mobile token storage model.

## Actual Authentication

Current web auth:

- Implemented in [`src/lib/auth.ts`](/root/2nd_memory_ios/src/lib/auth.ts)
- Uses `iron-session`
- Cookie name: `mg_session`
- Route protection is enforced by [`src/proxy.ts`](/root/2nd_memory_ios/src/proxy.ts)

Behavior:

- Web pages expect cookie auth.
- No bearer token flow exists.
- Mobile clients would currently have to fake a browser session, which is explicitly the wrong architecture for native iOS.

## Actual Mutation Surface

Current business mutations are mostly hidden inside server actions:

- [`src/lib/actions/inbox.ts`](/root/2nd_memory_ios/src/lib/actions/inbox.ts)
- [`src/lib/actions/tasks.ts`](/root/2nd_memory_ios/src/lib/actions/tasks.ts)
- [`src/lib/actions/notes.ts`](/root/2nd_memory_ios/src/lib/actions/notes.ts)
- [`src/lib/actions/tags.ts`](/root/2nd_memory_ios/src/lib/actions/tags.ts)
- [`src/app/(auth)/login/actions.ts`](/root/2nd_memory_ios/src/app/(auth)/login/actions.ts)
- [`src/app/(auth)/register/actions.ts`](/root/2nd_memory_ios/src/app/(auth)/register/actions.ts)

This is the main backend/BFF gap for native iOS:

- server actions are not a stable public contract
- mobile clients should not couple to server actions
- current domain logic is duplicated between server actions and `/api/ai`

## Actual Public API

Observed route handlers:

- `POST /api/auth/logout`
- `POST /api/ai`

Current `/api/ai` characteristics:

- streaming plaintext response
- cookie-authenticated only
- directly reaches Prisma
- hardcodes default timezone fallback to `Asia/Shanghai`
- duplicates task/note/tag/time-block mutation logic instead of reusing shared services

## README vs Real Code Mismatches

README currently claims:

- `/today` exists
- `/review` exists
- note detail supports spaced repetition review actions

Real code shows:

- no `/today` route
- no `/review` route
- no schema support for note review fields
- many `revalidatePath("/today")` calls survive as ghost references

README also under-describes:

- `/ddl` is the actual task workbench
- `/tasks` is only a redirect
- AI chat already exists
- current web settings are cookie-first, not database-backed

## Naming Inconsistencies

Observed names:

- `Sage`
- `Memory Garden`
- `记忆花园`
- package name `2nd_memory_claude`
- repo footer `# 2nd_memory`

Current code reality:

- UI/app metadata mostly already prefers `Sage`
- README title still leads with `记忆花园 Memory Garden`
- seed script logs `Memory Garden`

Decision for migration:

- standardize product/runtime name to `Sage`
- keep `Memory Garden / 记忆花园` only as supporting copy or historical descriptor

Reason:

- `Sage` is already the most consistent runtime-facing identity in code
- using one canonical app name is necessary for Xcode target, bundle display name, navigation titles, and API docs

## Ghost Features and Dead References

Ghost features detected:

- `/today`
- `/review`
- note spaced-repetition fields in seed data
- `revalidatePath("/today")` in multiple server actions and AI route

Concrete evidence:

- [`README.md`](/root/2nd_memory_ios/README.md) claims routes that do not exist
- [`prisma/seed.ts`](/root/2nd_memory_ios/prisma/seed.ts) writes `nextReviewAt` and `reviewIntervalDays`, but those fields are absent from current Prisma schema

This also means the seed file is stale and needs repair before trusting local demo data.

## Timezone Audit

Current timezone issues are real, not hypothetical.

Hardcoded defaults or China-specific helpers exist in:

- [`src/contexts/locale-context.tsx`](/root/2nd_memory_ios/src/contexts/locale-context.tsx)
- [`src/lib/server-locale.ts`](/root/2nd_memory_ios/src/lib/server-locale.ts)
- [`src/app/(dashboard)/layout.tsx`](/root/2nd_memory_ios/src/app/(dashboard)/layout.tsx)
- [`src/app/(auth)/layout.tsx`](/root/2nd_memory_ios/src/app/(auth)/layout.tsx)
- [`src/lib/utils.ts`](/root/2nd_memory_ios/src/lib/utils.ts)
- [`src/app/api/ai/route.ts`](/root/2nd_memory_ios/src/app/api/ai/route.ts)
- timeline / DDL UI components that call `toChina()` and `chinaNow()`

Conclusion:

- web has partial timezone support but still carries China-specific assumptions
- mobile API must not inherit this behavior
- backend responses for mobile must be ISO 8601 in UTC semantics
- client-side display logic must respect effective user timezone

## Existing AI Capability Audit

Current AI stack:

- route: `POST /api/ai`
- response: streaming text/plain
- auth: cookie only
- tools: create/update/delete task, create recurring time blocks, note and tag creation, inbox capture

Gaps for native iOS:

- no mobile auth
- no versioned mobile AI endpoint
- no shared AI service
- no session abstraction beyond in-memory chat on the web page

## Backend Capabilities Needed for Native iOS

Required additions:

- versioned mobile API namespace under `src/app/api/mobile/v1`
- mobile auth with bearer token and hashed server-side token storage
- `MobileSession` Prisma model
- shared service layer for:
  - auth
  - inbox
  - tasks
  - timeline/time blocks
  - notes
  - tags
  - search
  - settings
  - AI chat
- DTO/serializer layer so Prisma objects are not returned raw
- unified API response and error shape
- zod validation for all writes
- timezone-aware request context using headers plus stored user preferences
- backend-backed settings suitable for mobile bootstrap and sync

## Migration Risks

- iOS cannot safely consume current server actions.
- Current seed file is stale relative to schema.
- `/api/ai` currently duplicates business logic and must be deduplicated before mobile reuse.
- Web task/timeline UI still depends on China-specific helpers.
- Creating a real native SwiftUI app in-repo requires a new Xcode project and a stable mobile API contract in the same turn.

## Recommended Migration Order

Phase 0:

- write this audit
- add shared service layer
- add DTOs + mobile API helpers
- add `MobileSession`

Phase 1:

- ship mobile auth + bootstrap + core CRUD APIs
- create native iOS project and session/bootstrap flow

Phase 2:

- finish Inbox / Tasks / Notes / Search / Settings

Phase 3:

- finish Timeline / Tags / AI streaming

Phase 4:

- notifications
- draft persistence
- iPad information architecture refinements
- Liquid Glass polish
- docs/tests hardening
