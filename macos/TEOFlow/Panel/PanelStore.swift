import Foundation

/// Loads the panel's data and remembers how fresh it is.
/// Only the two loading methods are main-actor isolated, so a view can still create the store in a property initialiser.
final class PanelStore: ObservableObject {
    @Published private(set) var items: [CalendarItem] = []
    @Published private(set) var isLoading = false
    /// True while the latest refresh failed. The previous items stay on screen.
    @Published private(set) var syncFailed = false
    /// Nil until something has loaded in this run, so a failed first load never claims to show old data.
    @Published private(set) var lastSynced: Date?

    private let refreshSeconds: UInt64 = 60

    /// Loads now, then every minute until the surrounding task is cancelled.
    @MainActor
    func autoRefresh() async {
        while !Task.isCancelled {
            await refresh()
            try? await Task.sleep(nanoseconds: refreshSeconds * 1_000_000_000)
        }
    }

    @MainActor
    func refresh() async {
        guard !isLoading else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            items = try await TEOAPI.fetchItems(includeCompleted: true)
            let now = Date()
            lastSynced = now
            syncFailed = false
            PanelPreferences.lastSynced = now
        } catch {
            syncFailed = true
        }
    }
}
