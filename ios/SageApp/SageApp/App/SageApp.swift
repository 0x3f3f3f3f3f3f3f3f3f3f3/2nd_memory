import SwiftUI

@main
struct SageApp: App {
    @State private var environment = AppEnvironment()

    var body: some Scene {
        WindowGroup {
            RootSceneView()
                .environment(environment)
                .environment(\.locale, environment.settings.locale)
                .preferredColorScheme(environment.settings.colorSchemeOverride)
                .task {
                    await environment.authStore.restoreSession()
                    await environment.authStore.bootstrapApp()
                }
        }
    }
}

private enum RootTab: Hashable {
    case inbox
    case tasks
    case timeline
    case notes
    case ai
}

private enum GlobalSheet: Identifiable {
    case search
    case tags
    case settings

    var id: Int { hashValue }
}

struct RootSceneView: View {
    @Environment(AppEnvironment.self) private var environment

    var body: some View {
        Group {
            switch environment.authStore.phase {
            case .launching:
                ZStack {
                    LinearGradient(colors: [.orange.opacity(0.18), .clear, .yellow.opacity(0.12)], startPoint: .topLeading, endPoint: .bottomTrailing)
                        .ignoresSafeArea()
                    LoadingStateView()
                }
            case .signedOut:
                AuthSceneView()
            case .signedIn:
                MainShellView()
            }
        }
        .animation(.spring(response: 0.32, dampingFraction: 0.84), value: environment.authStore.phase)
    }
}

private struct MainShellView: View {
    @Environment(AppEnvironment.self) private var environment
    @State private var selection: RootTab = .inbox
    @State private var activeSheet: GlobalSheet?

    var body: some View {
        TabView(selection: $selection) {
            NavigationStack {
                InboxView()
                    .toolbar { toolbar }
            }
            .tag(RootTab.inbox)
            .tabItem { Label("tab.inbox", systemImage: "tray.full") }

            NavigationStack {
                TasksView()
                    .toolbar { toolbar }
            }
            .tag(RootTab.tasks)
            .tabItem { Label("tab.tasks", systemImage: "checklist") }

            NavigationStack {
                TimelineScreen()
                    .toolbar { toolbar }
            }
            .tag(RootTab.timeline)
            .tabItem { Label("tab.timeline", systemImage: "calendar") }

            NavigationStack {
                NotesView()
                    .toolbar { toolbar }
            }
            .tag(RootTab.notes)
            .tabItem { Label("tab.notes", systemImage: "note.text") }

            NavigationStack {
                AIAssistantView()
                    .toolbar { toolbar }
            }
            .tag(RootTab.ai)
            .tabItem { Label("tab.ai", systemImage: "sparkles") }
        }
        .tabViewStyle(.sidebarAdaptable)
        .sheet(item: $activeSheet) { sheet in
            switch sheet {
            case .search:
                NavigationStack { SearchView() }
            case .tags:
                NavigationStack { TagsView() }
            case .settings:
                NavigationStack { SettingsView() }
            }
        }
        .background(
            LinearGradient(
                colors: [.orange.opacity(0.10), .clear, .yellow.opacity(0.10)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()
        )
    }

    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        ToolbarItemGroup(placement: .topBarTrailing) {
            GlassToolbarButton(systemName: "magnifyingglass") {
                activeSheet = .search
            }
            Menu {
                Button {
                    activeSheet = .tags
                } label: {
                    Label("menu.tags", systemImage: "tag")
                }

                Button {
                    activeSheet = .settings
                } label: {
                    Label("menu.settings", systemImage: "gearshape")
                }

                Divider()

                Button(role: .destructive) {
                    Task { @MainActor in
                        await environment.authStore.logout()
                    }
                } label: {
                    Label("settings.logout", systemImage: "rectangle.portrait.and.arrow.right")
                }
            } label: {
                Image(systemName: "person.crop.circle")
                    .font(.title3)
            }
        }
    }
}
