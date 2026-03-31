import SwiftUI
import Observation

enum TaskViewMode: String, CaseIterable, Hashable, Identifiable {
    case list
    case week
    case month

    var id: String { rawValue }
}

enum TaskStatusFilter: String, CaseIterable, Hashable, Identifiable {
    case all = "ALL"
    case todo = "TODO"
    case doing = "DOING"
    case done = "DONE"

    var id: String { rawValue }
}

enum TaskDueFilter: String, CaseIterable, Hashable, Identifiable {
    case all = "ALL"
    case today = "TODAY"
    case tomorrow = "TOMORROW"
    case thisWeek = "THIS_WEEK"
    case thisMonth = "THIS_MONTH"

    var id: String { rawValue }
}

@Observable
final class TasksViewModel {
    var tasks: [TaskDTO] = []
    var tags: [TagDTO] = []
    var isLoading = false
    var errorMessage: String?
    var viewMode: TaskViewMode = .list
    var statusFilter: TaskStatusFilter = .all
    var dueFilter: TaskDueFilter = .all

    func load(using api: APIClient, timezone: String) async {
        isLoading = true
        defer { isLoading = false }

        do {
            let tasksPath = "/api/mobile/v1/tasks?status=\(statusFilter.rawValue)&due=\(dueFilter.rawValue)"
            async let tasksRequest: [TaskDTO] = api.send(path: tasksPath)
            async let tagsRequest: [TagDTO] = api.send(path: "/api/mobile/v1/tags")
            tasks = try await tasksRequest
            tags = try await tagsRequest
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func cycle(_ task: TaskDTO, using api: APIClient, notifications: NotificationScheduler) async {
        do {
            let updated: TaskDTO = try await api.send(path: "/api/mobile/v1/tasks/\(task.id)/cycle-status", method: "POST", body: EmptyBody())
            replace(updated)
            await notifications.scheduleReminder(for: updated)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func delete(_ task: TaskDTO, using api: APIClient, notifications: NotificationScheduler) async {
        do {
            let _: EmptySuccessDTO = try await api.send(path: "/api/mobile/v1/tasks/\(task.id)", method: "DELETE", body: EmptyBody())
            tasks.removeAll { $0.id == task.id }
            await notifications.cancelReminder(for: task.id)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func replace(_ task: TaskDTO) {
        if let index = tasks.firstIndex(where: { $0.id == task.id }) {
            tasks[index] = task
        } else {
            tasks.insert(task, at: 0)
        }
    }
}

struct TasksView: View {
    @Environment(AppEnvironment.self) private var environment
    @State private var viewModel = TasksViewModel()
    @State private var editingTask: TaskDTO?
    @State private var isCreatingTask = false

    var body: some View {
        List {
            Section {
                SectionHeaderView(title: "tasks.title", subtitle: nil)
                    .listRowBackground(Color.clear)
                    .listRowInsets(.init(top: 8, leading: 0, bottom: 8, trailing: 0))
                GlassSegmentedFilterRow(items: TaskViewMode.allCases, title: taskViewModeTitle, selection: $viewModel.viewMode)
                    .listRowBackground(Color.clear)
                GlassSegmentedFilterRow(items: TaskStatusFilter.allCases, title: taskStatusTitle, selection: $viewModel.statusFilter)
                    .listRowBackground(Color.clear)
                if viewModel.viewMode == .list {
                    GlassSegmentedFilterRow(items: TaskDueFilter.allCases, title: taskDueTitle, selection: $viewModel.dueFilter)
                        .listRowBackground(Color.clear)
                }
            }

            if let errorMessage = viewModel.errorMessage {
                ErrorStateView(message: errorMessage, retry: {
                    Task { @MainActor in
                        await reload()
                    }
                })
                .listRowBackground(Color.clear)
            } else if viewModel.isLoading {
                LoadingStateView()
                    .listRowBackground(Color.clear)
            } else if filteredTasks.isEmpty {
                EmptyStateView(systemName: "checklist", title: "tasks.empty.title", message: "tasks.empty.message")
                    .listRowBackground(Color.clear)
            } else {
                ForEach(groupedTasks, id: \.title) { group in
                    Section(group.title) {
                        ForEach(group.tasks) { task in
                            TaskRow(task: task) {
                                Task { @MainActor in
                                    await viewModel.cycle(task, using: environment.apiClient, notifications: environment.notificationScheduler)
                                }
                            }
                            .contentShape(Rectangle())
                            .onTapGesture {
                                editingTask = task
                            }
                            .swipeActions {
                                Button(role: .destructive) {
                                    Task { @MainActor in
                                        await viewModel.delete(task, using: environment.apiClient, notifications: environment.notificationScheduler)
                                    }
                                } label: {
                                    Label("common.delete", systemImage: "trash")
                                }
                            }
                        }
                    }
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(Color.clear)
        .navigationTitle(String(localized: "tasks.title"))
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button {
                    isCreatingTask = true
                } label: {
                    Label("tasks.new", systemImage: "plus")
                }
            }
        }
        .task(id: environment.aiRefreshCenter.tasksRevision) {
            await reload()
        }
        .onChange(of: viewModel.statusFilter) { _, _ in
            Task { @MainActor in
                await reload()
            }
        }
        .onChange(of: viewModel.dueFilter) { _, _ in
            Task { @MainActor in
                await reload()
            }
        }
        .sheet(item: $editingTask) { task in
            TaskEditorSheet(task: task, tags: viewModel.tags) { updated in
                viewModel.replace(updated)
            }
        }
        .sheet(isPresented: $isCreatingTask) {
            TaskEditorSheet(task: nil, tags: viewModel.tags) { created in
                viewModel.replace(created)
            }
        }
        .refreshable {
            await reload()
        }
    }

    private var filteredTasks: [TaskDTO] {
        viewModel.tasks
    }

    private var groupedTasks: [TaskGroup] {
        switch viewModel.viewMode {
        case .list:
            return [TaskGroup(title: String(localized: "tasks.all"), tasks: filteredTasks)]
        case .week:
            return Dictionary(grouping: filteredTasks) { task in
                weekSectionTitle(for: task.dueAt)
            }
            .map { TaskGroup(title: $0.key, tasks: $0.value) }
            .sorted { $0.title < $1.title }
        case .month:
            return Dictionary(grouping: filteredTasks) { task in
                monthSectionTitle(for: task.dueAt)
            }
            .map { TaskGroup(title: $0.key, tasks: $0.value) }
            .sorted { $0.title < $1.title }
        }
    }

    private func reload() async {
        await viewModel.load(using: environment.apiClient, timezone: environment.settings.effectiveTimeZoneIdentifier)
    }

    private func taskViewModeTitle(_ mode: TaskViewMode) -> String {
        switch mode {
        case .list: return String(localized: "tasks.view.list")
        case .week: return String(localized: "tasks.view.week")
        case .month: return String(localized: "tasks.view.month")
        }
    }

    private func taskStatusTitle(_ filter: TaskStatusFilter) -> String {
        switch filter {
        case .all: return String(localized: "tasks.filter.all")
        case .todo: return String(localized: "tasks.filter.todo")
        case .doing: return String(localized: "tasks.filter.doing")
        case .done: return String(localized: "tasks.filter.done")
        }
    }

    private func taskDueTitle(_ filter: TaskDueFilter) -> String {
        switch filter {
        case .all: return String(localized: "tasks.filter.all")
        case .today: return String(localized: "tasks.due.today")
        case .tomorrow: return String(localized: "tasks.due.tomorrow")
        case .thisWeek: return String(localized: "tasks.due.thisWeek")
        case .thisMonth: return String(localized: "tasks.due.thisMonth")
        }
    }

    private func weekSectionTitle(for dueAt: String?) -> String {
        guard let date = Date.fromISO8601(dueAt) else { return String(localized: "tasks.unscheduled") }
        return date.formatted(.dateTime.weekday(.wide))
    }

    private func monthSectionTitle(for dueAt: String?) -> String {
        guard let date = Date.fromISO8601(dueAt) else { return String(localized: "tasks.unscheduled") }
        return date.formatted(.dateTime.month(.wide))
    }
}

struct TaskRow: View {
    let task: TaskDTO
    let cycle: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Button(action: cycle) {
                Image(systemName: statusSymbol)
                    .font(.headline)
                    .foregroundStyle(statusColor)
            }
            .buttonStyle(.plain)

            VStack(alignment: .leading, spacing: 8) {
                Text(task.title)
                    .font(.body.weight(.medium))
                    .strikethrough(task.status == .done)
                HStack(spacing: 8) {
                    if let dueAt = task.dueAt {
                        Label(formattedDate(dueAt), systemImage: "calendar")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    if let reminderAt = task.reminderAt {
                        Label(formattedTime(reminderAt), systemImage: "bell")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    if let estimateMinutes = task.estimateMinutes {
                        Label("\(estimateMinutes)m", systemImage: "clock")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                if !task.tags.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(task.tags) { tag in
                                TagChipView(tag: tag)
                            }
                        }
                    }
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 8)
    }

    private var statusSymbol: String {
        switch task.status {
        case .todo, .inbox:
            return "circle"
        case .doing:
            return "circle.dashed"
        case .done:
            return "checkmark.circle.fill"
        case .archived:
            return "archivebox"
        }
    }

    private var statusColor: Color {
        switch task.status {
        case .done:
            return .green
        case .doing:
            return .orange
        default:
            return .secondary
        }
    }

    private func formattedDate(_ string: String) -> String {
        Date.fromISO8601(string)?.formatted(date: .abbreviated, time: .omitted) ?? string
    }

    private func formattedTime(_ string: String) -> String {
        Date.fromISO8601(string)?.formatted(date: .omitted, time: .shortened) ?? string
    }
}

struct TaskGroup: Hashable {
    let title: String
    let tasks: [TaskDTO]
}

struct TaskEditorSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppEnvironment.self) private var environment

    let task: TaskDTO?
    let tags: [TagDTO]
    let onSave: (TaskDTO) -> Void

    @State private var title = ""
    @State private var details = ""
    @State private var status: TaskStatus = .todo
    @State private var priority: TaskPriority = .medium
    @State private var dueAt: Date = .now
    @State private var hasDueDate = false
    @State private var reminderAt: Date = .now
    @State private var hasReminder = false
    @State private var estimateMinutes = ""
    @State private var selectedTagIDs: Set<String> = []
    @State private var subtasks: [SubTaskDTO] = []
    @State private var newSubtaskTitle = ""
    @State private var blocks: [TimeBlockDTO] = []
    @State private var editingBlock: TimeBlockDTO?
    @State private var isCreatingBlock = false

    var body: some View {
        NavigationStack {
            Form {
                Section(String(localized: "tasks.editor.details")) {
                    TextField(String(localized: "tasks.editor.title"), text: $title)
                    TextField(String(localized: "tasks.editor.description"), text: $details, axis: .vertical)
                        .lineLimit(2...6)

                    Picker(String(localized: "tasks.editor.status"), selection: $status) {
                        ForEach([TaskStatus.todo, .doing, .done], id: \.self) { status in
                            Text(status.rawValue).tag(status)
                        }
                    }

                    Picker(String(localized: "tasks.editor.priority"), selection: $priority) {
                        ForEach(TaskPriority.allCases, id: \.self) { priority in
                            Text(priority.rawValue).tag(priority)
                        }
                    }

                    Toggle(String(localized: "tasks.editor.hasDueDate"), isOn: $hasDueDate.animation())
                    if hasDueDate {
                        DatePicker(String(localized: "tasks.editor.dueAt"), selection: $dueAt)
                    }

                    Toggle(String(localized: "tasks.editor.hasReminder"), isOn: $hasReminder.animation())
                    if hasReminder {
                        DatePicker(String(localized: "tasks.editor.reminderAt"), selection: $reminderAt)
                    }

                    TextField(String(localized: "tasks.editor.estimate"), text: $estimateMinutes)
                        .keyboardType(.numberPad)
                }

                if !tags.isEmpty {
                    Section(String(localized: "tasks.editor.tags")) {
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

                Section(String(localized: "tasks.editor.subtasks")) {
                    ForEach(subtasks) { subtask in
                        HStack {
                            Image(systemName: subtask.done ? "checkmark.circle.fill" : "circle")
                                .foregroundStyle(subtask.done ? .green : .secondary)
                            Text(subtask.title)
                        }
                    }

                    HStack {
                        TextField(String(localized: "tasks.editor.newSubtask"), text: $newSubtaskTitle)
                        Button("common.add") {
                            Task { @MainActor in
                                await addSubtask()
                            }
                        }
                        .disabled(newSubtaskTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || task == nil)
                    }
                }

                Section(String(localized: "timeline.title")) {
                    ForEach(blocks) { block in
                        Button {
                            editingBlock = block
                        } label: {
                            VStack(alignment: .leading) {
                                Text(Date.fromISO8601(block.startAt)?.formatted(date: .abbreviated, time: .shortened) ?? block.startAt)
                                Text(Date.fromISO8601(block.endAt)?.formatted(date: .omitted, time: .shortened) ?? block.endAt)
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }

                    Button {
                        isCreatingBlock = true
                    } label: {
                        Label("timeline.addBlock", systemImage: "calendar.badge.plus")
                    }
                    .disabled(task == nil)
                }
            }
            .navigationTitle(task == nil ? String(localized: "tasks.new") : String(localized: "tasks.edit"))
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
            .sheet(item: $editingBlock) { block in
                TimeBlockEditorSheet(task: task, existing: block) { savedBlock in
                    replaceBlock(savedBlock)
                }
            }
            .sheet(isPresented: $isCreatingBlock) {
                TimeBlockEditorSheet(task: task, existing: nil) { savedBlock in
                    blocks.append(savedBlock)
                }
            }
        }
    }

    private func populate() {
        guard let task else { return }
        title = task.title
        details = task.description ?? ""
        status = task.status
        priority = task.priority
        if let due = Date.fromISO8601(task.dueAt) {
            dueAt = due
            hasDueDate = true
        }
        if let reminder = Date.fromISO8601(task.reminderAt) {
            reminderAt = reminder
            hasReminder = true
        }
        estimateMinutes = task.estimateMinutes.map(String.init) ?? ""
        selectedTagIDs = Set(task.tags.map(\.id))
        subtasks = task.subtasks
        blocks = task.timeBlocks ?? []
    }

    private func save() async {
        let request = TaskWriteRequest(
            title: title,
            description: details.isEmpty ? nil : details,
            status: status,
            priority: priority,
            dueAt: hasDueDate ? DateFormatter.makeOffsetISO8601().string(from: dueAt) : nil,
            reminderAt: hasReminder ? DateFormatter.makeOffsetISO8601().string(from: reminderAt) : nil,
            estimateMinutes: Int(estimateMinutes),
            isPinned: task?.isPinned ?? false,
            tagIds: Array(selectedTagIDs)
        )

        do {
            let saved: TaskDTO
            if let task {
                saved = try await environment.apiClient.send(path: "/api/mobile/v1/tasks/\(task.id)", method: "PATCH", body: request)
            } else {
                saved = try await environment.apiClient.send(path: "/api/mobile/v1/tasks", method: "POST", body: request)
            }
            onSave(saved)
            await environment.notificationScheduler.scheduleReminder(for: saved)
            dismiss()
        } catch {
        }
    }

    private func addSubtask() async {
        guard let task else { return }
        do {
            let saved: SubTaskDTO = try await environment.apiClient.send(
                path: "/api/mobile/v1/tasks/\(task.id)/subtasks",
                method: "POST",
                body: NewSubtaskRequest(title: newSubtaskTitle)
            )
            subtasks.append(saved)
            newSubtaskTitle = ""
        } catch {
        }
    }

    private func replaceBlock(_ block: TimeBlockDTO) {
        if let index = blocks.firstIndex(where: { $0.id == block.id }) {
            blocks[index] = block
        } else {
            blocks.append(block)
        }
    }
}

struct TimeBlockEditorSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppEnvironment.self) private var environment

    let task: TaskDTO?
    let existing: TimeBlockDTO?
    let onSave: (TimeBlockDTO) -> Void

    @State private var startAt = Date.now
    @State private var endAt = Calendar.current.date(byAdding: .hour, value: 1, to: .now) ?? .now
    @State private var isAllDay = false

    var body: some View {
        NavigationStack {
            Form {
                DatePicker(String(localized: "timeline.start"), selection: $startAt)
                DatePicker(String(localized: "timeline.end"), selection: $endAt)
                Toggle(String(localized: "timeline.allDay"), isOn: $isAllDay)
                if existing != nil {
                    Button(role: .destructive) {
                        Task { @MainActor in
                            await delete()
                        }
                    } label: {
                        Label("common.delete", systemImage: "trash")
                    }
                }
            }
            .navigationTitle(existing == nil ? String(localized: "timeline.addBlock") : String(localized: "timeline.editBlock"))
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
                if let existing {
                    startAt = Date.fromISO8601(existing.startAt) ?? startAt
                    endAt = Date.fromISO8601(existing.endAt) ?? endAt
                    isAllDay = existing.isAllDay
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func save() async {
        do {
            let request = TimeBlockWriteRequest(
                startAt: DateFormatter.makeOffsetISO8601().string(from: startAt),
                endAt: DateFormatter.makeOffsetISO8601().string(from: endAt),
                isAllDay: isAllDay
            )
            let saved: TimeBlockDTO
            if let existing {
                saved = try await environment.apiClient.send(path: "/api/mobile/v1/time-blocks/\(existing.id)", method: "PATCH", body: request)
            } else if let task {
                saved = try await environment.apiClient.send(path: "/api/mobile/v1/tasks/\(task.id)/time-blocks", method: "POST", body: request)
            } else {
                return
            }
            onSave(saved)
            dismiss()
        } catch {
        }
    }

    private func delete() async {
        guard let existing else { return }
        do {
            let _: EmptySuccessDTO = try await environment.apiClient.send(path: "/api/mobile/v1/time-blocks/\(existing.id)", method: "DELETE", body: EmptyBody())
            dismiss()
        } catch {
        }
    }
}

private struct TaskWriteRequest: Encodable {
    let title: String
    let description: String?
    let status: TaskStatus
    let priority: TaskPriority
    let dueAt: String?
    let reminderAt: String?
    let estimateMinutes: Int?
    let isPinned: Bool
    let tagIds: [String]
}

private struct TimeBlockWriteRequest: Encodable {
    let startAt: String
    let endAt: String
    let isAllDay: Bool
}

private struct NewSubtaskRequest: Encodable {
    let title: String
}

extension DateFormatter {
    static func makeOffsetISO8601() -> DateFormatter {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ssXXXXX"
        return formatter
    }
}
