import SwiftUI
import WidgetKit

struct TEOEntry: TimelineEntry {
    let date: Date
    let items: [CalendarItem]
}

struct TEOProvider: TimelineProvider {
    func placeholder(in context: Context) -> TEOEntry {
        TEOEntry(date: Date(), items: [
            CalendarItem(id: "demo-1", type: "todo", title: "오늘의 할 일", startDate: CalendarMonth.dayKey(Date()), dueDate: nil, completed: false),
            CalendarItem(id: "demo-2", type: "task", title: "작은 Task", startDate: CalendarMonth.dayKey(Date()), dueDate: nil, completed: false),
        ])
    }

    func getSnapshot(in context: Context, completion: @escaping (TEOEntry) -> Void) {
        if context.isPreview {
            completion(placeholder(in: context))
        } else {
            Task { completion(TEOEntry(date: Date(), items: await TEOAPI.loadItemsOrEmpty())) }
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TEOEntry>) -> Void) {
        Task {
            do {
                let items = try await TEOAPI.fetchItems()
                let refresh = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date().addingTimeInterval(900)
                completion(Timeline(entries: [TEOEntry(date: Date(), items: items)], policy: .after(refresh)))
            } catch {
                // Retry soon instead of leaving an empty calendar for the full 15 minutes.
                let retry = Calendar.current.date(byAdding: .minute, value: 3, to: Date()) ?? Date().addingTimeInterval(180)
                completion(Timeline(entries: [TEOEntry(date: Date(), items: [])], policy: .after(retry)))
            }
        }
    }
}

struct TEOFlowWidget: Widget {
    let kind = "TEOFlowCalendar"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TEOProvider()) { entry in
            CalendarWidgetView(entry: entry)
                .widgetURL(URL(string: "teoflow://calendar"))
        }
        .configurationDisplayName("TEO 캘린더")
        .description("월간 달력과 다가오는 Todo, Task를 한눈에 확인하세요.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .systemExtraLarge])
    }
}

@main
struct TEOFlowWidgetBundle: WidgetBundle {
    var body: some Widget {
        TEOFlowWidget()
    }
}

/// Small and medium show the month as dots; large and extra large write titles in the days.
/// Medium and above add what is coming next, and extra large puts it beside the month like the Fold widget.
struct CalendarWidgetView: View {
    let entry: TEOEntry
    @Environment(\.widgetFamily) private var family

    private let calendar = Calendar.current

    private var showsTitles: Bool { family == .systemLarge || family == .systemExtraLarge }

    var body: some View {
        content
            .padding(family == .systemSmall ? 10 : 14)
            .containerBackground(for: .widget) {
                Color.white
            }
    }

