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
    /// True after a tick that could not be saved; cleared by the next one that is.
    @Published private(set) var writeFailed = false
    /// Items being saved right now, so a double click cannot send two updates.
    @Published private(set) var saving: Set<String> = []

    private let refreshSeconds: UInt64 = 60

    /// Loads now, then every minute until the surrounding task is cancelled.
    @MainActor
    func autoRefresh() async {
        while !Task.isCancelled {
            await refresh()
            try? await Task.sleep(nanoseconds: refreshSeconds * 1_000_000_000)
        }
    }

    /// Ticks an item off (or back on). It shows at once, then the server's answer replaces the guess.
    @MainActor
    func toggle(_ item: CalendarItem) async {
        guard !saving.contains(item.id) else { return }
        saving.insert(item.id)
        defer { saving.remove(item.id) }
        let target = !item.completed
        if let index = items.firstIndex(where: { $0.id == item.id }) {
            items[index] = items[index].settingCompleted(target)
        }
        do {
            try await TEOAPI.setCompleted(item, to: target)
            writeFailed = false
        } catch {
            writeFailed = true
            // Nothing was saved, so put the box back as it was even if the refresh below cannot reach the server either.
            if let index = items.firstIndex(where: { $0.id == item.id }) {
                items[index] = item
            }
        }
        await refresh(force: true)
    }

    @MainActor
    func refresh(force: Bool = false) async {
        guard force || !isLoading else { return }
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
