import AppKit
import SwiftUI

extension Notification.Name {
    /// Posted by the menu bar item to ask the panel to reload its data.
    static let teoPanelRefresh = Notification.Name("teoPanelRefresh")
}

/// One item laid across the part of a week it covers.
private struct WeekSegment: Identifiable {
    let id: String
    let item: WidgetItem
    let col: Int
    let span: Int
    let lane: Int
    let head: Bool
    let tail: Bool
}

struct PanelCalendarView: View {
    @State private var month = Date()
    @State private var items: [WidgetItem] = []
    @State private var isLoading = false
    @State private var syncFailed = false
    @State private var lastSynced: Date?
    // Toggled from the menu bar item.
    @AppStorage("panelShowCompleted") private var showCompleted = true

    private let calendar = Calendar.current
    private let refreshSeconds: UInt64 = 60

    var body: some View {
        GeometryReader { proxy in
            let compact = proxy.size.width < 430
            VStack(alignment: .leading, spacing: compact ? 8 : 11) {
                header(compact: compact)
                weekdayRow(compact: compact)
                calendarGrid(compact: compact)
            }
            .padding(compact ? 14 : 20)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .overlay(alignment: .bottom) {
                if syncFailed {
                    syncBanner(compact: compact)
                        .padding(.bottom, compact ? 8 : 12)
                } else if let lastSynced {
                    Text("\(lastSynced.formatted(date: .omitted, time: .shortened)) 동기화 · 60초마다 갱신")
                        .font(.system(size: compact ? 8 : 9, weight: .medium, design: .rounded))
                        .foregroundStyle(Color(red: 0.36, green: 0.26, blue: 0.20).opacity(0.55))
                        .padding(.bottom, compact ? 5 : 8)
                }
            }
            .background(PanelVisualEffect())
            .background(Color.white.opacity(0.05))
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .stroke(Color.white.opacity(0.34), lineWidth: 1)
            }
            .shadow(color: Color.black.opacity(0.13), radius: 26, y: 14)
        }
        .task { await autoRefresh() }
        .onReceive(NotificationCenter.default.publisher(for: .teoPanelRefresh)) { _ in
            Task { await refresh() }
        }
    }

    private func header(compact: Bool) -> some View {
        HStack(spacing: 8) {
            Text(month, format: .dateTime.month(.wide).year())
                .font(.system(size: compact ? 18 : 23, weight: .bold, design: .rounded))
                .foregroundStyle(Color(red: 0.29, green: 0.20, blue: 0.15))
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Spacer(minLength: 5)
            Button("오늘") {
                month = Date()
            }
            .buttonStyle(PanelPillButtonStyle(compact: compact))
            Button("‹") {
                month = calendar.date(byAdding: .month, value: -1, to: month) ?? month
            }
            .buttonStyle(PanelIconButtonStyle(compact: compact))
            Button("›") {
                month = calendar.date(byAdding: .month, value: 1, to: month) ?? month
            }
            .buttonStyle(PanelIconButtonStyle(compact: compact))
            Button {
                Task { await refresh() }
            } label: {
                Image(systemName: isLoading ? "arrow.triangle.2.circlepath" : "arrow.clockwise")
                    .rotationEffect(.degrees(isLoading ? 180 : 0))
            }
            .buttonStyle(PanelIconButtonStyle(compact: compact))
            // The grip is part of this row, so it never covers the buttons.
            MoveHandle()
                .frame(width: compact ? 20 : 24, height: compact ? 22 : 26)
        }
    }

    private func syncBanner(compact: Bool) -> some View {
        Text(syncMessage)
            .font(.system(size: compact ? 9 : 10, weight: .semibold, design: .rounded))
            .foregroundStyle(Color(red: 0.29, green: 0.20, blue: 0.15))
            .padding(.horizontal, 9)
            .padding(.vertical, 3)
            .background(Color(red: 0.95, green: 0.87, blue: 0.72), in: Capsule())
    }

    private var syncMessage: String {
        guard let lastSynced else { return "연결 확인 필요 · 아직 불러오지 못했어요" }
        return "연결 확인 필요 · \(lastSynced.formatted(date: .omitted, time: .shortened)) 기준 데이터예요"
    }

    private func weekdayRow(compact: Bool) -> some View {
        LazyVGrid(columns: columns(spacing: compact ? 3 : 5), spacing: 0) {
            ForEach(["월", "화", "수", "목", "금", "토", "일"], id: \.self) { day in
                Text(day)
                    .font(.system(size: compact ? 9 : 10, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color(red: 0.44, green: 0.32, blue: 0.25).opacity(0.7))
                    .frame(maxWidth: .infinity)
            }
        }
    }

    // MARK: Month grid

    private var visibleItems: [WidgetItem] {
        showCompleted ? items : items.filter { !$0.completed }
    }

    private var weeks: [[Date?]] {
        let days = monthDays
        return stride(from: 0, to: days.count, by: 7).map { start in
            Array(days[start..<min(start + 7, days.count)])
        }
    }

    private func calendarGrid(compact: Bool) -> some View {
        let spacing: CGFloat = compact ? 3 : 5
        return VStack(spacing: spacing) {
            // Blank leading/trailing cells are nil, so identify weeks by position, not by value.
            ForEach(Array(weeks.enumerated()), id: \.offset) { _, week in
                weekRow(week, compact: compact, spacing: spacing)
            }
        }
    }

    private func weekRow(_ week: [Date?], compact: Bool, spacing: CGFloat) -> some View {
        let maxLanes = compact ? 2 : 3
        let barHeight: CGFloat = compact ? 10 : 12
        let laneStep = barHeight + 2
        let headHeight: CGFloat = compact ? 16 : 19
        let layout = layoutWeek(week, maxLanes: maxLanes)
        let rowHeight = headHeight + CGFloat(maxLanes) * laneStep + (compact ? 4 : 6)
        return GeometryReader { geo in
            let colWidth = (geo.size.width - spacing * 6) / 7
            ZStack(alignment: .topLeading) {
                HStack(spacing: spacing) {
                    ForEach(0..<7, id: \.self) { col in
                        dayCell(week[col], hidden: layout.hidden[col], compact: compact)
                    }
                }
                ForEach(layout.segments) { segment in
                    segmentView(segment, compact: compact)
                        .frame(
                            width: colWidth * CGFloat(segment.span) + spacing * CGFloat(segment.span - 1),
                            height: barHeight,
                            alignment: .leading
                        )
                        .offset(
                            x: (colWidth + spacing) * CGFloat(segment.col),
                            y: headHeight + CGFloat(segment.lane) * laneStep
                        )
                }
            }
        }
        .frame(height: rowHeight)
    }

    private func dayCell(_ day: Date?, hidden: Int, compact: Bool) -> some View {
        let isToday = day.map { calendar.isDate($0, inSameDayAs: Date()) } ?? false
        return ZStack(alignment: .topLeading) {
            RoundedRectangle(cornerRadius: 7, style: .continuous)
                .fill(Color.white.opacity(day == nil ? 0.0 : 0.22))
            if let day {
                Text(day, format: .dateTime.day())
                    .font(.system(size: compact ? 10 : 12, weight: isToday ? .bold : .medium, design: .rounded))
                    .foregroundStyle(isToday ? Color(red: 0.80, green: 0.17, blue: 0.14) : Color(red: 0.36, green: 0.26, blue: 0.20).opacity(0.9))
                    .padding(compact ? 4 : 6)
                if hidden > 0 {
                    Text("+\(hidden)")
                        .font(.system(size: compact ? 8 : 9, weight: .bold, design: .rounded))
                        .foregroundStyle(Color(red: 0.53, green: 0.36, blue: 0.26).opacity(0.85))
                        .padding(compact ? 4 : 6)
                        .frame(maxWidth: .infinity, alignment: .topTrailing)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .overlay {
            if isToday {
                RoundedRectangle(cornerRadius: 7, style: .continuous)
                    .stroke(Color(red: 0.80, green: 0.17, blue: 0.14).opacity(0.45), lineWidth: 1.2)
            }
        }
    }

    /// Items with a due date are bars; items without one are a dot and a title.
    private func segmentView(_ segment: WeekSegment, compact: Bool) -> some View {
        let base = segment.item.isTask
            ? Color(red: 0.31, green: 0.49, blue: 0.49)
            : Color(red: 0.78, green: 0.41, blue: 0.24)
        let hasDue = segment.item.dueDate != nil
        let corner: CGFloat = compact ? 5 : 6
        return HStack(spacing: 3) {
            if !hasDue {
                Circle().fill(base).frame(width: 5, height: 5)
            }
            Text(segment.item.title)
                .font(.system(size: compact ? 8 : 9, weight: .semibold, design: .rounded))
                .strikethrough(segment.item.completed)
                .lineLimit(1)
                .foregroundStyle(Color(red: 0.24, green: 0.17, blue: 0.13))
        }
        .padding(.horizontal, hasDue ? 5 : 1)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .background {
            if hasDue {
                UnevenRoundedRectangle(
                    cornerRadii: RectangleCornerRadii(
                        topLeading: segment.head ? corner : 0,
                        bottomLeading: segment.head ? corner : 0,
                        bottomTrailing: segment.tail ? corner : 0,
                        topTrailing: segment.tail ? corner : 0
                    ),
                    style: .continuous
                )
                .fill(base.opacity(0.26))
            }
        }
        .opacity(segment.item.completed ? 0.5 : 1)
    }

    /// Places every item that touches this week into lanes; what does not fit is counted per day.
    private func layoutWeek(_ week: [Date?], maxLanes: Int) -> (segments: [WeekSegment], hidden: [Int]) {
        let keys: [String?] = week.map { day in day.map { Self.key($0) } }
        let present = keys.compactMap { $0 }
        var hidden = Array(repeating: 0, count: 7)
        guard let first = present.first, let last = present.last else { return ([], hidden) }

        var candidates: [(item: WidgetItem, col: Int, span: Int, head: Bool, tail: Bool)] = []
        for item in visibleItems {
            let end = item.dueDate ?? item.startDate
            if item.startDate > last || end < first { continue }
            guard
                let startCol = keys.firstIndex(where: { $0 != nil && $0! >= item.startDate }),
                let endCol = keys.lastIndex(where: { $0 != nil && $0! <= end }),
                startCol <= endCol
            else { continue }
            candidates.append((item, startCol, endCol - startCol + 1, item.startDate >= first, end <= last))
        }
        candidates.sort { a, b in
            if a.col != b.col { return a.col < b.col }
            if a.span != b.span { return a.span > b.span }
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
        return (segments, hidden)
    }

    private var monthDays: [Date?] {
        let start = calendar.date(from: calendar.dateComponents([.year, .month], from: month)) ?? month
        let leading = (calendar.component(.weekday, from: start) + 5) % 7
        let count = calendar.range(of: .day, in: .month, for: start)?.count ?? 30
        var result = Array<Date?>(repeating: nil, count: leading)
        result += (1...count).compactMap { calendar.date(byAdding: .day, value: $0 - 1, to: start) }
        while result.count % 7 != 0 { result.append(nil) }
        return result
    }

    private func columns(spacing: CGFloat) -> [GridItem] {
        Array(repeating: GridItem(.flexible(), spacing: spacing), count: 7)
    }

    // MARK: Loading

    /// Loads now, then every minute while the panel is on screen.
    private func autoRefresh() async {
        while !Task.isCancelled {
            await refresh()
            try? await Task.sleep(nanoseconds: refreshSeconds * 1_000_000_000)
        }
    }

    private func refresh() async {
        guard !isLoading else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            items = try await WidgetData.fetch(includeCompleted: true)
            lastSynced = Date()
            syncFailed = false
            UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "panelLastSynced")
        } catch {
            // Keep whatever is already on screen and only flag the failure.
            syncFailed = true
        }
    }

    private static func key(_ date: Date) -> String {
        let parts = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }
}

struct PanelVisualEffect: NSViewRepresentable {
    func makeNSView(context: Context) -> NSVisualEffectView {
        let view = NSVisualEffectView()
        view.material = .hudWindow
        view.blendingMode = .behindWindow
        view.state = .active
        return view
    }

    func updateNSView(_ nsView: NSVisualEffectView, context: Context) {}
}

struct PanelPillButtonStyle: ButtonStyle {
    let compact: Bool
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: compact ? 9 : 10, weight: .semibold, design: .rounded))
            .foregroundStyle(Color(red: 0.42, green: 0.29, blue: 0.22))
            .padding(.horizontal, compact ? 7 : 9)
            .frame(minHeight: compact ? 22 : 26)
            .background(Color.white.opacity(configuration.isPressed ? 0.3 : 0.44), in: Capsule())
    }
}

struct PanelIconButtonStyle: ButtonStyle {
    let compact: Bool
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: compact ? 13 : 16, weight: .semibold, design: .rounded))
            .foregroundStyle(Color(red: 0.42, green: 0.29, blue: 0.22))
            .frame(width: compact ? 24 : 28, height: compact ? 22 : 26)
            .background(Color.white.opacity(configuration.isPressed ? 0.3 : 0.44), in: Capsule())
    }
}