    @ViewBuilder
    private var content: some View {
        switch family {
        case .systemSmall:
            month(spacing: 6)
        case .systemMedium:
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    agenda(limit: 2)
                    Spacer(minLength: 0)
                    quickLinks
                }
                .frame(maxWidth: .infinity, alignment: .topLeading)
                month(spacing: 4)
                    .frame(maxWidth: .infinity)
            }
        case .systemLarge:
            VStack(alignment: .leading, spacing: 8) {
                month(spacing: 8)
                quickLinks
                todayLine
            }
        default:
            HStack(alignment: .top, spacing: 18) {
                month(spacing: 8)
                    .frame(maxWidth: .infinity)
                VStack(alignment: .leading, spacing: 10) {
                    quickLinks
                    agenda(limit: 6)
                    Spacer(minLength: 0)
                }
                .frame(maxWidth: .infinity, alignment: .topLeading)
            }
        }
    }

    // MARK: Month

    private func month(spacing: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: spacing) {
            header
            weekdayRow
            calendarGrid
        }
    }

    private var header: some View {
        let parts = calendar.dateComponents([.year, .month], from: entry.date)
        return HStack(alignment: .firstTextBaseline) {
            // verbatim: a plain Text would format the year as "2,026".
            Text(verbatim: "\(parts.year ?? 0)년 \(parts.month ?? 0)월")
                .font(.system(size: family == .systemSmall || family == .systemMedium ? 13 : 16, weight: .bold, design: .rounded))
                .foregroundStyle(TEOPalette.ink)
            Spacer(minLength: 4)
            Text("TEO")
                .font(.system(size: 9, weight: .bold, design: .rounded))
                .tracking(1.2)
                .foregroundStyle(TEOPalette.muted.opacity(0.72))
        }
    }

    private var weekdayRow: some View {
        HStack(spacing: gap) {
            // Index-based ids: the labels are unique now, but a position can never repeat.
            ForEach(Array(CalendarWords.weekdays.enumerated()), id: \.offset) { index, day in
                Text(day)
                    .font(.system(size: 9, weight: .semibold, design: .rounded))
                    .foregroundStyle(index == 6 ? TEOPalette.today.opacity(0.8) : TEOPalette.muted.opacity(0.75))
                    .frame(maxWidth: .infinity)
            }
        }
    }

    private var gap: CGFloat { family == .systemSmall || family == .systemMedium ? 2 : 3 }

    /// The weeks share whatever height the widget has left, so a six-week month always fits;
    /// each day then shows as much as its cell can hold (titles, or just a few dots).
    private var calendarGrid: some View {
        let weeks = CalendarMonth.weeks(of: entry.date)
        return GeometryReader { geo in
            let rows = CGFloat(weeks.count)
            let rowHeight = max(10, (geo.size.height - gap * (rows - 1)) / rows)
            VStack(spacing: gap) {
                ForEach(Array(weeks.enumerated()), id: \.offset) { _, week in
                    HStack(spacing: gap) {
                        // Blank leading/trailing cells are nil, so identify columns by position.
                        ForEach(0..<7, id: \.self) { col in
                            dayCell(week[col], height: rowHeight)
                        }
                    }
                    .frame(height: rowHeight)
                }
            }
        }
        .frame(maxHeight: .infinity)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(CalendarWords.describe(entry.items, today: entry.date))
    }

    private func dayCell(_ day: Date?, height: CGFloat) -> some View {
        let key = day.map { CalendarMonth.dayKey($0) }
        let dayItems = entry.items.filter { item in
            guard let key else { return false }
            return item.startDate <= key && key <= item.endDate
        }
        let isToday = day.map { calendar.isDate($0, inSameDayAs: entry.date) } ?? false
        let numberSize: CGFloat = showsTitles ? 10 : 8.5
        // Room under the number: whole title lines in the big widgets, otherwise a few dots at the bottom edge.
        let titleLines = showsTitles ? min(3, max(0, Int((height - 5 - (numberSize + 3)) / 10))) : 0
        return VStack(alignment: .leading, spacing: 1) {
            HStack(spacing: 0) {
                if let day {
                    Text(verbatim: String(calendar.component(.day, from: day)))
                        .font(.system(size: numberSize, weight: isToday ? .bold : .medium, design: .rounded))
                        .foregroundStyle(isToday ? TEOPalette.today : TEOPalette.inkSoft.opacity(0.85))
                }
                Spacer(minLength: 0)
                if titleLines > 0 && dayItems.count > titleLines {
                    Text("+\(dayItems.count - titleLines)")
                        .font(.system(size: 7, weight: .bold, design: .rounded))
                        .foregroundStyle(TEOPalette.accent.opacity(0.8))
                }
            }
            ForEach(Array(dayItems.prefix(titleLines)), id: \.id) { item in
                HStack(spacing: 2) {
                    Circle().fill(TEOPalette.color(for: item)).frame(width: 3, height: 3)
                    Text(item.title)
                        .font(.system(size: 7.5, weight: .medium, design: .rounded))
                        .lineLimit(1)
                        .foregroundStyle(TEOPalette.inkSoft.opacity(0.9))
                }
            }
            Spacer(minLength: 0)
        }
        .padding(2.5)
        .frame(maxWidth: .infinity, minHeight: height, maxHeight: height, alignment: .topLeading)
        .background {
            RoundedRectangle(cornerRadius: 5, style: .continuous)
                .fill(TEOPalette.ink.opacity(dayItems.isEmpty ? 0.045 : 0.09))
        }
        .overlay(alignment: .bottom) {
            if titleLines == 0 && !dayItems.isEmpty {
                HStack(spacing: 2) {
                    ForEach(Array(dayItems.prefix(3)), id: \.id) { item in
                        Circle().fill(TEOPalette.color(for: item)).frame(width: 3, height: 3)
                    }
                }
                .padding(.bottom, 1.5)
            }
        }
        .overlay(alignment: .bottomLeading) {
            if dayItems.contains(where: { $0.dueDate != nil && $0.dueDate != $0.startDate }) {
                Rectangle().fill(TEOPalette.todo.opacity(0.55)).frame(height: 1.5)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 5, style: .continuous))
    }

    // MARK: Agenda and links

    /// What is coming next, with the date in words; the same wording as the Android widget.
    private func agenda(limit: Int) -> some View {
        let all = CalendarWords.upcoming(entry.items, today: entry.date)
        return VStack(alignment: .leading, spacing: 5) {
            Text("다가오는 일정")
                .font(.system(size: 9, weight: .bold, design: .rounded))
                .tracking(0.6)
                .foregroundStyle(TEOPalette.muted.opacity(0.8))
            if all.isEmpty {
                Text("예정된 일정이 없어요")
                    .font(.system(size: 11, weight: .medium, design: .rounded))
                    .foregroundStyle(TEOPalette.muted)
            } else {
                ForEach(Array(all.prefix(limit)), id: \.id) { item in
                    agendaRow(item)
                }
                if all.count > limit {
                    Text("외 \(all.count - limit)개")
                        .font(.system(size: 9, weight: .medium, design: .rounded))
                        .foregroundStyle(TEOPalette.muted)
                }
            }
        }
    }

    private func agendaRow(_ item: CalendarItem) -> some View {
        HStack(alignment: .top, spacing: 6) {
            Circle()
                .fill(TEOPalette.color(for: item))
                .frame(width: 6, height: 6)
                .padding(.top, 4)
            VStack(alignment: .leading, spacing: 1) {
                Text(item.title)
                    .font(.system(size: 11, weight: .semibold, design: .rounded))
                    .foregroundStyle(TEOPalette.ink)
                    .lineLimit(1)
                Text(CalendarWords.when(item, today: entry.date))
                    .font(.system(size: 9, weight: .medium, design: .rounded))
                    .foregroundStyle(TEOPalette.muted)
                    .lineLimit(1)
            }
        }
    }

    private var todayLine: some View {
        Text(CalendarWords.todaySummary(entry.items, today: entry.date))
            .font(.system(size: 10, weight: .semibold, design: .rounded))
            .foregroundStyle(TEOPalette.muted)
            .lineLimit(1)
    }

    // WidgetKit only supports Link in medium and larger widgets; small ones just open the calendar.
    private var quickLinks: some View {
        HStack(spacing: 5) {
            quickLink(title: "NOTE", systemName: "note.text", mode: "note")
            quickLink(title: "TASK", systemName: "checkmark.square", mode: "task")
            quickLink(title: "TODO", systemName: "list.bullet", mode: "todo")
            quickLink(title: "＋", systemName: "plus", mode: "new-note")
        }
        .frame(maxWidth: .infinity)
    }

    private func quickLink(title: String, systemName: String, mode: String) -> some View {
        Link(destination: URL(string: "teoflow://\(mode)")!) {
            HStack(spacing: 3) {
                Image(systemName: systemName)
                    .font(.system(size: 8, weight: .semibold))
                Text(title)
                    .font(.system(size: 8, weight: .bold, design: .rounded))
                    .tracking(0.4)
            }
            .foregroundStyle(TEOPalette.ink.opacity(0.9))
            .frame(maxWidth: .infinity, minHeight: 22)
            .background(TEOPalette.ink.opacity(0.06), in: RoundedRectangle(cornerRadius: 7, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 7, style: .continuous)
                    .stroke(TEOPalette.ink.opacity(0.1), lineWidth: 0.7)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title == "＋" ? "새 노트 쓰기" : "\(title) 열기")
    }
}
