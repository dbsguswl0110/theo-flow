import AppKit
import SwiftUI

/// The bar between the calendar and the checklist. Drag it up or down to give one of them more room;
/// double-click to put it back. VoiceOver can nudge it with the adjust gesture.
struct SplitHandle: View {
    /// The calendar's share of the room (0...1).
    @Binding var share: Double
    /// The height the calendar and checklist share, so a drag in points becomes a change in share.
    let usable: CGFloat
    let range: ClosedRange<Double>
    let defaultShare: Double
    @State private var startShare: Double?

    var body: some View {
        Capsule()
            .fill(Color.black.opacity(0.16))
            .frame(width: 40, height: 4)
            .frame(maxWidth: .infinity)
            .frame(height: 16)
            .contentShape(Rectangle())
            .gesture(
                // Measured in the window's space: the bar moves while it is dragged, so its own space would feed back.
                DragGesture(minimumDistance: 1, coordinateSpace: .global)
                    .onChanged { value in
                        if startShare == nil { startShare = share }
                        let moved = Double(value.translation.height / max(usable, 1))
                        share = clamp((startShare ?? share) + moved)
                    }
                    .onEnded { _ in startShare = nil }
            )
            .onTapGesture(count: 2) { share = clamp(defaultShare) }
            .onHover { inside in
                if inside { NSCursor.resizeUpDown.set() } else { NSCursor.arrow.set() }
            }
            .help("위아래로 끌어서 달력과 할 일의 비율을 바꿔요. 두 번 누르면 원래대로 돌아가요.")
            .accessibilityElement()
            .accessibilityLabel("달력과 할 일 목록의 비율")
            .accessibilityValue("달력 \(Int((share * 100).rounded()))퍼센트")
            .accessibilityAdjustableAction { direction in
                switch direction {
                case .increment: share = clamp(share + 0.05)
                case .decrement: share = clamp(share - 0.05)
                @unknown default: break
                }
            }
    }

    private func clamp(_ value: Double) -> Double {
        min(max(value, range.lowerBound), range.upperBound)
    }
}

/// Open work as a checklist under the calendar: what is overdue, then what is coming, then (optionally) what is done.
struct ChecklistView: View {
    let items: [CalendarItem]
    let today: Date
    let compact: Bool
    let saving: Set<String>
    let onToggle: (CalendarItem) -> Void

    private var openCount: Int { items.filter { !$0.completed }.count }

    var body: some View {
        VStack(alignment: .leading, spacing: compact ? 5 : 7) {
            HStack(spacing: 6) {
                Text("할 일")
                    .font(.system(size: compact ? 11 : 12, weight: .bold, design: .rounded))
                    .foregroundStyle(TEOPalette.ink)
                Text("\(openCount)")
                    .font(.system(size: compact ? 9 : 10, weight: .bold, design: .rounded))
                    .foregroundStyle(TEOPalette.muted)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 1)
                    .background(Color(red: 0.42, green: 0.30, blue: 0.22).opacity(0.1), in: Capsule())
                Spacer(minLength: 0)
            }
            if items.isEmpty {
                Text("남은 할 일이 없어요")
                    .font(.system(size: compact ? 10 : 11, weight: .medium, design: .rounded))
                    .foregroundStyle(TEOPalette.muted)
                Spacer(minLength: 0)
            } else {
                ScrollView(.vertical, showsIndicators: false) {
                    VStack(alignment: .leading, spacing: compact ? 5 : 7) {
                        ForEach(items) { item in
                            ChecklistRow(
                                item: item,
                                today: today,
                                compact: compact,
                                isSaving: saving.contains(item.id),
                                onToggle: { onToggle(item) }
                            )
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
        .padding(compact ? 8 : 10)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Color.white.opacity(0.6), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

private struct ChecklistRow: View {
    let item: CalendarItem
    let today: Date
    let compact: Bool
    let isSaving: Bool
    let onToggle: () -> Void

    private var overdue: Bool { !item.completed && item.endDate < CalendarMonth.dayKey(today) }

    var body: some View {
        HStack(alignment: .top, spacing: 7) {
            Button(action: onToggle) {
                Image(systemName: item.completed ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: compact ? 14 : 16, weight: .regular))
                    .foregroundStyle(TEOPalette.color(for: item))
                    .frame(width: 22, height: 22)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(isSaving)
            .accessibilityLabel("\(item.title) \(item.completed ? "다시 열기" : "완료 표시")")

            VStack(alignment: .leading, spacing: 1) {
                Text(item.title)
                    .font(.system(size: compact ? 11 : 12, weight: .semibold, design: .rounded))
                    .strikethrough(item.completed)
                    .foregroundStyle(TEOPalette.ink)
                    .lineLimit(1)
                Text(CalendarWords.when(item, today: today))
                    .font(.system(size: compact ? 9 : 10, weight: .medium, design: .rounded))
                    .foregroundStyle(overdue ? TEOPalette.alert : TEOPalette.muted)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
        }
        .opacity(item.completed ? 0.5 : (isSaving ? 0.6 : 1))
    }
}
