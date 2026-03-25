import SwiftUI
import Observation

enum TimelineMode: String, CaseIterable, Hashable, Identifiable {
    case week
    case month

    var id: String { rawValue }
}

@Observable
final class TimelineViewModel {
    var blocks: [TimelineBlockDTO] = []
    var tasks: [TaskDTO] = []
    var tags: [TagDTO] = []
    var mode: TimelineMode = .week
    var anchorDate = Date()
    var isLoading = false
    var errorMessage: String?

    func load(using api: APIClient) async {
        isLoading = true
        defer { isLoading = false }

        do {
            let range = dateRange
            let formatter = DateFormatter.makeOffsetISO8601()
            async let blocksRequest: [TimelineBlockDTO] = api.send(
                path: "/api/mobile/v1/timeline?start=\(formatter.string(from: range.start).addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")&end=\(formatter.string(from: range.end).addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")"
            )
            async let tasksRequest: [TaskDTO] = api.send(path: "/api/mobile/v1/tasks")
            async let tagsRequest: [TagDTO] = api.send(path: "/api/mobile/v1/tags")
            blocks = try await blocksRequest
            tasks = try await tasksRequest
            tags = try await tagsRequest
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    var dateRange: (start: Date, end: Date) {
        let calendar = Calendar.current
        switch mode {
        case .week:
            let start = calendar.dateInterval(of: .weekOfYear, for: anchorDate)?.start ?? anchorDate
            let end = calendar.date(byAdding: .day, value: 7, to: start) ?? anchorDate
            return (start, end)
        case .month:
            let start = calendar.dateInterval(of: .month, for: anchorDate)?.start ?? anchorDate
            let end = calendar.date(byAdding: .month, value: 1, to: start) ?? anchorDate
            return (start, end)
        }
    }
}

struct TimelineScreen: View {
    @Environment(AppEnvironment.self) private var environment
    @State private var viewModel = TimelineViewModel()
    @State private var selectedTask: TaskDTO?
    @State private var selectedBlock: TimeBlockDTO?
    @State private var createBlockForTask: TaskDTO?

    var body: some View {
        List {
            Section {
                SectionHeaderView(title: "timeline.title", subtitle: rangeTitle)
                    .listRowBackground(Color.clear)
                    .listRowInsets(.init(top: 8, leading: 0, bottom: 8, trailing: 0))

                HStack {
                    Button {
                        shift(-1)
                    } label: {
                        Image(systemName: "chevron.left")
                    }

                    Spacer()

                    GlassSegmentedFilterRow(items: TimelineMode.allCases, title: timelineModeTitle, selection: $viewModel.mode)

                    Spacer()

                    Button {
                        shift(1)
                    } label: {
                        Image(systemName: "chevron.right")
                    }
                }
                .listRowBackground(Color.clear)
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
            } else if groupedBlocks.isEmpty {
                EmptyStateView(systemName: "calendar", title: "timeline.empty.title", message: "timeline.empty.message")
                    .listRowBackground(Color.clear)
            } else {
                ForEach(groupedBlocks, id: \.dayTitle) { section in
                    Section(section.dayTitle) {
                        ForEach(section.blocks) { block in
                            Button {
                                selectedTask = block.task
                            } label: {
                                VStack(alignment: .leading, spacing: 6) {
                                    Text(block.task.title)
                                        .font(.body.weight(.medium))
                                    Text(blockTimeLabel(block))
                                        .font(.footnote)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .swipeActions {
                                Button {
                                    selectedBlock = TimeBlockDTO(
                                        id: block.id,
                                        taskId: block.taskId,
                                        startAt: block.startAt,
                                        endAt: block.endAt,
                                        isAllDay: block.isAllDay,
                                        createdAt: block.createdAt,
                                        updatedAt: block.updatedAt
                                    )
                                } label: {
                                    Label("common.edit", systemImage: "pencil")
                                }
                                .tint(.orange)
                            }
                        }
                    }
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(Color.clear)
        .navigationTitle(String(localized: "timeline.title"))
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Menu {
                    ForEach(viewModel.tasks) { task in
                        Button(task.title) {
                            createBlockForTask = task
                        }
                    }
                } label: {
                    Label("timeline.addBlock", systemImage: "plus")
                }
            }
        }
        .task {
            await viewModel.load(using: environment.apiClient)
        }
        .onChange(of: viewModel.mode) { _, _ in
            Task { @MainActor in
                await viewModel.load(using: environment.apiClient)
            }
        }
        .sheet(item: $selectedTask) { task in
            TaskEditorSheet(task: task, tags: viewModel.tags) { _ in
                Task { @MainActor in
                    await viewModel.load(using: environment.apiClient)
                }
            }
        }
        .sheet(item: $selectedBlock) { block in
            let relatedTask = viewModel.tasks.first { $0.id == block.taskId }
            TimeBlockEditorSheet(task: relatedTask, existing: block) { _ in
                Task { @MainActor in
                    await viewModel.load(using: environment.apiClient)
                }
            }
        }
        .sheet(item: $createBlockForTask) { task in
            TimeBlockEditorSheet(task: task, existing: nil) { _ in
                Task { @MainActor in
                    await viewModel.load(using: environment.apiClient)
                }
            }
        }
        .refreshable {
            await viewModel.load(using: environment.apiClient)
        }
    }

    private var groupedBlocks: [TimelineSection] {
        Dictionary(grouping: viewModel.blocks) { block in
            Date.fromISO8601(block.startAt)?.formatted(date: .complete, time: .omitted) ?? String(localized: "timeline.unknownDay")
        }
        .map { TimelineSection(dayTitle: $0.key, blocks: $0.value.sorted(by: { $0.startAt < $1.startAt })) }
        .sorted { $0.dayTitle < $1.dayTitle }
    }

    private var rangeTitle: String {
        let range = viewModel.dateRange
        return "\(range.start.formatted(date: .abbreviated, time: .omitted)) - \(range.end.formatted(date: .abbreviated, time: .omitted))"
    }

    private func shift(_ offset: Int) {
        switch viewModel.mode {
        case .week:
            viewModel.anchorDate = Calendar.current.date(byAdding: .day, value: offset * 7, to: viewModel.anchorDate) ?? viewModel.anchorDate
        case .month:
            viewModel.anchorDate = Calendar.current.date(byAdding: .month, value: offset, to: viewModel.anchorDate) ?? viewModel.anchorDate
        }
        Task { @MainActor in
            await viewModel.load(using: environment.apiClient)
        }
    }

    private func timelineModeTitle(_ mode: TimelineMode) -> String {
        switch mode {
        case .week: return String(localized: "tasks.view.week")
        case .month: return String(localized: "tasks.view.month")
        }
    }

    private func blockTimeLabel(_ block: TimelineBlockDTO) -> String {
        if block.isAllDay {
            return String(localized: "timeline.allDay")
        }
        let start = Date.fromISO8601(block.startAt)?.formatted(date: .omitted, time: .shortened) ?? block.startAt
        let end = Date.fromISO8601(block.endAt)?.formatted(date: .omitted, time: .shortened) ?? block.endAt
        return "\(start) - \(end)"
    }
}

private struct TimelineSection: Hashable {
    let dayTitle: String
    let blocks: [TimelineBlockDTO]
}
