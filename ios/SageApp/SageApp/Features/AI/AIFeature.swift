import SwiftUI
import Observation

struct ChatMessage: Identifiable, Hashable, Encodable {
    enum Role: String, Codable {
        case user
        case assistant
    }

    let id: UUID
    let role: Role
    let content: String

    init(id: UUID = UUID(), role: Role, content: String) {
        self.id = id
        self.role = role
        self.content = content
    }
}

@Observable
final class AIChatViewModel {
    var messages: [ChatMessage] = []
    var input = ""
    var isStreaming = false
    var errorMessage: String?

    func send(using api: APIClient, locale: AppLanguage, timezone: String, refreshCenter: AppEnvironment.AIRefreshCenter) async {
        let prompt = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !prompt.isEmpty, !isStreaming else { return }
        input = ""
        errorMessage = nil
        isStreaming = true
        messages.append(ChatMessage(role: .user, content: prompt))
        messages.append(ChatMessage(role: .assistant, content: ""))

        let request = AIChatRequest(messages: messages.map { AIMessageRequest(role: $0.role, content: $0.content) }, locale: locale, timezone: timezone)

        do {
            var content = ""
            var impactedFeatures = Set<AIRefreshFeature>()
            for try await event in api.streamEvents(path: "/api/mobile/v1/ai/chat", body: request) {
                switch event.type {
                case "token":
                    content += event.delta ?? ""
                    if let index = messages.lastIndex(where: { $0.role == .assistant }) {
                        messages[index] = ChatMessage(id: messages[index].id, role: .assistant, content: content)
                    }
                case "mutation":
                    for feature in event.features ?? [] {
                        impactedFeatures.insert(feature)
                    }
                case "complete":
                    if let summary = event.summary, !summary.isEmpty {
                        content = summary
                        if let index = messages.lastIndex(where: { $0.role == .assistant }) {
                            messages[index] = ChatMessage(id: messages[index].id, role: .assistant, content: content)
                        }
                    }
                case "error":
                    throw NSError(domain: "AIStream", code: 1, userInfo: [NSLocalizedDescriptionKey: event.message ?? "Unknown AI stream error"])
                default:
                    continue
                }
            }
            refreshCenter.apply(features: Array(impactedFeatures))
        } catch {
            errorMessage = error.localizedDescription
        }

        isStreaming = false
    }
}

struct AIAssistantView: View {
    @Environment(AppEnvironment.self) private var environment
    @State private var viewModel = AIChatViewModel()

    var body: some View {
        ScrollViewReader { proxy in
            List {
                if viewModel.messages.isEmpty {
                    EmptyStateView(systemName: "sparkles", title: "ai.empty.title", message: "ai.empty.message")
                        .listRowBackground(Color.clear)
                } else {
                    ForEach(viewModel.messages) { message in
                        HStack {
                            if message.role == .assistant {
                                VStack(alignment: .leading, spacing: 8) {
                                    Text("Sage")
                                        .font(.caption.weight(.bold))
                                        .foregroundStyle(.secondary)
                                    MarkdownPreviewView(markdown: message.content)
                                }
                                Spacer()
                            } else {
                                Spacer()
                                Text(message.content)
                                    .padding(12)
                                    .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                            }
                        }
                        .listRowBackground(Color.clear)
                        .id(message.id)
                    }
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .background(Color.clear)
            .safeAreaInset(edge: .bottom) {
                FloatingComposerBar {
                    VStack(alignment: .leading, spacing: 8) {
                        if let errorMessage = viewModel.errorMessage {
                            Text(errorMessage)
                                .font(.footnote)
                                .foregroundStyle(.red)
                        }
                        HStack(alignment: .bottom, spacing: 12) {
                            TextField(String(localized: "ai.placeholder"), text: $viewModel.input, axis: .vertical)
                                .lineLimit(1...6)
                            Button {
                                Task { @MainActor in
                                    await viewModel.send(
                                        using: environment.apiClient,
                                        locale: environment.settings.language,
                                        timezone: environment.settings.effectiveTimeZoneIdentifier,
                                        refreshCenter: environment.aiRefreshCenter
                                    )
                                }
                            } label: {
                                Image(systemName: viewModel.isStreaming ? "hourglass" : "arrow.up.circle.fill")
                                    .font(.system(size: 28))
                                    .foregroundStyle(.orange)
                            }
                            .disabled(viewModel.input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || viewModel.isStreaming)
                        }
                    }
                }
                .padding(.horizontal)
                .padding(.top, 8)
                .padding(.bottom, 12)
            }
            .navigationTitle(String(localized: "ai.title"))
            .onChange(of: viewModel.messages) { _, messages in
                if let lastID = messages.last?.id {
                    withAnimation {
                        proxy.scrollTo(lastID, anchor: .bottom)
                    }
                }
            }
        }
    }
}

private struct AIChatRequest: Encodable {
    let messages: [AIMessageRequest]
    let locale: AppLanguage
    let timezone: String
}

private struct AIMessageRequest: Encodable {
    let role: ChatMessage.Role
    let content: String
}
