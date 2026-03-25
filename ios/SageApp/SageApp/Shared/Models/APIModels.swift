import Foundation

struct APIEnvelope<T: Decodable>: Decodable {
    let data: T
}

struct APIErrorEnvelope: Decodable, Error {
    let error: APIErrorPayload
}

struct APIErrorPayload: Decodable, Error {
    let code: String
    let message: String
}

struct AuthPayload: Decodable {
    let token: String
    let user: UserDTO
    let settings: UserSettingsDTO
    let session: SessionDTO
}

struct SessionDTO: Decodable, Hashable {
    let id: String
    let deviceName: String?
    let expiresAt: String
    let lastUsedAt: String?
}

struct UserDTO: Decodable, Hashable {
    let id: String
    let username: String
    let createdAt: String
}

struct UserSettingsDTO: Codable, Hashable {
    let language: AppLanguage
    let theme: AppTheme
    let timezoneMode: TimezoneMode
    let timezoneOverride: String?
    let effectiveTimezone: String
}

struct BootstrapDTO: Decodable {
    let user: UserDTO
    let settings: UserSettingsDTO
    let summary: BootstrapSummaryDTO
}

struct BootstrapSummaryDTO: Decodable, Hashable {
    let inboxCount: Int
    let tagCount: Int
    let noteCount: Int
    let taskCounts: [String: Int]
}

struct TagDTO: Codable, Hashable, Identifiable {
    let id: String
    let name: String
    let slug: String
    let color: String
    let icon: String?
    let description: String?
    let sortOrder: Int
    let taskCount: Int?
    let noteCount: Int?
    let createdAt: String
    let updatedAt: String
}

struct SubTaskDTO: Codable, Hashable, Identifiable {
    let id: String
    let title: String
    let done: Bool
    let sortOrder: Int
    let createdAt: String
    let updatedAt: String
}

struct TimeBlockDTO: Codable, Hashable, Identifiable {
    let id: String
    let taskId: String
    let startAt: String
    let endAt: String
    let isAllDay: Bool
    let createdAt: String
    let updatedAt: String
}

struct TaskDTO: Codable, Hashable, Identifiable {
    let id: String
    let title: String
    let description: String?
    let status: TaskStatus
    let priority: TaskPriority
    let dueAt: String?
    let reminderAt: String?
    let completedAt: String?
    let estimateMinutes: Int?
    let isPinned: Bool
    let sortOrder: Int
    let sourceNoteId: String?
    let createdAt: String
    let updatedAt: String
    let archivedAt: String?
    let tags: [TagDTO]
    let subtasks: [SubTaskDTO]
    let timeBlocks: [TimeBlockDTO]?
}

struct NoteTaskReferenceDTO: Codable, Hashable {
    let id: String
    let title: String
    let status: TaskStatus
    let priority: TaskPriority
    let dueAt: String?
}

struct NoteDTO: Codable, Hashable, Identifiable {
    let id: String
    let title: String
    let slug: String
    let summary: String
    let contentMd: String
    let type: NoteType
    let importance: NoteImportance
    let isPinned: Bool
    let createdAt: String
    let updatedAt: String
    let archivedAt: String?
    let tags: [TagDTO]
    let relatedTasks: [NoteTaskReferenceDTO]
}

struct InboxItemDTO: Codable, Hashable, Identifiable {
    let id: String
    let content: String
    let capturedAt: String
    let processedAt: String?
    let processType: InboxProcessType
}

struct SearchResultsDTO: Decodable {
    let tasks: [TaskSearchDTO]
    let notes: [NoteSearchDTO]
    let tags: [TagSearchDTO]
}

struct TaskSearchDTO: Codable, Hashable, Identifiable {
    let id: String
    let title: String
    let status: TaskStatus
    let priority: TaskPriority
    let dueAt: String?
}

struct NoteSearchDTO: Codable, Hashable, Identifiable {
    let id: String
    let title: String
    let slug: String
    let summary: String
    let type: NoteType
}

struct TagSearchDTO: Codable, Hashable, Identifiable {
    let id: String
    let name: String
    let slug: String
    let color: String
}

struct TagDetailDTO: Decodable, Identifiable {
    let tag: TagDTO
    let tasks: [TaskDTO]
    let notes: [NoteDTO]

    var id: String { tag.id }
}

struct InboxProcessResponseDTO: Decodable {
    let inboxItem: InboxItemDTO
    let task: TaskDTO?
    let note: NoteDTO?
}

struct TimelineBlockDTO: Decodable, Hashable, Identifiable {
    let id: String
    let taskId: String
    let startAt: String
    let endAt: String
    let isAllDay: Bool
    let createdAt: String
    let updatedAt: String
    let task: TaskDTO
}

struct EmptySuccessDTO: Decodable {
    let success: Bool
}

enum AppLanguage: String, Codable, CaseIterable, Hashable, Identifiable {
    case english = "en"
    case chineseSimplified = "zh-Hans"

    var id: String { rawValue }
}

enum AppTheme: String, Codable, CaseIterable, Hashable, Identifiable {
    case light
    case dark
    case system

    var id: String { rawValue }
}

enum TimezoneMode: String, Codable, CaseIterable, Hashable, Identifiable {
    case system
    case manual

    var id: String { rawValue }
}

enum TaskStatus: String, Codable, CaseIterable, Hashable, Identifiable {
    case inbox = "INBOX"
    case todo = "TODO"
    case doing = "DOING"
    case done = "DONE"
    case archived = "ARCHIVED"

    var id: String { rawValue }
}

enum TaskPriority: String, Codable, CaseIterable, Hashable, Identifiable {
    case low = "LOW"
    case medium = "MEDIUM"
    case high = "HIGH"
    case urgent = "URGENT"

    var id: String { rawValue }
}

enum NoteType: String, Codable, CaseIterable, Hashable, Identifiable {
    case advice = "ADVICE"
    case decision = "DECISION"
    case person = "PERSON"
    case lesson = "LESSON"
    case health = "HEALTH"
    case finance = "FINANCE"
    case other = "OTHER"

    var id: String { rawValue }
}

enum NoteImportance: String, Codable, CaseIterable, Hashable, Identifiable {
    case low = "LOW"
    case medium = "MEDIUM"
    case high = "HIGH"

    var id: String { rawValue }
}

enum InboxProcessType: String, Codable, CaseIterable, Hashable, Identifiable {
    case none = "NONE"
    case task = "TASK"
    case note = "NOTE"
    case both = "BOTH"

    var id: String { rawValue }
}
