import XCTest
import WebKit
import AVFoundation
@testable import Imanto

@MainActor final class ImantoTests: XCTestCase {
    func testBundledAudioAndMutePolicy() {
        let audio = NativeAudio()
        XCTAssertNil(audio.lastError)
        XCTAssertEqual(Set(audio.pools.keys), Set(["button", "place", "move", "line"]))
        XCTAssertTrue(audio.pools.values.allSatisfy { $0.count == 3 && $0.allSatisfy { $0.duration > 0 } })
        XCTAssertEqual(AVAudioSession.sharedInstance().category, .playback)
        XCTAssertGreaterThan(audio.music?.duration ?? 0, 200)
        XCTAssertEqual(audio.music?.isPlaying, false)
        audio.receive(["kind":"settings", "effects":false, "music":false, "unlocked":true, "visible":true, "effectsVolume":1, "musicVolume":1])
        audio.receive(["kind":"effect", "cue":"place"])
        XCTAssertTrue(audio.pools.values.flatMap { $0 }.allSatisfy { !$0.isPlaying })
        XCTAssertEqual(audio.music?.isPlaying, false)
    }
    func testOfflineWebGameBootsAndCanPlace() async throws {
        let controller = try XCTUnwrap((UIApplication.shared.delegate as? AppDelegate)?.window?.rootViewController as? GameController)
        controller.loadViewIfNeeded()
        let web = try XCTUnwrap(controller.web)
        // Real WKWebView executes the production IIFE bundle from local resources.
        var ready = false
        for _ in 0..<100 {
            if let value = try? await web.evaluateJavaScript("document.querySelectorAll('#cells button').length"), (value as? Int) == 25 { ready = true; break }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        XCTAssertTrue(ready, "Offline game must create all 25 cells")
        guard ready else { return }
        let result = try await web.evaluateJavaScript("JSON.stringify({lang:document.documentElement.lang,native:!!window.webkit.messageHandlers.imantoAudio,webAudio:!!document.querySelector('audio'),overflow:document.documentElement.scrollWidth>innerWidth,tiles:document.querySelectorAll('#tray button').length})") as? String
        XCTAssertNotNil(result)
        let values = try JSONSerialization.jsonObject(with: Data(try XCTUnwrap(result).utf8)) as! [String:Any]
        XCTAssertTrue(["en","es"].contains(values["lang"] as? String ?? ""))
        XCTAssertEqual(values["native"] as? Bool, true)
        XCTAssertEqual(values["webAudio"] as? Bool, false)
        XCTAssertEqual(values["overflow"] as? Bool, false)
        XCTAssertEqual(values["tiles"] as? Int, 3)
        _ = try await web.evaluateJavaScript("document.querySelector('#tray button:not(:disabled)').click(); document.querySelector('#cells button:not(:disabled)').click(); true")
        try await Task.sleep(nanoseconds: 700_000_000)
        let occupied = try await web.evaluateJavaScript("document.querySelectorAll('#pieces .tile').length") as? Int
        XCTAssertGreaterThan(occupied ?? 0, 0)
        XCTAssertFalse(web.configuration.preferences.isTextInteractionEnabled)
        _ = try await web.evaluateJavaScript("document.querySelector('#pause').click(); document.querySelector('#menu').open")
        let menu = try await web.evaluateJavaScript("document.querySelector('#menu').open") as? Bool
        XCTAssertEqual(menu, true)
    }
}
