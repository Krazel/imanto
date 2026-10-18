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
    func testStreakDragCancelAndNativeSnapshot() async throws {
        let controller = try XCTUnwrap((UIApplication.shared.delegate as? AppDelegate)?.window?.rootViewController as? GameController)
        let web = try XCTUnwrap(controller.web)
        let fixtureURL = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "streak", withExtension: "json"))
        let fixture = try String(contentsOf: fixtureURL, encoding: .utf8)
        let source = "window.imantoCapabilities.haptics=true;localStorage.setItem('imanto-haptics-v1','true');localStorage.setItem('krazel-imanes-main-v6', JSON.stringify(\(fixture)));window.imantoStreakTest=true;"
        web.configuration.userContentController.addUserScript(WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        var cues: [NativeHaptics.Cue] = []
        controller.haptics = NativeHaptics(view: controller.view, supported: true, output: { cues.append($0) })
        let root = try XCTUnwrap(Bundle.main.url(forResource: "Web", withExtension: nil))
        web.loadFileURL(root.appendingPathComponent("index.html"), allowingReadAccessTo: root)
        var ready = false
        for _ in 0..<600 {
            if let value = try? await web.evaluateJavaScript("window.imantoStreakTest===true && document.querySelector('#board')?.getAttribute('aria-busy')==='false'"), (value as? Bool) == true { ready = true; break }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        XCTAssertTrue(ready);guard ready else { return }
        // Same gesture code as the app, including touch lift and captured-pointer cancellation.
        let gestures = """
        (()=>{const tray=document.querySelector('#tray');window.qaDrag=(target,cancel=false)=>{const b=tray.querySelector('button:not(:disabled)'),s=b.getBoundingClientRect(),r=target?.getBoundingClientRect();const fire=(type,x,y,el=tray)=>el.dispatchEvent(new PointerEvent(type,{pointerId:61,pointerType:'touch',isPrimary:true,button:0,buttons:type==='pointerup'?0:1,bubbles:true,cancelable:true,clientX:x,clientY:y}));fire('pointerdown',s.x+s.width/2,s.y+s.height/2,b.querySelector('.chip'));const x=r?r.x+r.width/2:innerWidth-5,y=r?r.y+r.height/2+38:innerHeight-5;fire('pointermove',x,y);fire(cancel?'pointercancel':'pointerup',x,y);};return true;})()
        """
        _ = try await web.evaluateJavaScript(gestures)
        let before = try await web.evaluateJavaScript("JSON.parse(localStorage.getItem('krazel-imanes-main-v6')).turns") as? Int
        _ = try await web.evaluateJavaScript("qaDrag(null);qaDrag(document.querySelector('#cells button[data-at=\"12\"]'),true);qaDrag(document.querySelector('#cells button[data-at=\"10\"]'));true")
        let cancelled = try await web.evaluateJavaScript("JSON.parse(localStorage.getItem('krazel-imanes-main-v6')).turns") as? Int
        XCTAssertEqual(cancelled,before)
        _ = try await web.evaluateJavaScript("qaDrag(document.querySelector('#cells button[data-at=\"12\"]'));true")
        for _ in 0..<200 {
            try await Task.sleep(nanoseconds: 100_000_000)
            if let value = try? await web.evaluateJavaScript("document.querySelector('#board').getAttribute('aria-busy')==='false'"), (value as? Bool) == true { break }
        }
        let result = try await web.evaluateJavaScript("JSON.stringify({turns:JSON.parse(localStorage.getItem('krazel-imanes-main-v6')).turns,score:document.querySelector('#score').textContent,best:document.querySelector('#best-score').textContent,combo:document.querySelector('#combo-label').textContent,ghosts:document.querySelectorAll('.drag-chip').length,oldHud:!!document.querySelector('#round,#remaining'),pause:document.querySelector('#pause').textContent.trim()})") as! String
        let values = try JSONSerialization.jsonObject(with: Data(result.utf8)) as! [String:Any]
        XCTAssertEqual(values["turns"] as? Int,(before ?? -1)+1)
        XCTAssertEqual(values["score"] as? String,"300")
        XCTAssertGreaterThanOrEqual(Int(values["best"] as? String ?? "0") ?? 0,300)
        XCTAssertEqual(values["combo"] as? String,"COMBO ×3")
        XCTAssertEqual(values["ghosts"] as? Int,0);XCTAssertEqual(values["oldHud"] as? Bool,false);XCTAssertEqual(values["pause"] as? String,"")
        XCTAssertEqual(cues,[.combo],"An immediate streak clear replaces the placement pulse; cancelled drags never vibrate")
        let image: UIImage = try await withCheckedThrowingContinuation { continuation in
            web.takeSnapshot(with: nil) { image,error in
                if let image = image { continuation.resume(returning: image) }
                else { continuation.resume(throwing: error ?? CocoaError(.fileReadUnknown)) }
            }
        }
        let data = try XCTUnwrap(image.pngData())
        try data.write(to: FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("imanto-native-qa.png"))
    }
}
