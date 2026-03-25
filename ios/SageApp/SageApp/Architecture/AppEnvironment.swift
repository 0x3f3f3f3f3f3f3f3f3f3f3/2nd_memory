import Foundation
import Observation
import UIKit

@Observable
final class AuthStore {
    enum Phase: Equatable {
        case launching
        case signedOut
        case signedIn
    }

    var phase: Phase = .launching
    var token: String?
    var currentUser: UserDTO?
    var session: SessionDTO?
    var bootstrap: BootstrapSummaryDTO?
    var errorMessage: String?
    var isBusy = false

    private let apiClient: APIClient
    private let keychain: KeychainStore
    private let settings: AppSettingsStore
    private let tokenKey = "mobileAuthToken"

    init(apiClient: APIClient, keychain: KeychainStore, settings: AppSettingsStore) {
        self.apiClient = apiClient
        self.keychain = keychain
        self.settings = settings
        token = keychain.read(tokenKey)
    }

    func restoreSession() async {
        guard phase == .launching else { return }
        guard let token else {
            phase = .signedOut
            return
        }

        do {
            let payload: MePayload = try await apiClient.send(path: "/api/mobile/v1/me")
            currentUser = payload.user
            session = payload.session
            settings.applyRemoteSettings(payload.settings)
            phase = .signedIn
        } catch {
            keychain.delete(tokenKey)
            self.token = nil
            phase = .signedOut
        }
    }

    func bootstrapApp() async {
        guard phase == .signedIn else { return }
        do {
            let payload: BootstrapDTO = try await apiClient.send(path: "/api/mobile/v1/bootstrap")
            currentUser = payload.user
            bootstrap = payload.summary
            settings.applyRemoteSettings(payload.settings)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func login(username: String, password: String) async {
        await authenticate(path: "/api/mobile/v1/auth/login", username: username, password: password)
    }

    func register(username: String, password: String) async {
        await authenticate(path: "/api/mobile/v1/auth/register", username: username, password: password)
    }

    private func authenticate(path: String, username: String, password: String) async {
        isBusy = true
        defer { isBusy = false }
        errorMessage = nil

        do {
            let payload: AuthPayload = try await apiClient.send(
                path: path,
                method: "POST",
                body: AuthRequest(
                    username: username,
                    password: password,
                    deviceName: UIDevice.current.model,
                    deviceId: UIDevice.current.identifierForVendor?.uuidString
                )
            )
            try keychain.write(payload.token, for: tokenKey)
            token = payload.token
            currentUser = payload.user
            session = payload.session
            settings.applyRemoteSettings(payload.settings)
            phase = .signedIn
        } catch {
            errorMessage = error.localizedDescription
            phase = .signedOut
        }
    }

    func logout() async {
        if token != nil {
            _ = try? await apiClient.send(path: "/api/mobile/v1/auth/logout", method: "POST", body: EmptyBody())
        }
        keychain.delete(tokenKey)
        token = nil
        currentUser = nil
        session = nil
        bootstrap = nil
        phase = .signedOut
    }
}

@Observable
final class AppEnvironment {
    let settings: AppSettingsStore
    let keychain: KeychainStore
    let apiClient: APIClient
    let notificationScheduler: NotificationScheduler
    let authStore: AuthStore
    let draftStore: DraftStore

    init() {
        settings = AppSettingsStore()
        keychain = KeychainStore(service: "com.sage.app")
        apiClient = APIClient(settings: settings)
        notificationScheduler = NotificationScheduler()
        draftStore = DraftStore()
        let authStore = AuthStore(apiClient: apiClient, keychain: keychain, settings: settings)
        self.authStore = authStore
        apiClient.tokenProvider = { [weak authStore] in authStore?.token }
    }
}

struct EmptyBody: Encodable {}

struct AuthRequest: Encodable {
    let username: String
    let password: String
    let deviceName: String?
    let deviceId: String?
}

struct MePayload: Decodable {
    let user: UserDTO
    let settings: UserSettingsDTO
    let session: SessionDTO
}
