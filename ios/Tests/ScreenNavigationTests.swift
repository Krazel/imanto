import XCTest
import UIKit
import WebKit
@testable import Imanto

@MainActor final class ScreenNavigationTests: XCTestCase {
    func testAuxiliaryScreensKeepNavigationSettingsAndLayout() async throws {
        let owner = try XCTUnwrap((UIApplication.shared.delegate as? AppDelegate)?.window?.rootViewController as? GameController)
        let web = try XCTUnwrap(owner.web)
        // A previous score fixture restores its saved state by reloading the web view.
        try await Task.sleep(nanoseconds: 300_000_000)
        let originalScripts = web.configuration.userContentController.userScripts
        defer { web.configuration.userContentController.removeAllUserScripts(); originalScripts.forEach { web.configuration.userContentController.addUserScript($0) } }
        let fixtureURL = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "streak", withExtension: "json"))
        let fixture = try String(contentsOf: fixtureURL, encoding: .utf8)
        web.configuration.userContentController.addUserScript(WKUserScript(source: "localStorage.setItem('krazel-imanes-main-v6',JSON.stringify(\(fixture)));window.imantoScreensTest=true;", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        web.reload()
        var ready = false
        for _ in 0..<600 {
            if !web.isLoading, let value = try? await web.evaluateJavaScript("window.imantoScreensTest===true && document.querySelector('#pause')?.disabled===false"), value as? Bool == true { ready = true; break }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        XCTAssertTrue(ready); guard ready else { return }
        _ = try await web.evaluateJavaScript("document.querySelectorAll('dialog[open]').forEach(d=>d.close());document.querySelector('#pause').click();true")
        try await verifyAndCapture(web, id: "menu", name: "pause")
        let size = try await web.evaluateJavaScript("parseFloat(getComputedStyle(document.querySelector('#menu-score')).fontSize)") as! Double
        XCTAssertLessThanOrEqual(size, 42, "Pause numbers remain restrained, including long scores")
        _ = try await web.evaluateJavaScript("document.querySelector('#settings-open').click();true")
        try await verifyAndCapture(web, id: "settings", name: "settings")
        let before = try await web.evaluateJavaScript("document.querySelector('#sound-enabled').checked") as! Bool
        _ = try await web.evaluateJavaScript("document.querySelector('#sound-enabled').click();true")
        let changed = try await web.evaluateJavaScript("document.querySelector('#sound-enabled').checked") as! Bool
        XCTAssertNotEqual(before, changed)
        _ = try await web.evaluateJavaScript("document.querySelector('#sound-enabled').click();document.querySelector('#membership-open').click();true")
        try await verifyAndCapture(web, id: "membership", name: "plans")
        _ = try await web.evaluateJavaScript("document.querySelector('#membership-close').click();document.querySelector('#settings-close').click();document.querySelector('#menu-help').click();true")
        try await verifyAndCapture(web, id: "instructions", name: "help")
        let tiles = try await web.evaluateJavaScript("document.querySelectorAll('.line-example i').length") as! Int
        XCTAssertEqual(tiles, 5)
        _ = try await web.evaluateJavaScript("document.querySelector('#close-help').click();document.querySelector('#menu').close();document.querySelector('#restart-confirm').showModal();true")
        try await verifyAndCapture(web, id: "restart-confirm", name: "restart")
        _ = try await web.evaluateJavaScript("document.querySelector('#restart-no').click();true")
        let open = try await web.evaluateJavaScript("document.querySelectorAll('dialog[open]').length") as! Int
        XCTAssertEqual(open, 0)
    }
    private func verifyAndCapture(_ web: WKWebView, id: String, name: String) async throws {
        let valid = try await web.evaluateJavaScript("(()=>{const d=document.getElementById('\(id)');return d.open&&d.scrollWidth<=d.clientWidth+1&&d.getBoundingClientRect().right<=innerWidth+1})()") as? Bool
        XCTAssertEqual(valid, true, "\(name) must be visible without horizontal overflow")
        try await Task.sleep(nanoseconds: 100_000_000)
        let image: UIImage = try await withCheckedThrowingContinuation { continuation in
            web.takeSnapshot(with: nil) { image, error in
                if let image = image { continuation.resume(returning: image) }
                else { continuation.resume(throwing: error ?? CocoaError(.fileReadUnknown)) }
            }
        }
        try XCTUnwrap(image.pngData()).write(to: FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("imanto-screen-\(name).png"))
    }
}
