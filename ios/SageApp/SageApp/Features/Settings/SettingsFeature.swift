import SwiftUI

struct SettingsView: View {
    @Environment(AppEnvironment.self) private var environment
    @State private var backendURL = ""

    private let commonTimezones = [
        "UTC",
        "America/Los_Angeles",
        "America/Denver",
        "America/Chicago",
        "America/New_York",
        "Europe/London",
        "Europe/Paris",
        "Asia/Shanghai",
        "Asia/Tokyo",
        "Australia/Sydney"
    ]

    var body: some View {
        List {
            Section {
                SettingsRow(title: "settings.theme", subtitle: nil) {
                    Picker("", selection: Binding(get: { environment.settings.theme }, set: { updateTheme($0) })) {
                        ForEach(AppTheme.allCases) { theme in
                            Text(theme.rawValue).tag(theme)
                        }
                    }
                    .pickerStyle(.segmented)
                    .frame(width: 220)
                }

                SettingsRow(title: "settings.language", subtitle: nil) {
                    Picker("", selection: Binding(get: { environment.settings.language }, set: { updateLanguage($0) })) {
                        ForEach(AppLanguage.allCases) { language in
                            Text(language.rawValue).tag(language)
                        }
                    }
                    .pickerStyle(.segmented)
                    .frame(width: 220)
                }

                SettingsRow(title: "settings.timezone", subtitle: environment.settings.effectiveTimeZoneIdentifier) {
                    VStack(alignment: .trailing) {
                        Picker("", selection: Binding(get: { environment.settings.timezoneMode }, set: { updateTimezoneMode($0) })) {
                            ForEach(TimezoneMode.allCases) { mode in
                                Text(mode.rawValue).tag(mode)
                            }
                        }
                        .pickerStyle(.segmented)
                        .frame(width: 220)

                        if environment.settings.timezoneMode == .manual {
                            Picker("", selection: Binding(get: { environment.settings.timezoneOverride ?? "UTC" }, set: { updateTimezoneOverride($0) })) {
                                ForEach(commonTimezones, id: \.self) { timezone in
                                    Text(timezone).tag(timezone)
                                }
                            }
                            .labelsHidden()
                        }
                    }
                }
            }

            Section {
                SettingsRow(title: "settings.backendURL", subtitle: String(localized: "settings.backendURL.help")) {
                    TextField("http://localhost:3000", text: $backendURL)
                        .multilineTextAlignment(.trailing)
                        .onSubmit {
                            environment.settings.setServerBaseURL(backendURL)
                        }
                }
            }

            Section {
                Button(role: .destructive) {
                    Task { @MainActor in
                        await environment.authStore.logout()
                    }
                } label: {
                    Label("settings.logout", systemImage: "rectangle.portrait.and.arrow.right")
                }
            }
        }
        .navigationTitle(String(localized: "settings.title"))
        .task {
            backendURL = environment.settings.serverBaseURL
        }
    }

    private func updateTheme(_ theme: AppTheme) {
        environment.settings.setTheme(theme)
        Task { @MainActor in
            _ = try? await environment.apiClient.send(
                path: "/api/mobile/v1/settings",
                method: "PATCH",
                body: SettingsPatchRequest(
                    language: nil,
                    theme: theme,
                    timezoneMode: nil,
                    timezoneOverride: nil
                )
            ) as UserSettingsDTO
        }
    }

    private func updateLanguage(_ language: AppLanguage) {
        environment.settings.setLanguage(language)
        Task { @MainActor in
            _ = try? await environment.apiClient.send(
                path: "/api/mobile/v1/settings",
                method: "PATCH",
                body: SettingsPatchRequest(
                    language: language,
                    theme: nil,
                    timezoneMode: nil,
                    timezoneOverride: nil
                )
            ) as UserSettingsDTO
        }
    }

    private func updateTimezoneMode(_ mode: TimezoneMode) {
        environment.settings.setTimezoneMode(mode)
        Task { @MainActor in
            _ = try? await environment.apiClient.send(
                path: "/api/mobile/v1/settings",
                method: "PATCH",
                body: SettingsPatchRequest(
                    language: nil,
                    theme: nil,
                    timezoneMode: mode,
                    timezoneOverride: environment.settings.timezoneOverride
                )
            ) as UserSettingsDTO
        }
    }

    private func updateTimezoneOverride(_ timezone: String) {
        environment.settings.setTimezoneOverride(timezone)
        Task { @MainActor in
            _ = try? await environment.apiClient.send(
                path: "/api/mobile/v1/settings",
                method: "PATCH",
                body: SettingsPatchRequest(
                    language: nil,
                    theme: nil,
                    timezoneMode: .manual,
                    timezoneOverride: timezone
                )
            ) as UserSettingsDTO
        }
    }
}

private struct SettingsPatchRequest: Encodable {
    let language: AppLanguage?
    let theme: AppTheme?
    let timezoneMode: TimezoneMode?
    let timezoneOverride: String?
}
