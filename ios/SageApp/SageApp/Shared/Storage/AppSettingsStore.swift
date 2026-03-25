import Foundation
import Observation
import SwiftUI

@Observable
final class AppSettingsStore {
    private enum Keys {
        static let language = "sage.language"
        static let theme = "sage.theme"
        static let timezoneMode = "sage.timezoneMode"
        static let timezoneOverride = "sage.timezoneOverride"
        static let serverBaseURL = "sage.serverBaseURL"
    }

    var language: AppLanguage
    var theme: AppTheme
    var timezoneMode: TimezoneMode
    var timezoneOverride: String?
    var serverBaseURL: String

    init(defaults: UserDefaults = .standard) {
        language = AppLanguage(rawValue: defaults.string(forKey: Keys.language) ?? "") ?? .chineseSimplified
        theme = AppTheme(rawValue: defaults.string(forKey: Keys.theme) ?? "") ?? .system
        timezoneMode = TimezoneMode(rawValue: defaults.string(forKey: Keys.timezoneMode) ?? "") ?? .system
        timezoneOverride = defaults.string(forKey: Keys.timezoneOverride)
        let persistedBaseURL = defaults.string(forKey: Keys.serverBaseURL)
        if let persistedBaseURL, !persistedBaseURL.contains("localhost"), !persistedBaseURL.contains("127.0.0.1") {
            serverBaseURL = persistedBaseURL
        } else {
            serverBaseURL = "http://154.83.158.137:3003"
            defaults.set(serverBaseURL, forKey: Keys.serverBaseURL)
        }
        self.defaults = defaults
    }

    @ObservationIgnored
    private let defaults: UserDefaults

    var effectiveTimeZoneIdentifier: String {
        if timezoneMode == .manual, let timezoneOverride, !timezoneOverride.isEmpty {
            return timezoneOverride
        }
        return TimeZone.current.identifier
    }

    var colorSchemeOverride: ColorScheme? {
        switch theme {
        case .light:
            return .light
        case .dark:
            return .dark
        case .system:
            return nil
        }
    }

    var locale: Locale {
        Locale(identifier: language.rawValue)
    }

    func setLanguage(_ value: AppLanguage) {
        language = value
        defaults.set(value.rawValue, forKey: Keys.language)
    }

    func setTheme(_ value: AppTheme) {
        theme = value
        defaults.set(value.rawValue, forKey: Keys.theme)
    }

    func setTimezoneMode(_ value: TimezoneMode) {
        timezoneMode = value
        defaults.set(value.rawValue, forKey: Keys.timezoneMode)
    }

    func setTimezoneOverride(_ value: String?) {
        timezoneOverride = value
        defaults.set(value, forKey: Keys.timezoneOverride)
    }

    func setServerBaseURL(_ value: String) {
        serverBaseURL = value
        defaults.set(value, forKey: Keys.serverBaseURL)
    }

    func applyRemoteSettings(_ settings: UserSettingsDTO) {
        setLanguage(settings.language)
        setTheme(settings.theme)
        setTimezoneMode(settings.timezoneMode)
        setTimezoneOverride(settings.timezoneOverride)
    }
}
