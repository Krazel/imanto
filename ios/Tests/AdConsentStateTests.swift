import XCTest
@testable import Imanto

@MainActor final class AdConsentStateTests: XCTestCase {
    func testUMPAdEligibilityNeverBypassesUnfinishedTransaction() {
        let state = AdConsentState()
        XCTAssertFalse(state.permitsAds(umpCanRequestAds: true))
        let first = state.begin()
        XCTAssertFalse(state.accepts(first, umpCanRequestAds: true))
        XCTAssertTrue(state.finish(first, allowed: true, succeeded: true))
        XCTAssertTrue(state.permitsAds(umpCanRequestAds: true))
        XCTAssertFalse(state.permitsAds(umpCanRequestAds: false))
    }

    func testWithdrawalBlocksAllFormatsAndRetiresPreviouslyLoadedAds() {
        let state = AdConsentState(), old = state.begin()
        _ = state.finish(old, allowed: true, succeeded: true)
        let choices = state.begin()
        XCTAssertFalse(state.accepts(old, umpCanRequestAds: true))
        XCTAssertFalse(state.accepts(choices, umpCanRequestAds: true))
        _ = state.finish(choices, allowed: false, succeeded: true)
        XCTAssertFalse(state.permitsAds(umpCanRequestAds: true))
        XCTAssertTrue(state.resolved)
        XCTAssertFalse(state.failed)
    }

    func testErrorCannotReusePreviouslyPermittedUMPMode() {
        let state = AdConsentState(), ticket = state.begin()
        XCTAssertFalse(state.finish(ticket, allowed: true, succeeded: false))
        XCTAssertTrue(state.failed)
        XCTAssertFalse(state.permitsAds(umpCanRequestAds: true))
        state.invalidate()
        XCTAssertFalse(state.failed)
        let retry = state.begin()
        XCTAssertTrue(state.finish(retry, allowed: true, succeeded: true))
    }

    func testBackgroundAndStaleCompletionCannotReopenGate() {
        let state = AdConsentState(), old = state.begin()
        state.invalidate()
        XCTAssertFalse(state.finish(old, allowed: true, succeeded: true))
        let current = state.begin()
        XCTAssertFalse(state.finish(old, allowed: true, succeeded: true))
        XCTAssertTrue(state.updating)
        XCTAssertTrue(state.finish(current, allowed: true, succeeded: true))
        XCTAssertFalse(state.accepts(old, umpCanRequestAds: true))
        XCTAssertTrue(state.accepts(current, umpCanRequestAds: true))
    }
}
