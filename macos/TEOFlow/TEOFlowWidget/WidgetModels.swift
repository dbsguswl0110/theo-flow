import Foundation

struct WidgetSubTodo: Decodable {
    let id: String
    let title: String
    let completed: Bool
    let startDate: String?
    let dueDate: String?

    enum CodingKeys: String, CodingKey {
        case id, title, completed
        case startDate = "start_date"
        case dueDate = "due_date"
    }
}

struct APIItem: Decodable {
    let id: String
    let type: String
    let title: String
    // start_date is nullable in the database; an item without one cannot be placed on a calendar.
    let startDate: String?
    let dueDate: String?
    let completed: Bool
    let deletedAt: String?
    let subTodos: [WidgetSubTodo]

    enum CodingKeys: String, CodingKey {
        case id, type, title, completed, subTodos
        case startDate = "start_date"
        case dueDate = "due_date"
        case deletedAt = "deleted_at"
    }
}

/// Decodes one array element without letting a malformed record fail the whole list.
private struct Lossy<Value: Decodable>: Decodable {
    let value: Value?

    init(from decoder: Decoder) throws {
        value = try? decoder.singleValueContainer().decode(Value.self)
    }
}

struct WidgetItem: Identifiable, Hashable {
    let id: String
    let type: String
    let title: String
    let startDate: String
    let dueDate: String?
    let completed: Bool

    var isTask: Bool { type == "task" }
}

enum WidgetData {
    static let endpoint = URL(string: "https://theo-flow.dbsguswl0110.workers.dev/api/items")!

    /// Throws on network, HTTP or format errors so callers can keep showing their last good data.
    static func fetch() async throws -> [WidgetItem] {
        let (data, response) = try await URLSession.shared.data(from: endpoint)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }
        let decoded = try JSONDecoder().decode([Lossy<APIItem>].self, from: data).compactMap { $0.value }
        return decoded.flatMap { item -> [WidgetItem] in
            guard item.deletedAt == nil, let start = item.startDate else { return [] }
            let parent: [WidgetItem] = (item.type == "todo" || item.type == "task") && !item.completed ? [
                WidgetItem(id: item.id, type: item.type, title: item.title, startDate: start, dueDate: item.dueDate, completed: item.completed)
            ] : []
            let children = item.subTodos.filter { !$0.completed }.map {
                WidgetItem(id: $0.id, type: "task", title: $0.title, startDate: $0.startDate ?? start, dueDate: $0.dueDate ?? item.dueDate, completed: $0.completed)
            }
            return parent + children
        }
    }

    /// Widget timelines have no previous data to fall back on, so a failure shows an empty calendar.
    static func load() async -> [WidgetItem] {
        (try? await fetch()) ?? []
    }
}
