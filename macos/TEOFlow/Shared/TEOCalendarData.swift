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
    /// For a Task inside a Todo, the Todo's id (that is the record the server updates); nil for everything else.
    var parentID: String? = nil

    var isTask: Bool { type == "task" }
    /// The last day the item covers; an item without a due date lasts one day.
    var endDate: String { dueDate ?? startDate }

    func settingCompleted(_ value: Bool) -> CalendarItem {
        CalendarItem(id: id, type: type, title: title, startDate: startDate, dueDate: dueDate, completed: value, parentID: parentID)
    }
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

    /// Ticks one Todo, Task, or Task inside a Todo done or open.
    ///
    /// The server's update replaces a whole record, so this reads the record fresh, changes only `completed`
    /// and sends everything else back as it was (a Todo's child Tasks included, with their ids, texts and dates).
    /// Throws without writing anything if the record is gone or in the trash.
    static func setCompleted(_ item: CalendarItem, to completed: Bool) async throws {
        let (data, response) = try await URLSession.shared.data(from: itemsURL)
        guard (response as? HTTPURLResponse)?.statusCode == 200,
              let records = try JSONSerialization.jsonObject(with: data) as? [[String: Any]]
        else { throw URLError(.badServerResponse) }

        let recordID = item.parentID ?? item.id
        guard let record = records.first(where: { ($0["id"] as? String) == recordID }),
              (record["deleted_at"] as? String) == nil,
              let title = record["title"] as? String,
              let start = record["start_date"] as? String
        else { throw URLError(.resourceUnavailable) }

        func value(_ text: String?) -> Any {
            if let text { return text }
            return NSNull()
        }
        func isDone(_ raw: Any?) -> Bool {
            if let flag = raw as? Bool { return flag }
            return (raw as? Int) == 1
        }

        var body: [String: Any] = [
            "title": title,
            "content": (record["content"] as? String) ?? "",
            "startDate": start,
            "dueDate": value(record["due_date"] as? String),
            "completed": item.parentID == nil ? completed : isDone(record["completed"]),
            "deletedAt": NSNull(),
            "folder": value(record["folder"] as? String),
        ]
        if (record["type"] as? String) == "todo" {
            let children = (record["subTodos"] as? [[String: Any]]) ?? []
            body["subtasks"] = children.map { child -> [String: Any] in
                let childID = (child["id"] as? String) ?? ""
                let ticked = item.parentID != nil && childID == item.id
                return [
                    "id": childID,
                    "title": (child["title"] as? String) ?? "",
                    "completed": ticked ? completed : isDone(child["completed"]),
                    "content": (child["content"] as? String) ?? "",
                    "startDate": (child["start_date"] as? String) ?? start,
                    "dueDate": value(child["due_date"] as? String),
                ]
            }
        }

        var request = URLRequest(url: itemsURL.appendingPathComponent(recordID))
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (_, putResponse) = try await URLSession.shared.data(for: request)
        guard (putResponse as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
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
                        completed: $0.completed,
                        parentID: id
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
