import Foundation

/// Month and week arithmetic shared by the widget and the panel. Weeks start on Monday.
enum CalendarMonth {
    /// "2026-10-05": the string form the server uses for dates, in the user's time zone.
    static func dayKey(_ date: Date, calendar: Calendar = .current) -> String {
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }

    /// Every day of the month containing `date`. Leading and trailing `nil`s pad the first and last week,
    /// so the count is always a multiple of seven and the first day sits in its Monday-first column.
    static func days(of date: Date, calendar: Calendar = .current) -> [Date?] {
        let start = calendar.date(from: calendar.dateComponents([.year, .month], from: date)) ?? date
        let leading = (calendar.component(.weekday, from: start) + 5) % 7
        let count = calendar.range(of: .day, in: .month, for: start)?.count ?? 30
        var result = [Date?](repeating: nil, count: leading)
        result += (1...count).compactMap { calendar.date(byAdding: .day, value: $0 - 1, to: start) }
        while result.count % 7 != 0 { result.append(nil) }
        return result
    }

    /// The same days, split into rows of seven.
    static func weeks(of date: Date, calendar: Calendar = .current) -> [[Date?]] {
        let flat = days(of: date, calendar: calendar)
        return stride(from: 0, to: flat.count, by: 7).map { Array(flat[$0..<($0 + 7)]) }
    }
}

/// One item laid across the part of a week it covers.
struct WeekSegment: Identifiable {
    let id: String
    let item: CalendarItem
    /// First column covered, 0 = Monday.
    let col: Int
    let span: Int
    /// Row under the day numbers, 0 = closest to them.
    let lane: Int
    /// The item starts in this week (its left end is rounded).
    let head: Bool
    /// The item ends in this week (its right end is rounded).
    let tail: Bool
}

/// Places every item that touches a week into lanes, the same way the web calendar does:
/// longer items first, then earlier columns; whatever does not fit in `maxLanes` is counted per day.
struct WeekLayout {
    let segments: [WeekSegment]
    /// Per column, how many items did not fit.
    let hidden: [Int]

    /// Lanes that actually hold a bar.
    var laneCount: Int { (segments.map { $0.lane }.max() ?? -1) + 1 }

    private struct Candidate {
        let item: CalendarItem
        let col: Int
        let span: Int
        let head: Bool
        let tail: Bool
    }

    init(week: [Date?], items: [CalendarItem], maxLanes: Int, calendar: Calendar = .current) {
        let keys: [String?] = week.map { day in day.map { CalendarMonth.dayKey($0, calendar: calendar) } }
        let present = keys.compactMap { $0 }
        var hidden = [Int](repeating: 0, count: week.count)
        guard let first = present.first, let last = present.last else {
            self.segments = []
            self.hidden = hidden
            return
        }

        var candidates: [Candidate] = []
        for item in items {
            let end = item.endDate
            if item.startDate > last || end < first { continue }
            guard
                let startCol = keys.firstIndex(where: { $0 != nil && $0! >= item.startDate }),
                let endCol = keys.lastIndex(where: { $0 != nil && $0! <= end }),
                startCol <= endCol
            else { continue }
            candidates.append(
                Candidate(item: item, col: startCol, span: endCol - startCol + 1, head: item.startDate >= first, tail: end <= last)
            )
        }
        candidates.sort { a, b in
            if a.col != b.col { return a.col < b.col }
            if a.span != b.span { return a.span > b.span }
            if a.item.type != b.item.type { return a.item.type < b.item.type }
            return a.item.title < b.item.title
        }

        var laneEnds: [Int] = []
        var segments: [WeekSegment] = []
        for candidate in candidates {
            let lastCol = candidate.col + candidate.span - 1
            var lane = laneEnds.firstIndex(where: { $0 < candidate.col }) ?? -1
            if lane == -1 {
                lane = laneEnds.count
                laneEnds.append(lastCol)
            } else {
                laneEnds[lane] = lastCol
            }
            if lane >= maxLanes {
                for col in candidate.col...lastCol { hidden[col] += 1 }
            } else {
                segments.append(
                    WeekSegment(
                        id: "\(candidate.item.id)-\(candidate.col)",
                        item: candidate.item,
                        col: candidate.col,
                        span: candidate.span,
                        lane: lane,
                        head: candidate.head,
                        tail: candidate.tail
                    )
                )
            }
        }
        self.segments = segments
        self.hidden = hidden
    }
}
