import Foundation

/// A completed UMP transaction permits an ad-serving mode, never implies ATT or
/// personalization. Every refresh/change retires requests from the previous choice.
@MainActor final class AdConsentState {
    private(set) var generation = 0
    private(set) var updating = false
    private(set) var resolved = false
    private(set) var failed = false
    private var allowed = false

    func begin() -> Int {
        generation += 1
        updating = true; resolved = false; failed = false; allowed = false
        return generation
    }

    @discardableResult func finish(_ ticket: Int, allowed: Bool, succeeded: Bool) -> Bool {
        guard ticket == generation, updating else { return false }
        updating = false; resolved = succeeded; failed = !succeeded
        self.allowed = succeeded && allowed
        return self.allowed
    }

    func invalidate() {
        generation += 1
        updating = false; resolved = false; failed = false; allowed = false
    }

    func permitsAds(umpCanRequestAds: Bool) -> Bool {
        resolved && !updating && allowed && umpCanRequestAds
    }

    func accepts(_ ticket: Int, umpCanRequestAds: Bool) -> Bool {
        ticket == generation && permitsAds(umpCanRequestAds: umpCanRequestAds)
    }
}
