# Sage

Native iOS client + Next.js backend/BFF for a personal second-brain product.

Historical naming:

- runtime/product name: `Sage`
- `Memory Garden / 记忆花园` is retained only as legacy copy

## What Is In This Repo

- Web backend/BFF:
  - Next.js 16 App Router
  - Prisma 7
  - PostgreSQL
  - cookie session auth for web
  - versioned mobile API under `/api/mobile/v1`
- Native iOS app:
  - path: `ios/SageApp`
  - SwiftUI
  - Swift 6
  - Keychain-backed bearer auth

## Docs

- [`MIGRATION_AUDIT.md`](./MIGRATION_AUDIT.md)
- [`IOS_ARCHITECTURE.md`](./IOS_ARCHITECTURE.md)
- [`MOBILE_API.md`](./MOBILE_API.md)
- [`KNOWN_GAPS.md`](./KNOWN_GAPS.md)

## Web Routes That Actually Exist

- `/inbox`
- `/tasks`
  - redirects to `/ddl`
- `/ddl`
- `/timeline`
- `/notes`
- `/notes/new`
- `/notes/:id`
- `/notes/:id/edit`
- `/tags`
- `/tags/:slug`
- `/search`
- `/settings`
- `/ai`

Ghost routes from older docs that do not exist:

- `/today`
- `/review`

## Quick Start

```bash
npm install
cp .env.example .env
npx prisma generate
npm run db:push
npm run db:seed
npm run dev:3003
```

Backend default URL:

- `http://localhost:3003`

Do not use port `3000` here if you already have another service bound to it.

## Environment

Required variables:

- `DATABASE_URL`
- `OWNER_PASSWORD`
- `SESSION_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `OPENAI_API_KEY`

Optional:

- `OPENAI_BASE_URL`
- `MOBILE_SESSION_TTL_DAYS`

## Web Auth

- cookie session name: `mg_session`
- browser auth remains compatible with the existing web app

## Mobile Auth

- opaque bearer token
- stored in iOS Keychain
- hashed on server in `MobileSession`
- current token revocation supported

## Mobile API

Versioned namespace:

- `/api/mobile/v1`

Implemented areas:

- auth
- me/bootstrap
- inbox
- tasks/subtasks
- timeline/time-blocks
- notes
- tags
- search
- settings
- AI streaming

## Running The iOS App

1. Start the backend on `3003`:

```bash
npm run dev:3003
```

2. Open:

```text
ios/SageApp/SageApp.xcodeproj
```

3. Run the `SageApp` scheme on an iOS 26 simulator/device.

Default backend base URL inside the app:

- `http://localhost:3003`

For a physical device, change the backend URL in Settings to a reachable LAN address.

## Tests

Backend / TypeScript:

```bash
npx prisma generate
npx tsc --noEmit --incremental false
```

iOS:

- `SageAppTests` target is included in the Xcode project

## Seed Account

After `npm run db:seed`:

- username: `admin`
- password: value of `OWNER_PASSWORD`
  - defaults to `memory2024` if you did not override it
