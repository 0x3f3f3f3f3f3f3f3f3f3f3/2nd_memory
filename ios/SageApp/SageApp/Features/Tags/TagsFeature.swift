import SwiftUI
import Observation

@Observable
final class TagsViewModel {
    var tags: [TagDTO] = []
    var detail: TagDetailDTO?
    var isLoading = false
    var errorMessage: String?

    func load(using api: APIClient) async {
        isLoading = true
        defer { isLoading = false }
        do {
            tags = try await api.send(path: "/api/mobile/v1/tags")
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func loadDetail(tagRef: String, using api: APIClient) async {
        do {
            detail = try await api.send(path: "/api/mobile/v1/tags/\(tagRef)/detail")
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct TagsView: View {
    @Environment(AppEnvironment.self) private var environment
    @State private var viewModel = TagsViewModel()
    @State private var selectedTag: TagDTO?
    @State private var editingTag: TagDTO?
    @State private var isCreatingTag = false

    var body: some View {
        List {
            if viewModel.isLoading {
                LoadingStateView()
                    .listRowBackground(Color.clear)
            } else if viewModel.tags.isEmpty {
                EmptyStateView(systemName: "tag", title: "tags.empty.title", message: "tags.empty.message")
                    .listRowBackground(Color.clear)
            } else {
                ForEach(viewModel.tags) { tag in
                    Button {
                        selectedTag = tag
                    } label: {
                        HStack {
                            TagChipView(tag: tag)
                            Spacer()
                            Text("\((tag.taskCount ?? 0) + (tag.noteCount ?? 0))")
                                .foregroundStyle(.secondary)
                        }
                    }
                    .swipeActions {
                        Button {
                            editingTag = tag
                        } label: {
                            Label("common.edit", systemImage: "pencil")
                        }
                        .tint(.orange)
                    }
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(Color.clear)
        .navigationTitle(String(localized: "tags.title"))
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    isCreatingTag = true
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .task {
            await viewModel.load(using: environment.apiClient)
        }
        .sheet(item: $selectedTag) { tag in
            TagDetailView(tag: tag)
        }
        .sheet(item: $editingTag) { tag in
            TagEditorSheet(tag: tag) {
                Task { @MainActor in
                    await viewModel.load(using: environment.apiClient)
                }
            }
        }
        .sheet(isPresented: $isCreatingTag) {
            TagEditorSheet(tag: nil) {
                Task { @MainActor in
                    await viewModel.load(using: environment.apiClient)
                }
            }
        }
    }
}

struct TagDetailView: View {
    @Environment(AppEnvironment.self) private var environment
    let tag: TagDTO
    @State private var viewModel = TagsViewModel()
    @State private var selectedTask: TaskDTO?
    @State private var selectedNote: NoteDTO?

    var body: some View {
        List {
            if let detail = viewModel.detail {
                Section {
                    VStack(alignment: .leading, spacing: 8) {
                        TagChipView(tag: detail.tag)
                        if let description = detail.tag.description {
                            Text(description)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                if !detail.tasks.isEmpty {
                    Section(String(localized: "tasks.title")) {
                        ForEach(detail.tasks) { task in
                            Button {
                                selectedTask = task
                            } label: {
                                TaskRow(task: task, cycle: {})
                            }
                        }
                    }
                }
                if !detail.notes.isEmpty {
                    Section(String(localized: "notes.title")) {
                        ForEach(detail.notes) { note in
                            Button {
                                selectedNote = note
                            } label: {
                                VStack(alignment: .leading, spacing: 6) {
                                    Text(note.title)
                                    Text(note.summary)
                                        .font(.footnote)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }
            } else if viewModel.isLoading {
                LoadingStateView()
                    .listRowBackground(Color.clear)
            }
        }
        .navigationTitle(tag.name)
        .task {
            await viewModel.loadDetail(tagRef: tag.id, using: environment.apiClient)
        }
        .sheet(item: $selectedTask) { task in
            TaskEditorSheet(task: task, tags: viewModel.detail?.tasks.first?.tags ?? []) { _ in }
        }
        .sheet(item: $selectedNote) { note in
            NoteEditorSheet(note: note, tags: viewModel.detail?.notes.first?.tags ?? []) { _ in }
        }
    }
}

struct TagEditorSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppEnvironment.self) private var environment

    let tag: TagDTO?
    let onSave: () -> Void

    @State private var name = ""
    @State private var color = "#C96444"
    @State private var description = ""

    var body: some View {
        NavigationStack {
            Form {
                TextField(String(localized: "tags.editor.name"), text: $name)
                TextField(String(localized: "tags.editor.color"), text: $color)
                TextField(String(localized: "tags.editor.description"), text: $description)
                if let tag {
                    Button(role: .destructive) {
                        Task { @MainActor in
                            await delete(tag: tag)
                        }
                    } label: {
                        Label("common.delete", systemImage: "trash")
                    }
                }
            }
            .navigationTitle(tag == nil ? String(localized: "tags.new") : String(localized: "tags.edit"))
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
                }
            }
            .task {
                if let tag {
                    name = tag.name
                    color = tag.color
                    description = tag.description ?? ""
                }
            }
        }
    }

    private func save() async {
        let request = TagWriteRequest(name: name, color: color, icon: nil, description: description.isEmpty ? nil : description, sortOrder: tag?.sortOrder)
        do {
            if let tag {
                let _: TagDTO = try await environment.apiClient.send(path: "/api/mobile/v1/tags/\(tag.id)", method: "PATCH", body: request)
            } else {
                let _: TagDTO = try await environment.apiClient.send(path: "/api/mobile/v1/tags", method: "POST", body: request)
            }
            onSave()
            dismiss()
        } catch {
        }
    }

    private func delete(tag: TagDTO) async {
        do {
            let _: EmptySuccessDTO = try await environment.apiClient.send(path: "/api/mobile/v1/tags/\(tag.id)", method: "DELETE", body: EmptyBody())
            onSave()
            dismiss()
        } catch {
        }
    }
}

private struct TagWriteRequest: Encodable {
    let name: String
    let color: String
    let icon: String?
    let description: String?
    let sortOrder: Int?
}
