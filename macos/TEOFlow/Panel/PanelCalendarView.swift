import AppKit
import SwiftUI

struct PanelCalendarView: View {
    @State private var month = Date()
    @State private var items: [WidgetItem] = []
    @State private var isLoading = false

    private let calendar = Calendar.current

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
            .background(PanelVisualEffect())
            .background(Color.white.opacity(0.05))
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .stroke(Color.white.opacity(0.34), lineWidth: 1)
            }
            .shadow(color: Color.black.opacity(0.13), radius: 26, y: 14)
        }
        .task { await refresh() }
    }

    private func header(compact: Bool) -> some View {
        HStack(spacing: 8) {
            Text(month, format: .dateTime.month(.wide).year())
                .font(.system(size: compact ? 18 : 23, weight: .bold, design: .rounded))
                .foregroundStyle(Color(red: 0.29, green: 0.20, blue: 0.15))
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
        }
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

    private func calendarGrid(compact: Bool) -> some View {
        LazyVGrid(columns: columns(spacing: compact ? 3 : 5), spacing: compact ? 3 : 5) {
            ForEach(monthDays, id: \.self) { day in
                cell(day, compact: compact)
            }
        }
    }

    private func cell(_ day: Date?, compact: Bool) -> some View {
        let dayItems = items.filter { item in
            guard let day else { return false }
            let value = Self.key(day)
            let end = item.dueDate ?? item.startDate
            return item.startDate <= value && value <= end
        }
        let isToday = day.map { calendar.isDate($0, inSameDayAs: Date()) } ?? false
        return VStack(alignment: .leading, spacing: compact ? 2 : 3) {
            if let day {
                Text(day, format: .dateTime.day())
                    .font(.system(size: compact ? 10 : 12, weight: isToday ? .bold : .medium, design: .rounded))
                    .foregroundStyle(isToday ? Color(red: 0.80, green: 0.17, blue: 0.14) : Color(red: 0.36, green: 0.26, blue: 0.20).opacity(0.9))
            } else {
                Color.clear.frame(height: compact ? 12 : 14)
            }
            ForEach(Array(dayItems.prefix(compact ? 1 : 2)), id: \.id) { item in
                HStack(spacing: 3) {
                    Circle().fill(item.isTask ? Color(red: 0.34, green: 0.51, blue: 0.51) : Color(red: 0.78, green: 0.41, blue: 0.24)).frame(width: compact ? 4 : 5, height: compact ? 4 : 5)
                    Text(item.title)
                        .font(.system(size: compact ? 7 : 9, weight: .medium, design: .rounded))
                        .lineLimit(1)
                        .foregroundStyle(Color(red: 0.31, green: 0.22, blue: 0.17).opacity(0.9))
                }
            }
            if dayItems.count > (compact ? 1 : 2) {
                Text("+\(dayItems.count - (compact ? 1 : 2))")
                    .font(.system(size: compact ? 7 : 8, weight: .bold, design: .rounded))
                    .foregroundStyle(Color(red: 0.53, green: 0.36, blue: 0.26).opacity(0.78))
            }
            Spacer(minLength: 0)
        }
        .padding(compact ? 4 : 6)
        .frame(maxWidth: .infinity, minHeight: compact ? 34 : 50, alignment: .topLeading)
        .background(Color.white.opacity(dayItems.isEmpty ? 0.14 : 0.28), in: RoundedRectangle(cornerRadius: 7, style: .continuous))
        .overlay(alignment: .bottomLeading) {
            if dayItems.contains(where: { $0.dueDate != nil && $0.dueDate != $0.startDate }) {
                Rectangle().fill(Color(red: 0.74, green: 0.43, blue: 0.28).opacity(0.68)).frame(height: 2)
            }
        }
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

    private func refresh() async {
        guard !isLoading else { return }
        isLoading = true
        items = await WidgetData.load()
        isLoading = false
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
