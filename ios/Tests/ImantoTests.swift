import XCTest
import UIKit
import WebKit
import AVFoundation
@testable import Imanto

@MainActor final class ImantoTests: XCTestCase {
    func testHapticsRespectSettingsHardwareAndLifecycle() {
        var cues: [NativeHaptics.Cue] = []
        let feedback = NativeHaptics(view: UIView(), supported: true, output: { cues.append($0) })
        feedback.receive(["kind":"prepare"])
        XCTAssertTrue(cues.isEmpty)
        for name in ["place", "line", "combo", "allClear"] { feedback.receive(["kind":"play", "cue":name]) }
        XCTAssertEqual(cues, [.place, .line, .combo, .allClear])
        feedback.receive(["kind":"settings", "enabled":false, "visible":true])
        feedback.receive(["kind":"play", "cue":"place"])
        feedback.receive(["kind":"settings", "enabled":true, "visible":false])
        feedback.receive(["kind":"play", "cue":"line"])
        feedback.receive(["kind":"settings", "enabled":true, "visible":true])
        feedback.active = false
        feedback.receive(["kind":"play", "cue":"combo"])
        XCTAssertEqual(cues.count, 4)
        feedback.active = true
        feedback.receive(["kind":"play", "cue":"unknown"])
        feedback.receive(["kind":"play", "cue":"place"])
        XCTAssertEqual(cues.count, 5)
        let unavailable = NativeHaptics(view: UIView(), supported: false, output: { cues.append($0) })
        unavailable.receive(["kind":"play", "cue":"place"])
        XCTAssertEqual(cues.count, 5)
    }
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
        // Simulator has no Taptic Engine. Capture the real bridge's requests;
        // this verifies routing/mutes, never the physical sensation.
        var hapticCues: [NativeHaptics.Cue] = []
        controller.haptics = NativeHaptics(view: controller.view, supported: true, output: { hapticCues.append($0) })
        web.configuration.userContentController.addUserScript(WKUserScript(source: "window.imantoCapabilities.haptics=true;window.imantoHapticsTest=true;localStorage.setItem('imanto-haptics-v1','true');", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        web.reload()
        // Real WKWebView executes the production IIFE bundle from local resources.
        var ready = false
        for _ in 0..<600 {
            if controller.navigationReady, let value = try? await web.evaluateJavaScript("window.imantoHapticsTest===true && document.querySelectorAll('#cells button').length===25 && document.querySelector('#board').getAttribute('aria-busy')==='false'"), (value as? Bool) == true { ready = true; break }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        XCTAssertTrue(ready, "Offline game must become playable. Navigation: \(controller.navigationReady), error: \(controller.navigationError ?? "none"), scripts: \(controller.scriptErrors)")
        guard ready else { return }
        let result = try await web.evaluateJavaScript("JSON.stringify({lang:document.documentElement.lang,native:!!window.webkit.messageHandlers.imantoAudio,webAudio:!!document.querySelector('audio'),overflow:document.documentElement.scrollWidth>innerWidth,tiles:document.querySelectorAll('#tray button').length})") as? String
        XCTAssertNotNil(result)
        let values = try JSONSerialization.jsonObject(with: Data(try XCTUnwrap(result).utf8)) as! [String:Any]
        XCTAssertTrue(["en","es"].contains(values["lang"] as? String ?? ""))
        XCTAssertEqual(values["native"] as? Bool, true)
        XCTAssertEqual(values["webAudio"] as? Bool, false)
        XCTAssertEqual(values["overflow"] as? Bool, false)
        XCTAssertEqual(values["tiles"] as? Int, 3)
        let before = try await web.evaluateJavaScript("JSON.parse(localStorage.getItem('krazel-imanes-main-v6')).turns") as? Int
        _ = try await web.evaluateJavaScript("document.querySelector('#tray button:not(:disabled)').click(); document.querySelector('#cells button:not(:disabled)').click(); true")
        for _ in 0..<100 {
            try await Task.sleep(nanoseconds: 100_000_000)
            if let value = try? await web.evaluateJavaScript("document.querySelector('#board').getAttribute('aria-busy')==='false'"), (value as? Bool) == true { break }
        }
        let after = try await web.evaluateJavaScript("JSON.parse(localStorage.getItem('krazel-imanes-main-v6')).turns") as? Int
        XCTAssertNotNil(before)
        XCTAssertEqual(after, (before ?? -1) + 1, "A native-host placement must commit exactly one turn")
        XCTAssertEqual(hapticCues, [.place], "One valid placement, without vibrations for selection or moved tiles")
        XCTAssertFalse(web.configuration.preferences.isTextInteractionEnabled)
        _ = try await web.evaluateJavaScript("document.querySelector('#pause').click(); document.querySelector('#menu').open")
        let menu = try await web.evaluateJavaScript("document.querySelector('#menu').open") as? Bool
        XCTAssertEqual(menu, true)
        let hapticsVisible = try await web.evaluateJavaScript("!document.querySelector('#haptics-row').hidden") as? Bool
        XCTAssertEqual(hapticsVisible, true)
        _ = try await web.evaluateJavaScript("document.querySelector('#haptics-enabled').checked=false;document.querySelector('#haptics-enabled').dispatchEvent(new Event('change'));document.querySelector('#continue').click();document.querySelector('#cells button:not(:disabled)').click();true")
        for _ in 0..<100 {
            try await Task.sleep(nanoseconds: 100_000_000)
            if let value = try? await web.evaluateJavaScript("document.querySelector('#board').getAttribute('aria-busy')==='false'"), (value as? Bool) == true { break }
        }
        XCTAssertEqual(hapticCues, [.place], "The independent haptics mute must stop the native bridge")
        let savedHaptics = try await web.evaluateJavaScript("localStorage.getItem('imanto-haptics-v1')") as? String
        XCTAssertEqual(savedHaptics, "false")
    }
}
