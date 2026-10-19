import XCTest
import UIKit
import WebKit
@testable import Imanto

@MainActor private final class TestWallet: MembershipWalletAuthority {
    var claims = Set<String>()
    var delay: UInt64 = 0
    var began = false, finished = false
    func reconcile(signedTransactions: [String]) async throws -> MembershipWalletSnapshot {
        began = true
        if delay > 0 { try await Task.sleep(nanoseconds: delay) }
        finished = true
        return MembershipWalletSnapshot(balance: 10, revivesRemaining: claims.isEmpty ? 1 : 0)
    }
    func claim(gameID: String, kind: String) async throws -> MembershipClaim? {
        guard kind == "revive" else { return nil }
        let key = gameID + ":" + kind
        claims.insert(key)
        return MembershipClaim(gameID: gameID, receipt: key)
    }
}
@MainActor final class MonetizationTests: XCTestCase {
    func testConcurrentRefreshWaitsForTheAuthoritativeResult() async throws {
        let controller = try XCTUnwrap((UIApplication.shared.delegate as? AppDelegate)?.window?.rootViewController as? GameController)
        await controller.subscriptions.refresh()
        let original = controller.subscriptions.wallet, slow = TestWallet()
        slow.delay = 200_000_000; controller.subscriptions.wallet = slow
        defer { controller.subscriptions.wallet = original }
        let first = Task { await controller.subscriptions.refresh() }
        for _ in 0..<300 {
            if slow.began { break }
            try await Task.sleep(nanoseconds: 10_000_000)
        }
        XCTAssertTrue(slow.began)
        await controller.subscriptions.refresh()
        XCTAssertTrue(slow.finished, "A concurrent status request must wait rather than return stale entitlement data")
        await first.value
        XCTAssertFalse(controller.subscriptions.suppressAutomaticAds)
    }
    func testLocalBenefitsPersistAndKeepSeparateGameAllowances() throws {
        let plan = MembershipConfiguration().plans[2]
        let now = Date(timeIntervalSince1970: 1_792_319_400)
        var state = LocalBenefitsState()
        let removal = try XCTUnwrap(LocalBenefitsPolicy.claim(state: &state, gameID: "game", kind: "remove", balance: 50, plan: plan, now: now))
        let revive = try XCTUnwrap(LocalBenefitsPolicy.claim(state: &state, gameID: "game", kind: "revive", balance: 49, plan: plan, now: now))
        XCTAssertEqual(state.debits, 1); XCTAssertEqual(state.usedRevives, 1)
        state = try JSONDecoder().decode(LocalBenefitsState.self, from: JSONEncoder().encode(state))
        XCTAssertEqual(LocalBenefitsPolicy.claim(state: &state, gameID: "game", kind: "remove", balance: 49, plan: plan, now: now)?.receipt, removal.receipt)
        XCTAssertEqual(LocalBenefitsPolicy.claim(state: &state, gameID: "game", kind: "revive", balance: 49, plan: plan, now: now)?.receipt, revive.receipt)
        XCTAssertNil(LocalBenefitsPolicy.claim(state: &state, gameID: "other", kind: "revive", balance: 49, plan: plan, now: now))
        XCTAssertNotNil(LocalBenefitsPolicy.claim(state: &state, gameID: "tomorrow", kind: "revive", balance: 49, plan: plan, now: now.addingTimeInterval(86400)))
    }
    func testLocalUpgradeRenewalAndRefundBalance() {
        let start = Date(timeIntervalSince1970: 1_700_000_000)
        let periods = [
            LocalBenefitsPeriod(id: "a", start: start, end: start.addingTimeInterval(1000), quota: 10, revoked: false),
            LocalBenefitsPeriod(id: "b", start: start.addingTimeInterval(500), end: start.addingTimeInterval(1000), quota: 50, revoked: false),
            LocalBenefitsPeriod(id: "c", start: start.addingTimeInterval(1000), end: start.addingTimeInterval(2000), quota: 50, revoked: false),
            LocalBenefitsPeriod(id: "refunded", start: start.addingTimeInterval(2000), end: start.addingTimeInterval(3000), quota: 80, revoked: true)
        ]
        XCTAssertEqual(LocalBenefitsPolicy.balance(periods: periods, debits: 7), 93)
        XCTAssertEqual(LocalBenefitsPolicy.balance(periods: periods, debits: 200), 0)
    }
    func testLocalDailyLimitsByTierAndUnlimitedDoesNotSpendBank() {
        let now = Date()
        for (index, plan) in MembershipConfiguration().plans.enumerated() {
            var state = LocalBenefitsState()
            let expected = [0, 0, 1, 5, 10][index]
            var granted = 0
            for game in 0..<10 {
                if LocalBenefitsPolicy.claim(state: &state, gameID: String(game), kind: "revive", balance: 10, plan: plan, now: now) != nil { granted += 1 }
            }
            XCTAssertEqual(granted, expected)
        }
        var state = LocalBenefitsState()
        XCTAssertNotNil(LocalBenefitsPolicy.claim(state: &state, gameID: "game", kind: "remove", balance: 0, plan: MembershipConfiguration().plans[4], now: now))
        XCTAssertEqual(state.debits, 0)
    }
    func testIncludedReviveAndReadableSubscriptionCopy() async throws {
        let controller = try XCTUnwrap((UIApplication.shared.delegate as? AppDelegate)?.window?.rootViewController as? GameController)
        let web = try XCTUnwrap(controller.web)
        let originalScripts = web.configuration.userContentController.userScripts
        defer { web.configuration.userContentController.removeAllUserScripts(); originalScripts.forEach { web.configuration.userContentController.addUserScript($0) } }
        let originalWallet = controller.subscriptions.wallet
        let wallet = TestWallet(); controller.subscriptions.wallet = wallet
        defer { controller.subscriptions.wallet = originalWallet }
        let file = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "revive", withExtension: "json"))
        let fixture = try String(contentsOf: file, encoding: .utf8)
        web.configuration.userContentController.addUserScript(WKUserScript(source: "localStorage.setItem('krazel-imanes-main-v6',JSON.stringify(\(fixture)));window.imantoReviveTest=true;", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        web.reload()
        var ready = false
        for _ in 0..<600 {
            if let value = try? await web.evaluateJavaScript("window.imantoReviveTest===true && document.querySelector('#menu')?.open && !document.querySelector('#paid-revive').hidden"), value as? Bool == true { ready = true; break }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        XCTAssertTrue(ready, "Included revive must become available through the native wallet bridge")
        guard ready else { return }
        let resultImage: UIImage = try await withCheckedThrowingContinuation { continuation in
            web.takeSnapshot(with: nil) { image, error in
                if let image = image { continuation.resume(returning: image) }
                else { continuation.resume(throwing: error ?? CocoaError(.fileReadUnknown)) }
            }
        }
        try XCTUnwrap(resultImage.pngData()).write(to: FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("imanto-screen-result.png"))
        let before = try await web.evaluateJavaScript("JSON.parse(localStorage.getItem('krazel-imanes-main-v6')).board.filter(Boolean).length") as! Int
        _ = try await web.evaluateJavaScript("document.querySelector('#paid-revive').click();true")
        for _ in 0..<300 {
            if let value = try? await web.evaluateJavaScript("JSON.parse(localStorage.getItem('krazel-imanes-main-v6')).revive==='earned'"), value as? Bool == true { break }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        _ = try await web.evaluateJavaScript("document.querySelector('#cells button:not(:disabled)').click();true")
        for _ in 0..<600 {
            if let value = try? await web.evaluateJavaScript("document.querySelector('#board').getAttribute('aria-busy')==='false'"), value as? Bool == true { break }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        let result = try await web.evaluateJavaScript("JSON.stringify({state:JSON.parse(localStorage.getItem('krazel-imanes-main-v6')),paid:!document.querySelector('#paid-revive').hidden,video:!document.querySelector('#revive').hidden})") as! String
        let values = try JSONSerialization.jsonObject(with: Data(result.utf8)) as! [String: Any]
        let state = values["state"] as! [String: Any], board = state["board"] as! [Any]
        XCTAssertEqual(board.filter { !($0 is NSNull) }.count, before - 1)
        XCTAssertEqual(state["revive"] as? String, "used")
        XCTAssertEqual(wallet.claims.count, 1)
        // No additional video/included chance in this same game.
        _ = try await web.evaluateJavaScript("document.querySelector('#pause').click();document.querySelector('#settings-open').click();document.querySelector('#membership-open').click();true")
        let text = try await web.evaluateJavaScript("document.querySelector('#membership').textContent") as! String
        XCTAssertFalse(text.contains("Retiradas de fichas cada mes"))
        XCTAssertTrue(text.contains("hacer espacio") || text.contains("make space"))
        let image: UIImage = try await withCheckedThrowingContinuation { continuation in
            web.takeSnapshot(with: nil) { image, error in
                if let image = image { continuation.resume(returning: image) }
                else { continuation.resume(throwing: error ?? CocoaError(.fileReadUnknown)) }
            }
        }
        try XCTUnwrap(image.pngData()).write(to: FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("imanto-subscription-qa.png"))
    }
}
