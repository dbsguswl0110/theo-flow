import SwiftUI

/// Sizes for the panel's two widths. Every measurement in the calendar comes from here.
private struct PanelMetrics {
    let compact: Bool

    var padding: CGFloat { compact ? 14 : 20 }
    var stackSpacing: CGFloat { compact ? 8 : 11 }
    /// Gap between day cells, in both directions.
    var gap: CGFloat { compact ? 3 : 5 }
    var monthFont: CGFloat { compact ? 18 : 23 }
    var weekdayFont: CGFloat { compact ? 9 : 10 }
    var dayFont: CGFloat { compact ? 10 : 12 }
    var smallFont: CGFloat { compact ? 8 : 9 }
    var cellInset: CGFloat { compact ? 4 : 6 }
    /// Room for the day number above the bars.
    var headHeight: CGFloat { compact ? 16 : 19 }
    var barHeight: CGFloat { compact ? 10 : 12 }
    var barCorner: CGFloat { compact ? 5 : 6 }
    var laneStep: CGFloat { barHeight + 2 }
    var rowBottom: CGFloat { compact ? 4 : 6 }
    var grip: CGSize { compact ? CGSize(width: 20, height: 22) : CGSize(width: 24, height: 26) }
}

struct PanelCalendarView: View {
    @StateObject private var store = PanelStore()
    @State private var month = Date()
    // Toggled from the menu bar item.
    @AppStorage(PanelPreferences.showCompletedKey) private var showCompleted = true

    private let calendar = Calendar.current

