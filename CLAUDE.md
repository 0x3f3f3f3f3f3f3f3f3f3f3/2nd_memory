# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What This Is

**Sage** — a personal second-brain product with two components in one repo:

1. **Next.js 16 BFF** (`src/`) — App Router, Prisma 7, PostgreSQL, `iron-session` cookie auth for web, and a versioned mobile API at `/api/mobile/v1`.
2. **Native iOS app** (`ios/SageApp`) — SwiftUI, Swift 6, `@Observable`, bearer-token auth backed by server-side hashed `MobileSession` records.

## Commands

```bash
# Install & setup
npm install
cp .env.example .env
npx prisma generate
npm run db:push
npm run db:seed

# Development (always use port 3003 — 3000 may be occupied)
npm run dev:3003

# Type-check (no test runner — this is the test command)
npx prisma generate && npx tsc --noEmit --incremental false

# Lint
npm run lint

# DB helpers
npm run db:migrate    # create migration
npm run db:studio     # Prisma Studio UI
```

Seed account: `admin` / `memory2024` (or `OWNER_PASSWORD` env var).

## Architecture

### Backend service layer (`src/server/`)

All domain logic lives in `src/server/services/` — **not** in route handlers or server actions:

| File | Responsibility |
|---|---|
| `tasks-service.ts` | CRUD, status cycle, subtasks, time blocks |
| `notes-service.ts` | CRUD, tag linking |
| `inbox-service.ts` | Capture + process to task/note |
| `tags-service.ts` | CRUD, detail aggregation |
| `search-service.ts` | Grouped cross-entity search |
| `settings-service.ts` | Per-user key/value settings |
| `bootstrap-service.ts` | `/me` + settings + counts in one call |
| `ai-chat-service.ts` | Shared OpenAI streaming used by both web and mobile |

Supporting modules:

- `src/server/mobile/auth.ts` — bearer token issue/verify/revoke against `MobileSession`
- `src/server/mobile/dtos.ts` — serializers; never return raw Prisma objects from mobile routes
- `src/server/mobile/http.ts` — `ok()` / `err()` response helpers
- `src/server/mobile/validators.ts` — Zod schemas for mobile request bodies
- `src/server/errors.ts` — typed error constructors (`badRequest`, `notFound`, `unauthorized`, `conflict`)
- `src/server/time.ts` — timezone utilities; `normalizeTimeZone`, `zonedFilterRange`
- `src/server/preferences.ts` — resolve effective user locale/timezone from stored settings + request headers

### Web auth vs. mobile auth

- **Web**: `iron-session` cookie `mg_session`, enforced by `src/proxy.ts` middleware
- **Mobile**: opaque bearer token → SHA-256 hash stored in `MobileSession.tokenHash`; `requireMobileSession()` in `src/server/mobile/auth.ts` validates every mobile route

### Mobile API (`src/app/api/mobile/v1/`)

Every route handler must:
1. Call `requireMobileSession(request)` for auth
2. Call `buildAuthenticatedMobileContext()` to get resolved locale/timezone
3. Delegate business logic to a service function
4. Return `ok(dto)` or let errors propagate to the global handler in `src/server/mobile/http.ts`

Mobile requests send `x-locale` and `x-timezone` headers. Services that are timezone-sensitive must accept and use these values, never hardcode `Asia/Shanghai` or call `toChina()` / `chinaNow()`.

### Web server actions (`src/lib/actions/`)

Legacy mutation surface for the web UI only. Mobile clients must not consume server actions — use the `/api/mobile/v1` routes instead.

### Timezone debt

The web frontend still calls `toChina()` / `chinaNow()` helpers in timeline/DDL components. These are known legacy issues (see `KNOWN_GAPS.md`). **Do not introduce new uses.** Mobile API layer is already timezone-correct.

## Key Docs

- [`MOBILE_API.md`](./MOBILE_API.md) — full mobile endpoint reference and response envelope
- [`IOS_ARCHITECTURE.md`](./IOS_ARCHITECTURE.md) — iOS app structure, `AppEnvironment`, `APIClient`, feature pattern
- [`MIGRATION_AUDIT.md`](./MIGRATION_AUDIT.md) — audit of what exists vs. what docs claim; ghost features
- [`KNOWN_GAPS.md`](./KNOWN_GAPS.md) — intentional phase gaps

## Ghost Features

These routes **do not exist** despite appearing in older docs: `/today`, `/review`. Do not create them. The `revalidatePath("/today")` calls in server actions are dead code.
