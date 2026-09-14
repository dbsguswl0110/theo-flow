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
    let content: String
    let startDate: String
    let dueDate: String?
    let completed: Bool
    let deletedAt: String?
    let subTodos: [WidgetSubTodo]

    enum CodingKeys: String, CodingKey {
        case id, type, title, content, completed, subTodos
        case startDate = "start_date"
        case dueDate = "due_date"
        case deletedAt = "deleted_at"
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

    static func load() async -> [WidgetItem] {
        do {
            let (data, response) = try await URLSession.shared.data(from: endpoint)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { return [] }
            let decoded = try JSONDecoder().decode([APIItem].self, from: data)
            return decoded.flatMap { item -> [WidgetItem] in
                guard item.deletedAt == nil else { return [] }
                let parent: [WidgetItem] = item.type == "todo" && !item.completed ? [
                    WidgetItem(id: item.id, type: item.type, title: item.title, startDate: item.startDate, dueDate: item.dueDate, completed: item.completed)
                ] : (item.type == "task" && !item.completed ? [
                    WidgetItem(id: item.id, type: item.type, title: item.title, startDate: item.startDate, dueDate: item.dueDate, completed: item.completed)
                ] : [])
                let children = item.subTodos.filter { !$0.completed }.map {
                    WidgetItem(id: $0.id, type: "task", title: $0.title, startDate: $0.startDate ?? item.startDate, dueDate: $0.dueDate ?? item.dueDate, completed: $0.completed)
                }
                return parent + children
            }
        } catch {
            return []
        }
    }
}
