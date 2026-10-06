import Foundation

/// The words the widgets use for dates, so "오늘" and "내일" read the same at every size.
/// (The Android widget says the same things; see CalendarText.java.)
enum CalendarWords {
    /// Monday first, like every calendar in TEO.
    static let weekdays = ["월", "화", "수", "목", "금", "토", "일"]

    static func weekday(of date: Date, calendar: Calendar = .current) -> String {
        weekdays[(calendar.component(.weekday, from: date) + 5) % 7]
    }

    /// "2026-10-05" -> "10/5"
    static func short(_ key: String) -> String {
        let parts = key.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return key }
        return "\(parts[1])/\(parts[2])"
    }

    /// Open items that touch today or come later, soonest first. Whatever is already under way counts as today.
    static func upcoming(_ items: [CalendarItem], today: Date, calendar: Calendar = .current) -> [CalendarItem] {
        let todayKey = CalendarMonth.dayKey(today, calendar: calendar)
        return items
            .filter { !$0.completed && $0.endDate >= todayKey }
            .sorted { a, b in
                let first = max(a.startDate, todayKey)
                let second = max(b.startDate, todayKey)
                if first != second { return first < second }
                if a.endDate != b.endDate { return a.endDate < b.endDate }
                return a.title < b.title
            }
    }

    /// "오늘", "내일", "진행 중" or "10월 12일 (월)"; an item that lasts several days adds " → 10/15".
    static func when(_ item: CalendarItem, today: Date, calendar: Calendar = .current) -> String {
        let todayKey = CalendarMonth.dayKey(today, calendar: calendar)
        let tomorrow = calendar.date(byAdding: .day, value: 1, to: today) ?? today
        let start: String
        if item.startDate < todayKey {
            start = "진행 중"
        } else if item.startDate == todayKey {
            start = "오늘"
        } else if item.startDate == CalendarMonth.dayKey(tomorrow, calendar: calendar) {
            start = "내일"
        } else {
            let parts = item.startDate.split(separator: "-").compactMap { Int($0) }
            if parts.count == 3, let date = calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2])) {
                start = "\(parts[1])월 \(parts[2])일 (\(weekday(of: date, calendar: calendar)))"
            } else {
                start = item.startDate
            }
        }
        return item.endDate > item.startDate ? "\(start) → \(short(item.endDate))" : start
    }

    /// What VoiceOver says for the month: the date and what is open today.
    static func describe(_ items: [CalendarItem], today: Date, calendar: Calendar = .current) -> String {
        let parts = calendar.dateComponents([.month, .day], from: today)
        let todayKey = CalendarMonth.dayKey(today, calendar: calendar)
        let open = items.filter { !$0.completed && $0.startDate <= todayKey && todayKey <= $0.endDate }
        let head = "\(parts.month ?? 0)월 \(parts.day ?? 0)일 \(weekday(of: today, calendar: calendar))요일, TEO 캘린더. "
        if open.isEmpty { return head + "오늘 남은 일정이 없어요." }
        let names = open.prefix(5).map { $0.title }.joined(separator: ", ")
        let more = open.count > 5 ? " 외 \(open.count - 5)개" : ""
        return head + "오늘 일정 \(open.count)개: \(names)\(more)."
    }
}