    var body: some View {
        GeometryReader { proxy in
            let m = PanelMetrics(compact: proxy.size.width < 430)
            VStack(alignment: .leading, spacing: m.stackSpacing) {
                header(m)
                weekdayRow(m)
                calendarGrid(m)
            }
            .padding(m.padding)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .overlay(alignment: .bottom) { footer(m) }
            .background(PanelVisualEffect())
            .background(Color.white.opacity(0.05))
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .stroke(Color.white.opacity(0.34), lineWidth: 1)
            }
            .shadow(color: Color.black.opacity(0.13), radius: 26, y: 14)
        }
        .task { await store.autoRefresh() }
        .onReceive(NotificationCenter.default.publisher(for: .teoPanelRefresh)) { _ in
            Task { await store.refresh() }
        }
    }

    // MARK: Header and footer

    private func header(_ m: PanelMetrics) -> some View {
        HStack(spacing: 8) {
            Text(month, format: .dateTime.month(.wide).year())
                .font(.system(size: m.monthFont, weight: .bold, design: .rounded))
                .foregroundStyle(TEOPalette.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Spacer(minLength: 5)
            Button("오늘") {
                month = Date()
            }
            .buttonStyle(PanelPillButtonStyle(compact: m.compact))
            Button("‹") {
                month = calendar.date(byAdding: .month, value: -1, to: month) ?? month
            }
            .buttonStyle(PanelIconButtonStyle(compact: m.compact))
            Button("›") {
                month = calendar.date(byAdding: .month, value: 1, to: month) ?? month
            }
            .buttonStyle(PanelIconButtonStyle(compact: m.compact))
            Button {
                Task { await store.refresh() }
            } label: {
                Image(systemName: store.isLoading ? "arrow.triangle.2.circlepath" : "arrow.clockwise")
                    .rotationEffect(.degrees(store.isLoading ? 180 : 0))
            }
            .buttonStyle(PanelIconButtonStyle(compact: m.compact))
            // The grip is part of this row, so it never covers the buttons.
            MoveHandle()
                .frame(width: m.grip.width, height: m.grip.height)
        }
    }

    @ViewBuilder
    private func footer(_ m: PanelMetrics) -> some View {
        if store.syncFailed {
            Text(syncMessage)
                .font(.system(size: m.compact ? 9 : 10, weight: .semibold, design: .rounded))
                .foregroundStyle(TEOPalette.ink)
                .padding(.horizontal, 9)
                .padding(.vertical, 3)
                .background(Color(red: 0.95, green: 0.87, blue: 0.72), in: Capsule())
                .padding(.bottom, m.compact ? 8 : 12)
        } else if let lastSynced = store.lastSynced {
            Text("\(lastSynced.formatted(date: .omitted, time: .shortened)) 동기화 · 60초마다 갱신")
                .font(.system(size: m.smallFont, weight: .medium, design: .rounded))
                .foregroundStyle(TEOPalette.inkSoft.opacity(0.55))
                .padding(.bottom, m.compact ? 5 : 8)
        }
    }

    private var syncMessage: String {
        guard let lastSynced = store.lastSynced else { return "연결 확인 필요 · 아직 불러오지 못했어요" }
        return "연결 확인 필요 · \(lastSynced.formatted(date: .omitted, time: .shortened)) 기준 데이터예요"
    }

    // MARK: Month grid

    private func weekdayRow(_ m: PanelMetrics) -> some View {
        HStack(spacing: m.gap) {
            ForEach(["월", "화", "수", "목", "금", "토", "일"], id: \.self) { day in
                Text(day)
                    .font(.system(size: m.weekdayFont, weight: .semibold, design: .rounded))
                    .foregroundStyle(TEOPalette.muted.opacity(0.7))
                    .frame(maxWidth: .infinity)
            }
        }
    }

    private var visibleItems: [CalendarItem] {
        showCompleted ? store.items : store.items.filter { !$0.completed }
    }

    /// The weeks share the height that is left, so a six-week month never runs off the window;
    /// the taller the panel, the more bars fit under each day number.
    private func calendarGrid(_ m: PanelMetrics) -> some View {
        let weeks = CalendarMonth.weeks(of: month, calendar: calendar)
        return GeometryReader { geo in
            let rows = CGFloat(weeks.count)
            let rowHeight = max(1, (geo.size.height - m.gap * (rows - 1)) / rows)
            let maxLanes = max(1, Int((rowHeight - m.headHeight - m.rowBottom) / m.laneStep))
            VStack(spacing: m.gap) {
                // Blank leading and trailing cells are nil, so identify weeks by position, not by value.
                ForEach(Array(weeks.enumerated()), id: \.offset) { _, week in
                    weekRow(week, maxLanes: maxLanes, m)
                        .frame(height: rowHeight)
                }
            }
        }
    }

    private func weekRow(_ week: [Date?], maxLanes: Int, _ m: PanelMetrics) -> some View {
        let layout = WeekLayout(week: week, items: visibleItems, maxLanes: maxLanes, calendar: calendar)
        return GeometryReader { geo in
            let columnWidth = (geo.size.width - m.gap * 6) / 7
            ZStack(alignment: .topLeading) {
                HStack(spacing: m.gap) {
                    ForEach(0..<7, id: \.self) { col in
                        dayCell(week[col], hidden: layout.hidden[col], m)
                    }
                }
                ForEach(layout.segments) { segment in
                    segmentView(segment, m)
                        .frame(
                            width: columnWidth * CGFloat(segment.span) + m.gap * CGFloat(segment.span - 1),
                            height: m.barHeight,
                            alignment: .leading
                        )
                        .offset(
                            x: (columnWidth + m.gap) * CGFloat(segment.col),
                            y: m.headHeight + CGFloat(segment.lane) * m.laneStep
                        )
                }
            }
        }
    }

    private func dayCell(_ day: Date?, hidden: Int, _ m: PanelMetrics) -> some View {
        let isToday = day.map { calendar.isDate($0, inSameDayAs: Date()) } ?? false
        return ZStack(alignment: .topLeading) {
            RoundedRectangle(cornerRadius: 7, style: .continuous)
                .fill(Color.white.opacity(day == nil ? 0.0 : 0.22))
            if let day {
                Text(day, format: .dateTime.day())
                    .font(.system(size: m.dayFont, weight: isToday ? .bold : .medium, design: .rounded))
                    .foregroundStyle(isToday ? TEOPalette.today : TEOPalette.inkSoft.opacity(0.9))
                    .padding(m.cellInset)
                if hidden > 0 {
                    Text("+\(hidden)")
                        .font(.system(size: m.smallFont, weight: .bold, design: .rounded))
                        .foregroundStyle(TEOPalette.accent.opacity(0.85))
                        .padding(m.cellInset)
                        .frame(maxWidth: .infinity, alignment: .topTrailing)
                }
            }
        }
        // Today is only a bold red number, the same quiet mark as the web calendar; no box around the cell.
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    /// Items with a due date are bars; items without one are a dot and a title.
    private func segmentView(_ segment: WeekSegment, _ m: PanelMetrics) -> some View {
        let color = TEOPalette.color(for: segment.item)
        let hasDue = segment.item.dueDate != nil
        return HStack(spacing: 3) {
            if !hasDue {
                Circle().fill(color).frame(width: 5, height: 5)
            }
            Text(segment.item.title)
                .font(.system(size: m.smallFont, weight: .semibold, design: .rounded))
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
                        topLeading: segment.head ? m.barCorner : 0,
                        bottomLeading: segment.head ? m.barCorner : 0,
                        bottomTrailing: segment.tail ? m.barCorner : 0,
                        topTrailing: segment.tail ? m.barCorner : 0
                    ),
                    style: .continuous
                )
                .fill(color.opacity(0.26))
            }
        }
        .opacity(segment.item.completed ? 0.5 : 1)
    }
}
