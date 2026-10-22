import XCTest
import UIKit
import WebKit
@testable import Imanto

@MainActor final class ScreenNavigationTests: XCTestCase {
    func testAuxiliaryScreensKeepNavigationSettingsAndLayout() async throws {
        let owner = try XCTUnwrap((UIApplication.shared.delegate as? AppDelegate)?.window?.rootViewController as? GameController)
        let web = try XCTUnwrap(owner.web)
        XCTAssertEqual(web.scrollView.pinchGestureRecognizer?.isEnabled, false)
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
        let material = try await web.evaluateJavaScript("document.documentElement.dataset.blockMaterial") as! String
        XCTAssertEqual(material, "jelly", "Existing games begin with the selected clean jelly")
        let jellyOverlay = try await web.evaluateJavaScript("getComputedStyle(document.querySelector('.tile'),'::after').content") as! String
        XCTAssertEqual(jellyOverlay, "none", "Clean jelly has no circles or lower oval")
        let materialCSS = try await web.evaluateJavaScript("getComputedStyle(document.querySelector('.tile')).backgroundImage") as! String
        XCTAssertTrue(materialCSS.contains("gradient"), "The approved surface must be bundled in WKWebView")
        let originalBounds = web.bounds
        let layoutProbe = "JSON.stringify(['.heading','#score','#board','#tray','.forecast'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return [r.x,r.y,r.width,r.height]}))"
        let beforeBanner = try await web.evaluateJavaScript(layoutProbe) as! String
        owner.reserveBannerHeight(90)
        let afterBanner = try await web.evaluateJavaScript(layoutProbe) as! String
        XCTAssertEqual(web.bounds, originalBounds, "A banner must not resize the web viewport")
        XCTAssertEqual(afterBanner, beforeBanner, "Banner reservation must not shift or shrink the game")
        owner.reserveBannerHeight(0)
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
        // The optional size is the complete game, with shared menus and isolated progress.
        let mainSave = try await web.evaluateJavaScript("localStorage.getItem('krazel-imanes-main-v6')") as! String
        let sixFixtureURL = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "six", withExtension: "json"))
        let sixFixture = try String(contentsOf: sixFixtureURL, encoding: .utf8)
        web.configuration.userContentController.addUserScript(WKUserScript(source: "if(new URLSearchParams(location.search).get('size')==='6')localStorage.setItem('imanto-six-game-v1',JSON.stringify(\(sixFixture)));", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        _ = try await web.evaluateJavaScript("document.querySelector('#pause').click();document.querySelector('#try-six').click();true")
        try await waitFor(web, "location.search.includes('size=6') && document.querySelectorAll('#cells .cell').length===36 && document.querySelector('#pause')?.disabled===false")
        let nativeOnly = try await web.evaluateJavaScript("document.querySelectorAll('audio').length") as! Int
        XCTAssertEqual(nativeOnly, 0, "Both board sizes must use native audio")
        XCTAssertEqual(web.scrollView.pinchGestureRecognizer?.isEnabled, false)
        _ = try await web.evaluateJavaScript("document.querySelector('[data-at=\"17\"]').click();true")
        try await waitFor(web, "document.querySelector('#score')?.textContent==='50' && document.querySelector('#board')?.getAttribute('aria-busy')==='false'")
        let separateSave = try await web.evaluateJavaScript("JSON.parse(localStorage.getItem('imanto-six-game-v1')).board.length") as! Int
        XCTAssertEqual(separateSave, 36)
        let sixImage: UIImage = try await withCheckedThrowingContinuation { continuation in
            web.takeSnapshot(with: nil) { image, error in
                if let image = image { continuation.resume(returning: image) }
                else { continuation.resume(throwing: error ?? CocoaError(.fileReadUnknown)) }
            }
        }
        try XCTUnwrap(sixImage.pngData()).write(to: FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("imanto-screen-six.png"))
        // The injected fixture resets the main save on navigation; compare board/score,
        // while the material metadata is added only when the main app runs.
        let preserved = try await web.evaluateJavaScript("JSON.stringify(JSON.parse(localStorage.getItem('krazel-imanes-main-v6')).board)") as! String
        let original = try JSONSerialization.jsonObject(with: Data(mainSave.utf8)) as! [String: Any]
        let preservedBoard = try JSONSerialization.jsonObject(with: Data(preserved.utf8)) as! NSArray
        XCTAssertEqual(preservedBoard, original["board"] as? NSArray)
        _ = try await web.evaluateJavaScript("document.querySelector('#pause').click();true")
        try await verifyAndCapture(web, id: "menu", name: "six-pause")
        _ = try await web.evaluateJavaScript("document.querySelector('#menu-help').click();true")
        let sixExample = try await web.evaluateJavaScript("document.querySelectorAll('.line-example i').length") as! Int
        XCTAssertEqual(sixExample, 6)
        _ = try await web.evaluateJavaScript("document.querySelector('#close-help').click();document.querySelector('#try-six').click();true")
        try await waitFor(web, "!location.search.includes('size=6') && document.querySelectorAll('#cells .cell').length===25 && document.querySelector('#pause')?.disabled===false")
    }
    private func waitFor(_ web: WKWebView, _ condition: String) async throws {
        for _ in 0..<300 {
            if !web.isLoading, let result = try? await web.evaluateJavaScript(condition), result as? Bool == true { return }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        XCTFail("Offline navigation or gameplay timed out: \(condition)")
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
