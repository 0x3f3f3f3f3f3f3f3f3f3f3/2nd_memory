# iOS Frontend Handoff Prompt

你现在负责修复 iOS 客户端与后端的联调问题。后端已经确认可用，请不要再怀疑服务端是否存活；先从客户端 URL 构造、请求调度、headers、decode、streaming 和错误处理入手排查并修复。

## Backend Ground Truth

- Base URL 必须是：`http://154.83.158.137:3003`
- 这是 HTTP，不是 HTTPS
- iOS 工程必须允许 ATS 明文访问这个地址
- 服务端已确认可用，公网实测：
  - `POST /api/mobile/v1/auth/login` -> `200`
  - `GET /api/mobile/v1/me` -> `200`
  - `GET /api/mobile/v1/bootstrap` -> `200`
- 登录账号：
  - username: `admin`
  - password: `429841lzy`

## Required Investigation and Fixes

### 1. Base URL must not contain spaces

错误文案里出现了：

- `http:// 154.83.158.137:3003/...`

这说明客户端很可能把 URL 拼成了带空格的字符串。请排查并修复：

- `serverBaseURL` 的默认值
- `TextField` 保存 backend URL 时是否带空格
- `trimmingCharacters(in: .whitespacesAndNewlines)` 是否在真正构造 URL 前执行
- 是否有 `"http:// \(host)"` 这种带空格的插值
- 是否把 `URL(string:)` 失败后又 fallback 成错误字符串

### 2. All requests must hit mobile API endpoints directly

正确路径：

- `POST /api/mobile/v1/auth/login`
- `POST /api/mobile/v1/auth/register`
- `POST /api/mobile/v1/auth/logout`
- `GET /api/mobile/v1/me`
- `GET /api/mobile/v1/bootstrap`
- `GET /api/mobile/v1/inbox`
- `POST /api/mobile/v1/inbox`
- `POST /api/mobile/v1/inbox/:id/process`
- `DELETE /api/mobile/v1/inbox/:id`
- `GET /api/mobile/v1/tasks`
- `POST /api/mobile/v1/tasks`
- `GET /api/mobile/v1/tasks/:id`
- `PATCH /api/mobile/v1/tasks/:id`
- `DELETE /api/mobile/v1/tasks/:id`
- `POST /api/mobile/v1/tasks/:id/cycle-status`
- `POST /api/mobile/v1/tasks/:id/subtasks`
- `PATCH /api/mobile/v1/subtasks/:id`
- `DELETE /api/mobile/v1/subtasks/:id`
- `GET /api/mobile/v1/timeline?start=...&end=...`
- `POST /api/mobile/v1/tasks/:id/time-blocks`
- `PATCH /api/mobile/v1/time-blocks/:id`
- `DELETE /api/mobile/v1/time-blocks/:id`
- `GET /api/mobile/v1/notes`
- `POST /api/mobile/v1/notes`
- `GET /api/mobile/v1/notes/:id`
- `PATCH /api/mobile/v1/notes/:id`
- `DELETE /api/mobile/v1/notes/:id`
- `GET /api/mobile/v1/tags`
- `POST /api/mobile/v1/tags`
- `PATCH /api/mobile/v1/tags/:tagRef`
- `DELETE /api/mobile/v1/tags/:tagRef`
- `GET /api/mobile/v1/tags/:tagRef/detail`
- `GET /api/mobile/v1/search?q=...`
- `GET /api/mobile/v1/settings`
- `PATCH /api/mobile/v1/settings`
- `POST /api/mobile/v1/ai/chat`

不要走 web 页面逻辑，不要依赖 cookie，不要打 `/login` 页面。

### 3. Authentication model

- 登录/注册成功响应：
  - `{ data: { token, user, settings, session } }`
- token 必须存到 Keychain
- 后续所有受保护请求都带：
  - `Authorization: Bearer <token>`
- 不能用 cookie
- 冷启动时先读 Keychain，再打：
  - `GET /api/mobile/v1/me`
  - `GET /api/mobile/v1/bootstrap`

### 4. Request headers

推荐所有请求附带：

- `Content-Type: application/json`
- `Accept: application/json`
- `x-locale: en` 或 `zh-Hans`
- `x-timezone: America/Los_Angeles` 之类的 IANA timezone

登录接口不要求 bearer，其他受保护接口必须带 bearer。

### 5. Response decoding

成功统一是：

```json
{ "data": ... }
```

失败统一是：

```json
{ "error": { "code": "...", "message": "..." } }
```

不要直接把顶层 JSON 当业务对象解码，必须先解 `APIEnvelope<T>`。

### 6. Required debug logging

在 debug 构建里，请输出：

- 最终 request URL
- HTTP method
- 所有 headers
  - bearer 只打印“是否存在”，不要打印 token 原文
- status code
- response body 前 300 字符

这样能立刻看出是 URL 拼坏、ATS、401、HTML、还是 decode 失败。

### 7. Correct login request example

请求：

```json
{
  "username": "admin",
  "password": "429841lzy",
  "deviceName": "iPhone",
  "deviceId": "optional-vendor-id"
}
```

成功响应形态：

```json
{
  "data": {
    "token": "opaque-token",
    "user": {
      "id": "owner",
      "username": "admin",
      "createdAt": "..."
    },
    "settings": {
      "language": "zh-Hans",
      "theme": "system",
      "timezoneMode": "system",
      "timezoneOverride": null,
      "effectiveTimezone": "America/Los_Angeles"
    },
    "session": {
      "id": "...",
      "deviceName": "...",
      "expiresAt": "..."
    }
  }
}
```

### 8. AI endpoint

- `POST /api/mobile/v1/ai/chat`

Request body:

```json
{
  "messages": [
    { "role": "user", "content": "..." }
  ],
  "locale": "en",
  "timezone": "America/Los_Angeles"
}
```

Response behavior:

- 不是 JSON
- 是 streaming `text/plain`
- 客户端需要逐块追加 assistant 文本
- 不要把这个接口按 envelope 解码

### 9. ATS

iOS 工程必须允许 HTTP 到 `154.83.158.137:3003`。如果本地改动覆盖了 Info.plist 生成配置，要修回来。

### 10. First success path to restore

请先只修并验证这条链路：

- app launch
- login
- me
- bootstrap
- inbox list

这条链路稳定后，再继续修其他 feature。

### 11. Required report back

修完后请明确输出：

- 实际使用的 base URL
- 登录请求完整 URL
- 登录是否拿到 token
- me/bootstrap 是否成功
- 是否还存在 URL 中空格或 malformed URL 问题
- 你修改了哪些 Swift 文件
