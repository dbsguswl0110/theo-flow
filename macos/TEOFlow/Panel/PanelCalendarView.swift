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
    /// Room for the day number above the bars: its line, the inset above it and a hair of air.
    var headHeight: CGFloat { dayFont * 1.2 + cellInset + 2 }
    var barHeight: CGFloat { compact ? 10 : 12 }
    var barCorner: CGFloat { compact ? 5 : 6 }
    var laneStep: CGFloat { barHeight + 2 }
    var rowBottom: CGFloat { compact ? 4 : 6 }
    /// The least height the calendar can have: weekday labels and six rows that still show their day numbers.
    var minCalendarHeight: CGFloat { weekdayFont * 1.3 + stackSpacing + 6 * headHeight + 5 * gap }
    /// The least height the checklist can have: its title and about two rows.
    var minChecklistHeight: CGFloat { 72 }
    var handleHeight: CGFloat { 16 }
    var grip: CGSize { compact ? CGSize(width: 20, height: 22) : CGSize(width: 24, height: 26) }
}

struct PanelCalendarView: View {
    @StateObject private var store = PanelStore()
    @State private var month = Date()
    // Toggled from the menu bar item.
    @AppStorage(PanelPreferences.showCompletedKey) private var showCompleted = true
    @AppStorage(PanelPreferences.showChecklistKey) private var showChecklist = true
    @AppStorage(PanelPreferences.calendarShareKey) private var calendarShare = PanelPreferences.defaultCalendarShare
    @AppStorage(PanelPreferences.plateOpacityKey) private var plateOpacity = PanelPreferences.defaultPlateOpacity

    private let calendar = Calendar.current

    var body: some View {
        GeometryReader { proxy in
            let m = PanelMetrics(compact: proxy.size.width < 430)
            VStack(alignment: .leading, spacing: m.stackSpacing) {
                header(m)
                sections(m)
            }
            .padding(m.padding)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .overlay(alignment: .bottom) { footer(m) }
            .background {
                ZStack {
                    PanelVisualEffect()
                    // A light plate over the blur so the brown text reads on a dark or vivid wallpaper too.
                    // How solid it is can be chosen in the menu bar menu (clear, normal, solid).
                    Color(red: 0.995, green: 0.985, blue: 0.965).opacity(plateOpacity)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .stroke(Color(red: 0.42, green: 0.30, blue: 0.22).opacity(0.16), lineWidth: 1)
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
            // Written out so the title is Korean whatever language the Mac is set to, like the widget and the app.
            // verbatim: a plain Text would format the year as "2,026".
            Text(verbatim: "\(calendar.component(.year, from: month))년 \(calendar.component(.month, from: month))월")
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

    /// The calendar on top and, under a draggable divider, the checklist. The share is remembered between launches.
    private func sections(_ m: PanelMetrics) -> some View {
        GeometryReader { geo in
            let handle = showChecklist ? m.handleHeight : 0
            let usable = max(1, geo.size.height - handle)
            let low = Double(min(m.minCalendarHeight, usable) / usable)
            let high = max(low, Double((usable - m.minChecklistHeight) / usable))
            let share = showChecklist ? min(max(calendarShare, low), high) : 1.0
            VStack(spacing: 0) {
                VStack(alignment: .leading, spacing: m.stackSpacing) {
                    weekdayRow(m)
                    calendarGrid(m)
                }
                .frame(height: usable * CGFloat(share), alignment: .top)
                if showChecklist {
                    SplitHandle(
                        share: $calendarShare,
                        usable: usable,
                        range: low...high,
                        defaultShare: PanelPreferences.defaultCalendarShare
                    )
                    ChecklistView(
                        items: CalendarWords.checklist(store.items, today: Date(), includeCompleted: showCompleted),
                        today: Date(),
                        compact: m.compact,
                        saving: store.saving,
                        onToggle: { item in Task { await store.toggle(item) } }
                    )
                }
            }
        }
    }

    @ViewBuilder
    private func footer(_ m: PanelMetrics) -> some View {
        if store.writeFailed {
            Text("저장하지 못했어요 · 연결을 확인해 주세요")
                .font(.system(size: m.compact ? 9 : 10, weight: .semibold, design: .rounded))
                .foregroundStyle(TEOPalette.ink)
                .padding(.horizontal, 9)
                .padding(.vertical, 3)
                .background(Color(red: 0.95, green: 0.87, blue: 0.72), in: Capsule())
                .padding(.bottom, m.compact ? 8 : 12)
        } else if store.syncFailed {
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
                .foregroundStyle(TEOPalette.muted)
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
            ForEach(Array(CalendarWords.weekdays.enumerated()), id: \.offset) { index, day in
                Text(day)
                    .font(.system(size: m.weekdayFont, weight: .semibold, design: .rounded))
                    .foregroundStyle(index == 6 ? TEOPalette.alert : TEOPalette.inkSoft)
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
            let maxLanes = max(0, Int((rowHeight - m.headHeight - m.rowBottom) / m.laneStep))
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
                .fill(Color.white.opacity(day == nil ? 0.0 : 0.62))
            if let day {
                // Just the number, as on the web calendar (a date format would add "일" in Korean).
                Text(verbatim: String(calendar.component(.day, from: day)))
                    .font(.system(size: m.dayFont, weight: isToday ? .bold : .medium, design: .rounded))
                    .foregroundStyle(isToday ? TEOPalette.today : TEOPalette.ink)
                    .padding(m.cellInset)
                if hidden > 0 {
                    Text("+\(hidden)")
                        .font(.system(size: m.smallFont, weight: .bold, design: .rounded))
                        .foregroundStyle(TEOPalette.accent)
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
                .fill(color.opacity(0.34))
            }
        }
        .opacity(segment.item.completed ? 0.5 : 1)
    }
}
