import Foundation

/// One Todo or Task as the widget and the panel draw it.
struct CalendarItem: Identifiable, Hashable {
    let id: String
    let type: String
    let title: String
    /// "yyyy-MM-dd", as the server stores it.
    let startDate: String
    let dueDate: String?
    let completed: Bool

    var isTask: Bool { type == "task" }
    /// The last day the item covers; an item without a due date lasts one day.
    var endDate: String { dueDate ?? startDate }
}

/// The calendar's side of `GET /api/items`.
enum TEOAPI {
    static let itemsURL = URL(string: "https://theo-flow.dbsguswl0110.workers.dev/api/items")!

    /// Throws on network, HTTP or format errors so callers can keep showing their last good data.
    /// The panel asks for completed items too (shown dimmed); widgets only list what is still open.
    static func fetchItems(includeCompleted: Bool = false) async throws -> [CalendarItem] {
        let (data, response) = try await URLSession.shared.data(from: itemsURL)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }
        let records = try JSONDecoder().decode([Lossy<Record>].self, from: data).compactMap { $0.value }
        return records.flatMap { $0.calendarItems(includeCompleted: includeCompleted) }
    }

    /// Widget timelines have no previous data to fall back on, so a failure shows an empty calendar.
    static func loadItemsOrEmpty() async -> [CalendarItem] {
        (try? await fetchItems()) ?? []
    }

    // MARK: Wire format

    private struct SubTodoRecord: Decodable {
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

    private struct Record: Decodable {
        let id: String
        let type: String
        let title: String
        // start_date is nullable in the database; an item without one cannot be placed on a calendar.
        let startDate: String?
        let dueDate: String?
        let completed: Bool
        let deletedAt: String?
        let subTodos: [SubTodoRecord]

        enum CodingKeys: String, CodingKey {
            case id, type, title, completed, subTodos
            case startDate = "start_date"
            case dueDate = "due_date"
            case deletedAt = "deleted_at"
        }

        /// Todos and Tasks become calendar items, and so does every Task inside a Todo. Notes and trash do not.
        func calendarItems(includeCompleted: Bool) -> [CalendarItem] {
            guard deletedAt == nil, let start = startDate else { return [] }
            let onCalendar = type == "todo" || type == "task"
            let own: [CalendarItem] = onCalendar && (includeCompleted || !completed)
                ? [CalendarItem(id: id, type: type, title: title, startDate: start, dueDate: dueDate, completed: completed)]
                : []
            let children = subTodos
                .filter { includeCompleted || !$0.completed }
                .map {
                    CalendarItem(
                        id: $0.id,
                        type: "task",
                        title: $0.title,
                        startDate: $0.startDate ?? start,
                        dueDate: $0.dueDate ?? dueDate,
                        completed: $0.completed
                    )
                }
            return own + children
        }
    }

    /// Decodes one array element without letting a malformed record fail the whole list.
    private struct Lossy<Value: Decodable>: Decodable {
        let value: Value?

        init(from decoder: Decoder) throws {
            value = try? decoder.singleValueContainer().decode(Value.self)
        }
    }
}
