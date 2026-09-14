import SwiftUI
import WidgetKit

struct TEOEntry: TimelineEntry {
    let date: Date
    let items: [WidgetItem]
}

struct TEOProvider: TimelineProvider {
    func placeholder(in context: Context) -> TEOEntry {
        TEOEntry(date: Date(), items: [
            WidgetItem(id: "demo-1", type: "todo", title: "오늘의 할 일", startDate: Self.key(Date()), dueDate: nil, completed: false),
            WidgetItem(id: "demo-2", type: "task", title: "작은 Task", startDate: Self.key(Date()), dueDate: nil, completed: false),
        ])
    }

    func getSnapshot(in context: Context, completion: @escaping (TEOEntry) -> Void) {
        if context.isPreview {
            completion(placeholder(in: context))
        } else {
            Task { completion(TEOEntry(date: Date(), items: await WidgetData.load())) }
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TEOEntry>) -> Void) {
        Task {
            let items = await WidgetData.load()
            let refresh = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date().addingTimeInterval(900)
            completion(Timeline(entries: [TEOEntry(date: Date(), items: items)], policy: .after(refresh)))
        }
    }

    private static func key(_ date: Date) -> String {
        let parts = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }
}

struct TEOFlowWidget: Widget {
    let kind = "TEOFlowCalendar"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TEOProvider()) { entry in
            CalendarWidgetView(entry: entry)
                .widgetURL(URL(string: "teoflow://calendar"))
        }
        .configurationDisplayName("TEO Calendar")
        .description("투명한 캘린더에서 오늘의 Todo와 Task를 확인하세요.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

@main
struct TEOFlowWidgetBundle: WidgetBundle {
    var body: some Widget {
        TEOFlowWidget()
    }
}

struct CalendarWidgetView: View {
    let entry: TEOEntry
    @Environment(\.widgetFamily) private var family

    private let calendar = Calendar.current
    private let weekdaySymbols = ["M", "T", "W", "T", "F", "S", "S"]

    var body: some View {
        VStack(alignment: .leading, spacing: family == .systemSmall ? 6 : 8) {
            header
            weekdayRow
            calendarGrid
            if family == .systemLarge {
                agenda
            }
        }
        .padding(family == .systemSmall ? 10 : 14)
        .containerBackground(for: .widget) {
            ZStack {
                Color(red: 0.96, green: 0.91, blue: 0.86).opacity(0.72)
                Rectangle().fill(.ultraThinMaterial).opacity(0.78)
            }
        }
        .overlay {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(Color.white.opacity(0.62), lineWidth: 1)
        }
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(entry.date, format: .dateTime.month(.wide).year())
                .font(.system(size: family == .systemSmall ? 13 : 16, weight: .bold, design: .rounded))
                .foregroundStyle(Color(red: 0.32, green: 0.22, blue: 0.17))
            Spacer(minLength: 4)
            Text("TEO")
                .font(.system(size: 9, weight: .bold, design: .rounded))
                .tracking(1.2)
                .foregroundStyle(Color(red: 0.46, green: 0.32, blue: 0.25).opacity(0.72))
        }
    }

    private var weekdayRow: some View {
        LazyVGrid(columns: columns, spacing: 0) {
            ForEach(weekdaySymbols, id: \.self) { day in
                Text(day)
                    .font(.system(size: 8, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color(red: 0.46, green: 0.34, blue: 0.28).opacity(0.7))
                    .frame(maxWidth: .infinity)
            }
        }
    }

    private var calendarGrid: some View {
        LazyVGrid(columns: columns, spacing: family == .systemSmall ? 2 : 3) {
            ForEach(monthDays, id: \.self) { day in
                dayCell(day)
            }
        }
    }

    private func dayCell(_ day: Date?) -> some View {
        let dayItems = entry.items.filter { item in
            guard let day else { return false }
            let start = item.startDate
            let end = item.dueDate ?? start
            return start <= Self.key(day) && Self.key(day) <= end
        }
        let isToday = day.map { calendar.isDate($0, inSameDayAs: entry.date) } ?? false
        return VStack(alignment: .leading, spacing: 2) {
            if let day {
                Text(day, format: .dateTime.day())
                    .font(.system(size: family == .systemSmall ? 8 : 9, weight: isToday ? .bold : .medium, design: .rounded))
                    .foregroundStyle(isToday ? Color(red: 0.78, green: 0.18, blue: 0.15) : Color(red: 0.40, green: 0.29, blue: 0.23).opacity(0.82))
            } else {
                Color.clear.frame(height: family == .systemSmall ? 9 : 10)
            }
            if family == .systemSmall {
                HStack(spacing: 2) {
                    ForEach(Array(dayItems.prefix(3)), id: \.id) { item in
                        Circle().fill(color(for: item)).frame(width: 3, height: 3)
                    }
                }
            } else {
                VStack(alignment: .leading, spacing: 1) {
                    ForEach(Array(dayItems.prefix(family == .systemLarge ? 2 : 1)), id: \.id) { item in
                        HStack(spacing: 2) {
                            Circle().fill(color(for: item)).frame(width: 3, height: 3)
                            Text(item.title)
                                .font(.system(size: family == .systemLarge ? 7 : 6, weight: .medium, design: .rounded))
                                .lineLimit(1)
                                .foregroundStyle(Color(red: 0.35, green: 0.25, blue: 0.20).opacity(0.88))
                        }
                    }
                    if dayItems.count > (family == .systemLarge ? 2 : 1) {
                        Text("+\(dayItems.count - (family == .systemLarge ? 2 : 1))")
                            .font(.system(size: 6, weight: .bold, design: .rounded))
                            .foregroundStyle(Color(red: 0.50, green: 0.34, blue: 0.25).opacity(0.75))
                    }
                }
            }
            Spacer(minLength: 0)
        }
        .padding(3)
        .frame(maxWidth: .infinity, minHeight: family == .systemSmall ? 19 : (family == .systemLarge ? 38 : 27), alignment: .topLeading)
        .background {
            RoundedRectangle(cornerRadius: 5, style: .continuous)
                .fill(Color.white.opacity(dayItems.isEmpty ? 0.16 : 0.30))
        }
        .overlay(alignment: .bottomLeading) {
            if dayItems.contains(where: { $0.dueDate != nil && $0.dueDate != $0.startDate }) {
                Rectangle().fill(Color(red: 0.72, green: 0.45, blue: 0.30).opacity(0.65)).frame(height: 1.5)
            }
        }
    }

    private var agenda: some View {
        VStack(alignment: .leading, spacing: 4) {
            Divider().overlay(Color.white.opacity(0.55))
            Text("UP NEXT")
                .font(.system(size: 8, weight: .bold, design: .rounded))
                .tracking(1.2)
                .foregroundStyle(Color(red: 0.46, green: 0.32, blue: 0.25).opacity(0.72))
            ForEach(Array(entry.items.sorted { $0.startDate < $1.startDate }.prefix(3)), id: \.id) { item in
                HStack(spacing: 5) {
                    Circle().fill(color(for: item)).frame(width: 5, height: 5)
                    Text(item.title).font(.system(size: 9, weight: .medium, design: .rounded)).lineLimit(1)
                    Spacer(minLength: 2)
                    Text(item.startDate).font(.system(size: 7, design: .rounded)).foregroundStyle(.secondary)
                }
            }
        }
    }

    private var columns: [GridItem] {
        Array(repeating: GridItem(.flexible(), spacing: family == .systemSmall ? 2 : 3), count: 7)
    }

    private var monthDays: [Date?] {
        let start = calendar.date(from: calendar.dateComponents([.year, .month], from: entry.date)) ?? entry.date
        let weekday = (calendar.component(.weekday, from: start) + 5) % 7
        let count = calendar.range(of: .day, in: .month, for: start)?.count ?? 30
        var result = Array<Date?>(repeating: nil, count: weekday)
        result += (1...count).compactMap { calendar.date(byAdding: .day, value: $0 - 1, to: start) }
        while result.count % 7 != 0 { result.append(nil) }
        return result
    }

    private func color(for item: WidgetItem) -> Color {
        item.isTask ? Color(red: 0.36, green: 0.52, blue: 0.52) : Color(red: 0.78, green: 0.42, blue: 0.25)
    }

    private static func key(_ date: Date) -> String {
        let parts = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }
}
