import AppKit

/// A menu row with a slider for how solid the panel's plate is. The percentage follows the slider,
/// and the panel changes as it moves (it reads the same saved setting).
@MainActor
final class PlateSliderView: NSView {
    private let title = NSTextField(labelWithString: "")
    private let slider: NSSlider

    init() {
        let range = PanelPreferences.plateRange
        slider = NSSlider(value: PanelPreferences.plateOpacity, minValue: range.lowerBound, maxValue: range.upperBound, target: nil, action: nil)
        super.init(frame: NSRect(x: 0, y: 0, width: 232, height: 54))
        title.font = NSFont.menuFont(ofSize: 0)
        title.frame = NSRect(x: 18, y: 30, width: 196, height: 17)
        slider.frame = NSRect(x: 16, y: 8, width: 200, height: 20)
        slider.isContinuous = true
        slider.target = self
        slider.action = #selector(moved)
        addSubview(title)
        addSubview(slider)
        refresh()
    }

    required init?(coder: NSCoder) {
        fatalError("PlateSliderView is only made in code")
    }

    /// Shows the saved value again (when the menu opens, and after it was reset).
    func refresh() {
        slider.doubleValue = PanelPreferences.plateOpacity
        showPercent()
    }

    @objc private func moved() {
        PanelPreferences.plateOpacity = slider.doubleValue
        showPercent()
    }

    private func showPercent() {
        title.stringValue = "패널 불투명도 \(Int((slider.doubleValue * 100).rounded()))%"
    }
}
