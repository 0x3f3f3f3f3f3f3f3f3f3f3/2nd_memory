# iOS Architecture

## Target

- Path: `ios/SageApp`
- Target name: `SageApp`
- Bundle display name: `Sage`
- Minimum deployment target: iOS 26.0
- Stack:
  - Swift 6
  - SwiftUI
  - Observation (`@Observable`)
  - `URLSession` + async/await
  - Security framework Keychain
  - UserNotifications
  - `Localizable.xcstrings`

## Structure

```text
ios/SageApp
  SageApp.xcodeproj
  SageApp/
    App/
    Architecture/
    DesignSystem/
    Shared/
      API/
      Models/
      Notifications/
      Storage/
    Features/
      Auth/
      Inbox/
      Tasks/
      Timeline/
      Notes/
      Tags/
      Search/
      Settings/
      AI/
    Resources/
  SageAppTests/
```

## Runtime Model

- `AppEnvironment`
  - owns `AppSettingsStore`
  - owns `APIClient`
  - owns `AuthStore`
  - owns `KeychainStore`
  - owns `NotificationScheduler`
  - owns `DraftStore`
- `AuthStore`
  - restores bearer token from Keychain on cold launch
  - calls `/api/mobile/v1/me` and `/api/mobile/v1/bootstrap`
  - handles login/register/logout
- `APIClient`
  - injects `Authorization: Bearer`
  - injects `x-locale` and `x-timezone`
  - decodes `{ data: ... }`
  - throws structured server errors from `{ error: { code, message } }`
  - supports streaming text for AI chat
- `AppSettingsStore`
  - persists theme/language/timezone/base URL in `UserDefaults`
  - mirrors backend settings when available

## Feature Pattern

Each feature file contains:

- a lightweight `@Observable` view model
- request payload structs
- SwiftUI views/sheets/forms

This keeps the first delivery runnable without introducing a heavy abstraction stack or third-party dependencies.

## UI Principles

- standard `TabView` + `NavigationStack`
- system toolbar/search/sheet behavior preserved
- custom controls use Material-backed “glass” surfaces instead of opaque blocks
- floating composer bars use `safeAreaInset`
- markdown preview is native SwiftUI, not `WKWebView`

## App Tabs

- Inbox
- Tasks
- Timeline
- Notes
- AI

Additional surfaces:

- Search via toolbar
- Tags via toolbar menu
- Settings via toolbar menu

## Notifications

- task reminder scheduling happens when task save/cycle/delete flows return updated task data
- implementation uses `UNUserNotificationCenter`
- remote push is intentionally out of scope for this phase

## Testing

Included test target:

- `SageAppTests`

Current coverage targets:

- Keychain token round trip
- APIClient success/error envelope handling
- Inbox view model happy path load

## Why No Web Shell

- no `WKWebView`
- no React Native / Flutter / Capacitor / Tauri
- the UI is native SwiftUI and consumes a dedicated mobile API
