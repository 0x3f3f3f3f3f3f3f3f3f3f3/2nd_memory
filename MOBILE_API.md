# Mobile API

Base path:

- `/api/mobile/v1`

Response envelope:

```json
{ "data": ... }
```

Error envelope:

```json
{ "error": { "code": "string", "message": "string" } }
```

Headers:

- `Authorization: Bearer <token>` for authenticated endpoints
- `x-locale: zh-Hans | en`
- `x-timezone: IANA timezone`, e.g. `America/Los_Angeles`

## Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /me`

Auth notes:

- browser cookie auth remains unchanged for web
- mobile auth uses opaque bearer tokens
- server stores only token hashes in `MobileSession`
- current token can be revoked by `/auth/logout`

## Bootstrap

- `GET /bootstrap`

Returns:

- user
- resolved settings
- lightweight summary counts

## Inbox

- `GET /inbox`
- `POST /inbox`
- `POST /inbox/:id/process`
- `DELETE /inbox/:id`

## Tasks

- `GET /tasks`
- `POST /tasks`
- `GET /tasks/:id`
- `PATCH /tasks/:id`
- `DELETE /tasks/:id`
- `POST /tasks/:id/cycle-status`
- `POST /tasks/:id/subtasks`
- `PATCH /subtasks/:id`
- `DELETE /subtasks/:id`

List filters:

- `status=ALL|TODO|DOING|DONE`
- `due=ALL|TODAY|TOMORROW|THIS_WEEK|THIS_MONTH`
- `q=<query>`

## Timeline / Time Blocks

- `GET /timeline?start=<iso>&end=<iso>`
- `POST /tasks/:id/time-blocks`
- `PATCH /time-blocks/:id`
- `DELETE /time-blocks/:id`

## Notes

- `GET /notes`
- `POST /notes`
- `GET /notes/:id`
- `PATCH /notes/:id`
- `DELETE /notes/:id`

List filters:

- `q=<query>`
- `type=<NOTE_TYPE>`
- `tag=<tag id or slug>`

## Tags

- `GET /tags`
- `POST /tags`
- `PATCH /tags/:tagRef`
- `DELETE /tags/:tagRef`
- `GET /tags/:tagRef/detail`

`tagRef` accepts either tag id or slug.

## Search

- `GET /search?q=<query>`

Returns grouped:

- tasks
- notes
- tags

## Settings

- `GET /settings`
- `PATCH /settings`

Fields:

- `language`
- `theme`
- `timezoneMode`
- `timezoneOverride`

## AI

- `POST /ai/chat`

Behavior:

- streaming `text/plain`
- native client appends chunks incrementally
- reuses the same shared AI service used by web `/api/ai`

## DTOs

Implemented DTO serializers:

- `UserDTO`
- `UserSettingsDTO`
- `TaskDTO`
- `SubTaskDTO`
- `TimeBlockDTO`
- `NoteDTO`
- `TagDTO`
- `InboxItemDTO`
- grouped search DTOs

Dates:

- API always returns ISO 8601 strings
- storage remains UTC
- client display is timezone-aware
