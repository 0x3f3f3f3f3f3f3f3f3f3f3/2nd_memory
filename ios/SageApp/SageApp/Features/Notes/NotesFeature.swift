import SwiftUI
import Observation

@Observable
final class NotesViewModel {
    var notes: [NoteDTO] = []
    var tags: [TagDTO] = []
    var query = ""
    var typeFilter: NoteType?
    var selectedTagID: String?
    var isLoading = false
    var errorMessage: String?

    func load(using api: APIClient) async {
        isLoading = true
        defer { isLoading = false }

        do {
            var components = URLComponents()
            components.queryItems = [
                URLQueryItem(name: "q", value: query.isEmpty ? nil : query),
                URLQueryItem(name: "type", value: typeFilter?.rawValue),
                URLQueryItem(name: "tag", value: selectedTagID)
            ].compactMap { item in
                item.value == nil ? nil : item
            }
            let notesPath = "/api/mobile/v1/notes" + (components.percentEncodedQuery.map { "?\($0)" } ?? "")
            async let notesRequest: [NoteDTO] = api.send(path: notesPath)
            async let tagsRequest: [TagDTO] = api.send(path: "/api/mobile/v1/tags")
            notes = try await notesRequest
            tags = try await tagsRequest
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct NotesView: View {
    @Environment(AppEnvironment.self) private var environment
    @State private var viewModel = NotesViewModel()
    @State private var editingNote: NoteDTO?
    @State private var isCreatingNote = false

    var body: some View {
        List {
            Section {
                SectionHeaderView(title: "notes.title", subtitle: nil)
                    .listRowBackground(Color.clear)
                    .listRowInsets(.init(top: 8, leading: 0, bottom: 8, trailing: 0))
            }

            if let errorMessage = viewModel.errorMessage {
                ErrorStateView(message: errorMessage, retry: {
                    Task { @MainActor in
                        await viewModel.load(using: environment.apiClient)
                    }
                })
                .listRowBackground(Color.clear)
            } else if viewModel.isLoading {
                LoadingStateView()
                    .listRowBackground(Color.clear)
            } else if viewModel.notes.isEmpty {
                EmptyStateView(systemName: "note.text", title: "notes.empty.title", message: "notes.empty.message")
                    .listRowBackground(Color.clear)
            } else {
                ForEach(viewModel.notes) { note in
                    Button {
                        editingNote = note
                    } label: {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(note.title)
                                .font(.body.weight(.semibold))
                            if !note.summary.isEmpty {
                                Text(note.summary)
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(2)
                            }
                            if !note.tags.isEmpty {
                                ScrollView(.horizontal, showsIndicators: false) {
                                    HStack(spacing: 8) {
                                        ForEach(note.tags) { tag in
                                            TagChipView(tag: tag)
                                        }
                                    }
                                }
                            }
                        }
                        .padding(.vertical, 8)
                    }
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(Color.clear)
        .searchable(text: $viewModel.query, placement: .navigationBarDrawer(displayMode: .always), prompt: Text("search.placeholder"))
        .navigationTitle(String(localized: "notes.title"))
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button {
                    isCreatingNote = true
                } label: {
                    Label("notes.new", systemImage: "square.and.pencil")
                }
            }
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Picker(String(localized: "notes.type"), selection: Binding(get: { viewModel.typeFilter }, set: { viewModel.typeFilter = $0 })) {
                        Text("tasks.filter.all").tag(Optional<NoteType>.none)
                        ForEach(NoteType.allCases) { type in
                            Text(type.rawValue).tag(Optional(type))
                        }
                    }
                    Picker(String(localized: "notes.tag"), selection: Binding(get: { viewModel.selectedTagID }, set: { viewModel.selectedTagID = $0 })) {
                        Text("tasks.filter.all").tag(Optional<String>.none)
                        ForEach(viewModel.tags) { tag in
                            Text(tag.name).tag(Optional(tag.id))
                        }
                    }
                } label: {
                    Image(systemName: "line.3.horizontal.decrease.circle")
                }
            }
        }
        .task {
            await viewModel.load(using: environment.apiClient)
        }
        .onSubmit(of: .search) {
            Task { @MainActor in
                await viewModel.load(using: environment.apiClient)
            }
        }
        .onChange(of: viewModel.typeFilter) { _, _ in
            Task { @MainActor in
                await viewModel.load(using: environment.apiClient)
            }
        }
        .onChange(of: viewModel.selectedTagID) { _, _ in
            Task { @MainActor in
                await viewModel.load(using: environment.apiClient)
            }
        }
        .sheet(item: $editingNote) { note in
            NoteEditorSheet(note: note, tags: viewModel.tags) { _ in
                Task { @MainActor in
                    await viewModel.load(using: environment.apiClient)
                }
            }
        }
        .sheet(isPresented: $isCreatingNote) {
            NoteEditorSheet(note: nil, tags: viewModel.tags) { _ in
                Task { @MainActor in
                    await viewModel.load(using: environment.apiClient)
                }
            }
        }
        .refreshable {
            await viewModel.load(using: environment.apiClient)
        }
    }
}

struct NoteEditorSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppEnvironment.self) private var environment

    let note: NoteDTO?
    let tags: [TagDTO]
    let onSave: (NoteDTO) -> Void

    @State private var title = ""
    @State private var summary = ""
    @State private var content = ""
    @State private var type: NoteType = .other
    @State private var importance: NoteImportance = .medium
    @State private var selectedTagIDs: Set<String> = []
    @State private var showingPreview = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Form {
                    Section(String(localized: "notes.editor.meta")) {
                        TextField(String(localized: "notes.editor.title"), text: $title)
                        TextField(String(localized: "notes.editor.summary"), text: $summary, axis: .vertical)
                            .lineLimit(2...4)
                        Picker(String(localized: "notes.type"), selection: $type) {
                            ForEach(NoteType.allCases) { type in
                                Text(type.rawValue).tag(type)
                            }
                        }
                        Picker(String(localized: "notes.importance"), selection: $importance) {
                            ForEach(NoteImportance.allCases) { importance in
                                Text(importance.rawValue).tag(importance)
                            }
                        }
                    }

                    if !tags.isEmpty {
                        Section(String(localized: "notes.tag")) {
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 8) {
                                    ForEach(tags) { tag in
                                        Button {
                                            if selectedTagIDs.contains(tag.id) {
                                                selectedTagIDs.remove(tag.id)
                                            } else {
                                                selectedTagIDs.insert(tag.id)
                                            }
                                        } label: {
                                            TagChipView(tag: tag)
                                                .opacity(selectedTagIDs.contains(tag.id) ? 1.0 : 0.45)
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                            }
                        }
                    }
                }

                GlassSegmentedFilterRow(
                    items: [false, true],
                    title: { $0 ? String(localized: "notes.preview") : String(localized: "notes.source") },
                    selection: $showingPreview
                )
                .padding(.horizontal)

                if showingPreview {
                    ScrollView {
                        MarkdownPreviewView(markdown: content)
                            .padding()
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .background(.thinMaterial)
                } else {
                    TextEditor(text: $content)
                        .font(.body.monospaced())
                        .padding()
                        .background(.thinMaterial)
                }
            }
            .navigationTitle(note == nil ? String(localized: "notes.new") : String(localized: "notes.edit"))
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("common.cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("common.save") {
                        Task { @MainActor in
                            await save()
                        }
                    }
                    .disabled(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            .task {
                populate()
            }
            .onChange(of: title) { _, _ in persistDraft() }
            .onChange(of: summary) { _, _ in persistDraft() }
            .onChange(of: content) { _, _ in persistDraft() }
        }
    }

    private func populate() {
        let draftKey = note?.id ?? "new-note"
        if let note {
            title = note.title
            summary = note.summary
            content = note.contentMd
            type = note.type
            importance = note.importance
            selectedTagIDs = Set(note.tags.map(\.id))
        } else {
            restoreDraft(for: draftKey)
        }
    }

    private func persistDraft() {
        let snapshot = NoteDraftSnapshot(title: title, summary: summary, content: content)
        guard let data = try? JSONEncoder().encode(snapshot), let payload = String(data: data, encoding: .utf8) else { return }
        environment.draftStore.writeDraft(payload, for: note?.id ?? "new-note")
    }

    private func clearDraft() {
        environment.draftStore.clearDraft(for: note?.id ?? "new-note")
    }

    private func restoreDraft(for key: String) {
        let payload = environment.draftStore.readDraft(for: key)
        guard let data = payload.data(using: .utf8),
              let snapshot = try? JSONDecoder().decode(NoteDraftSnapshot.self, from: data)
        else {
            return
        }
        title = snapshot.title
        summary = snapshot.summary
        content = snapshot.content
    }

    private func save() async {
        let request = NoteWriteRequest(
            title: title,
            summary: summary,
            contentMd: content,
            type: type,
            importance: importance,
            isPinned: note?.isPinned ?? false,
            tagIds: Array(selectedTagIDs),
            relatedTaskIds: note?.relatedTasks.map(\.id) ?? []
        )

        do {
            let saved: NoteDTO
            if let note {
                saved = try await environment.apiClient.send(path: "/api/mobile/v1/notes/\(note.id)", method: "PATCH", body: request)
            } else {
                saved = try await environment.apiClient.send(path: "/api/mobile/v1/notes", method: "POST", body: request)
            }
            clearDraft()
            onSave(saved)
            dismiss()
        } catch {
        }
    }
}

private struct NoteWriteRequest: Encodable {
    let title: String
    let summary: String
    let contentMd: String
    let type: NoteType
    let importance: NoteImportance
    let isPinned: Bool
    let tagIds: [String]
    let relatedTaskIds: [String]
}

private struct NoteDraftSnapshot: Codable {
    let title: String
    let summary: String
    let content: String
}
