import XCTest
import UIKit
import WebKit
@testable import Imanto

@MainActor final class FirstEntryTutorialTests: XCTestCase {
    func testFirstEntryHelpPersistsAndRemainsAvailableInBothModes() async throws {
        let owner = try XCTUnwrap((UIApplication.shared.delegate as? AppDelegate)?.window?.rootViewController)
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        let web = WKWebView(frame: owner.view.bounds, configuration: configuration)
        owner.view.addSubview(web)
        defer { web.stopLoading(); web.removeFromSuperview() }
        let root = try XCTUnwrap(Bundle.main.url(forResource: "Web", withExtension: nil))
        var url = URLComponents(url: root.appendingPathComponent("index.html"), resolvingAgainstBaseURL: false)!
        url.query = "lang=es"
        web.loadFileURL(try XCTUnwrap(url.url), allowingReadAccessTo: root)
        try await waitUntilReady(web)
        let first = try await web.evaluateJavaScript("document.querySelector('#instructions').open && document.querySelector('#help-title').textContent==='Cómo jugar'") as! Bool
        XCTAssertTrue(first, "Fresh installation must present the approved tutorial")
        let saved = try await web.evaluateJavaScript("localStorage.getItem('krazel-imanes-main-v6')") as! String
        _ = try await web.evaluateJavaScript("document.querySelector('#close-help').click();true")
        // close events are queued by HTMLDialogElement.
        try await Task.sleep(nanoseconds: 100_000_000)
        web.reload()
        try await waitUntilReady(web)
        let repeated = try await web.evaluateJavaScript("document.querySelector('#instructions').open") as! Bool
        XCTAssertFalse(repeated, "Acknowledged tutorial must not repeat")
        let restored = try await web.evaluateJavaScript("localStorage.getItem('krazel-imanes-main-v6')") as! String
        XCTAssertEqual(saved, restored, "Tutorial must not replace or advance the saved game")
        _ = try await web.evaluateJavaScript("document.querySelector('#pause').click();document.querySelector('#menu-help').click();true")
        let manual = try await web.evaluateJavaScript("document.querySelector('#instructions').open") as! Bool
        XCTAssertTrue(manual, "Help stays available from pause")
        _ = try await web.evaluateJavaScript("document.querySelector('#help-close-icon').click();true")
        url.query = "size=6&lang=en"
        web.loadFileURL(try XCTUnwrap(url.url), allowingReadAccessTo: root)
        try await waitUntilReady(web)
        let seenInSix = try await web.evaluateJavaScript("!document.querySelector('#instructions').open && document.querySelectorAll('#cells button').length===36") as! Bool
        XCTAssertTrue(seenInSix, "The seen flag is shared by both complete game modes")
        _ = try await web.evaluateJavaScript("document.querySelector('#pause').click();document.querySelector('#menu-help').click();true")
        let sixHelp = try await web.evaluateJavaScript("document.querySelector('#instructions').open && document.querySelector('.line-example').children.length===6 && document.querySelector('#instructions').textContent.includes('Six of the same color')") as! Bool
        XCTAssertTrue(sixHelp, "English 6x6 help must explain a complete six-tile line")
    }

    private func waitUntilReady(_ web: WKWebView) async throws {
        for _ in 0..<600 {
            if !web.isLoading, let ready = try? await web.evaluateJavaScript("document.querySelector('#board')?.getAttribute('aria-busy')==='false'"), ready as? Bool == true { return }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        XCTFail("Bundled offline game did not become ready")
    }
}
