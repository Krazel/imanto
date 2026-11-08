import Foundation
import UIKit
import WebKit
import XCTest
@testable import Imanto

@MainActor final class StoreMediaCapture: XCTestCase {
    func testCaptureStoreMedia() async throws {
        let window = try XCTUnwrap((UIApplication.shared.delegate as? AppDelegate)?.window)
        let controller = try XCTUnwrap(window.rootViewController as? GameController)
        let web = try XCTUnwrap(controller.web)
        let folder = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        print("IMANTO_STORE_DOCUMENTS=\(folder.path)")
        let scripts = web.configuration.userContentController
        let original = scripts.userScripts
        let audio = StoreGameplayAudio(controller)
        scripts.removeScriptMessageHandler(forName: "imantoAudio")
        scripts.add(audio, name: "imantoAudio")
        defer {
            scripts.removeScriptMessageHandler(forName: "imantoAudio")
            scripts.removeAllUserScripts()
            original.forEach { scripts.addUserScript($0) }
        }
        let fixtures = try ["streak", "six"].map { name in
            try String(contentsOf: XCTUnwrap(Bundle(for: Self.self).url(forResource: name, withExtension: "json")), encoding: .utf8)
        }
        // Record English after the first complete material pass has warmed the renderer.
        // capture-store-media.mjs must use the same ordering for its marker handshake.
        for language in ["es", "en"] {
            scripts.removeAllUserScripts()
            original.forEach { scripts.addUserScript($0) }
            let setup = """
            (() => {
              localStorage.setItem('imanto-language-v1', '\(language)');
              const six = new URLSearchParams(location.search).get('size') === '6';
              const state = six ? \(fixtures[1]) : \(fixtures[0]);
              state.blockAppearance = {material:six ? 'special-glass' : 'classic', palette:'original'};
              if (six) state.board.fill(null);
              else state.board[13] = null;
              // Five causal preparations: open 4, move coral 10→16→22, open 8,
              // then push coral 14→20 to clear row 18…23 after the real pulse.
              const extra = six ? [[1,'honey'],[2,'violet'],[4,'honey'],[8,'violet'],[10,'coral'],[13,'honey'],
                                   [14,'coral'],[18,'coral'],[19,'coral'],[21,'coral'],[23,'coral'],[25,'teal']]
                                : [[3,'honey'],[6,'violet'],[18,'teal'],[24,'honey']];
              for (const [index,color] of extra) state.board[index] = {id:state.nextId++,color};
              state.round = 4;
              state.score = 0;
              state.turns = 0;
              state.combo = {count:0,lastRound:null};
              state.tray.forEach((piece,index) => piece.color = ['teal','honey','coral'][index]);
              state.nextTray.forEach((piece,index) => piece.color = six ? ['teal','honey','violet'][index] : 'coral');
              const key = six ? 'imanto-six-game-v1' : 'krazel-imanes-main-v6';
              localStorage.setItem(key, JSON.stringify(state));
              window.imantoCaptureLanguage = '\(language)';
              window.imantoDragSamples = [];
              window.imantoPlayDrag = (option, destination, milliseconds, serial, captureRate) => {
                const tray = document.querySelector('#tray');
                const button = document.querySelector('.choice[data-option="'+option+'"]');
                const cells = [...document.querySelectorAll('#cells .cell')];
                const center = node => {const r=node.getBoundingClientRect(); return [r.x+r.width/2,r.y+r.height/2];};
                const start = center(button), end = center(cells[destination]);
                const dx=end[0]-start[0],dy=end[1]-start[1],distance=Math.hypot(dx,dy);
                // A shallow, continuous hand arc; no intermediate cells or sharp corners.
                const bow=Math.min(18,distance*0.065)*(dx<0?-1:1);
                const normal=distance ? [-dy/distance,dx/distance] : [0,0];
                const controls=[0.32,0.68].map(fraction=>[
                  start[0]+dx*fraction+normal[0]*bow,
                  start[1]+dy*fraction+normal[1]*bow
                ]);
                const pickup=90*captureRate, release=70*captureRate, travel=milliseconds-pickup-release;
                const event = (type, point, target) => target.dispatchEvent(new PointerEvent(type,{
                  bubbles:true,cancelable:true,pointerType:'mouse',pointerId:19,isPrimary:true,button:0,
                  buttons:type==='pointerup'?0:1,clientX:point[0],clientY:point[1]
                }));
                const started=performance.now(), epoch=performance.timeOrigin;
                const sample={serial,option,destination,requestedDurationMs:milliseconds,
                  pickupMs:pickup,travelMs:travel,releaseMs:release,
                  pointerDown:Date.now()/1000,performanceTimeOriginMs:epoch,
                  monotonicStartMs:started,intervals:[],points:[]};
                event('pointerdown',start,button);
                let previous;
                const advance = now => {
                  if (previous !== undefined) sample.intervals.push(now-previous);
                  previous = now;
                  const elapsed=now-started;
                  const progress=Math.max(0,Math.min(1,(elapsed-pickup)/travel));
                  // Minimum-jerk timing starts and stops softly, without constant-speed slides.
                  const t=progress*progress*progress*(10+progress*(-15+6*progress)),u=1-t;
                  const point=start.map((value,axis)=>u*u*u*value+
                    3*u*u*t*controls[0][axis]+3*u*t*t*controls[1][axis]+t*t*t*end[axis]);
                  if(progress>0 && sample.motionStart===undefined) sample.motionStart=Date.now()/1000;
                  if(progress===1 && sample.motionEnd===undefined) sample.motionEnd=Date.now()/1000;
                  sample.points.push({elapsedMs:elapsed,x:point[0],y:point[1]});
                  event('pointermove',point,tray);
                  if (elapsed < milliseconds) requestAnimationFrame(advance);
                  else {
                    sample.pointerUp=Date.now()/1000;
                    sample.actualDurationMs=performance.now()-started;
                    event('pointerup',end,tray);
                    window.imantoDragSamples.push(sample);
                    window.imantoCompletedDrag=serial;
                  }
                };
                requestAnimationFrame(advance);
                return true;
              };
            })();
            """
            scripts.addUserScript(WKUserScript(source: setup, injectionTime: .atDocumentStart, forMainFrameOnly: true))
            web.reload()
            try await wait(web, "window.imantoCaptureLanguage === '\(language)' && document.querySelectorAll('#cells .cell').length === 25 && document.querySelector('#board').getAttribute('aria-busy') === 'false'")
            try await settle(0.8)
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                web.takeSnapshot(with: nil) { _, error in
                    if let error { continuation.resume(throwing: error) }
                    else { continuation.resume(returning: ()) }
                }
            }
            try await settle(0.5)
            audio.events.removeAll()
            let prefix = folder.appendingPathComponent("store-\(language)")
            try Data().write(to: prefix.appendingPathExtension("start"))
            let ready = prefix.appendingPathExtension("ready").path
            for _ in 0..<900 {
                if FileManager.default.fileExists(atPath: ready) { break }
                try await settle(0.1)
            }
            XCTAssertTrue(FileManager.default.fileExists(atPath: ready))
            try await settle(0.6)
            var marks = ["classicStart": Date().timeIntervalSince1970]
            try await drag(web, 0, 2, 1400, 1, 1)
            try await drag(web, 1, 16, 1050, 2, 2)
            try await drag(web, 2, 13, 1050, 3, 3)
            try await drag(web, 0, 12, 1150, 4, 4)
            try await wait(web, "document.querySelector('#score').textContent === '50'")
            try await settle(0.65)
            marks["classicEnd"] = Date().timeIntervalSince1970
            let classicStats = try await web.evaluateJavaScript("JSON.stringify(window.imantoDragSamples)") as? String ?? "[]"
            _ = try await web.evaluateJavaScript("document.querySelector('#pause').click();document.querySelector('#try-six').click();true")
            try await wait(web, "document.querySelectorAll('#cells .cell').length === 36 && document.documentElement.dataset.blockMaterial === 'special-glass' && document.querySelector('#board').getAttribute('aria-busy') === 'false'")
            // Commit the first glass frame before its first gesture. The prior cold
            // English capture had stale compositor frames despite aria-busy=false.
            // This only warms rendering; no game move, score or physics is altered.
            _ = try await web.evaluateJavaScript("window.imantoGlassPaintReady=false;requestAnimationFrame(()=>requestAnimationFrame(()=>window.imantoGlassPaintReady=true));true")
            try await wait(web, "window.imantoGlassPaintReady === true")
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                web.takeSnapshot(with: nil) { _, error in
                    if let error { continuation.resume(throwing: error) }
                    else { continuation.resume(returning: ()) }
                }
            }
            try await settle(1.2)
            marks["glassStart"] = Date().timeIntervalSince1970
            try await drag(web, 0, 3, 1200, 1, 5)
            try await drag(web, 1, 4, 1050, 2, 6)
            try await drag(web, 2, 10, 1050, 3, 7)
            try await drag(web, 0, 7, 1050, 4, 8)
            try await drag(web, 1, 8, 1200, 5, 9)
            try await wait(web, "document.querySelector('#score').textContent === '50' && JSON.parse(localStorage.getItem('imanto-six-game-v1')).score === 50")
            // Keep a real resolved board for the editorial title fade over gameplay.
            try await settle(2.5)
            marks["glassEnd"] = Date().timeIntervalSince1970
            let glassStats = try await web.evaluateJavaScript("JSON.stringify(window.imantoDragSamples)") as? String ?? "[]"
            let timeline: [String: Any] = [
                "moments": marks, "effects": audio.events,
                "dragSamples": [classicStats, glassStats]
            ]
            try JSONSerialization.data(withJSONObject: timeline).write(to: prefix.appendingPathExtension("timeline"))
            try Data().write(to: prefix.appendingPathExtension("end"))
            try await settle(0.55)
            _ = try await web.evaluateJavaScript("document.querySelector('#pause').click();document.querySelector('#try-six').click();true")
            try await wait(web, "document.querySelectorAll('#cells .cell').length === 25")
        }
    }

    private func drag(_ web: WKWebView, _ option: Int, _ destination: Int, _ milliseconds: Int, _ turn: Int, _ serial: Int) async throws {
        // Only the demonstration gesture is captured slowly; game resolution keeps its real timing.
        let captureRate = 4.0
        let captureMilliseconds = Int(Double(milliseconds) * captureRate)
        _ = try await web.evaluateJavaScript("window.imantoPlayDrag(\(option), \(destination), \(captureMilliseconds), \(serial), \(captureRate))")
        try await wait(web, "window.imantoCompletedDrag === \(serial) && document.querySelector('#board').getAttribute('aria-busy') === 'false' && JSON.parse(localStorage.getItem(location.search.includes('size=6') ? 'imanto-six-game-v1' : 'krazel-imanes-main-v6')).turns === \(turn)")
        _ = try await web.evaluateJavaScript("Object.assign(window.imantoDragSamples.find(sample => sample.serial === \(serial)), {boardReady:Date.now()/1000,captureRate:\(captureRate),presentationDurationMs:\(milliseconds)})")
        try await settle(0.15)
    }

    private func wait(_ web: WKWebView, _ condition: String) async throws {
        for _ in 0..<280 {
            if !web.isLoading, let result = try? await web.evaluateJavaScript(condition), result as? Bool == true { return }
            try await settle(0.12)
        }
        throw NSError(domain: "ImantoStoreGameplay", code: 1, userInfo: [NSLocalizedDescriptionKey: condition])
    }

    private func settle(_ seconds: Double) async throws {
        try await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
    }
}

@MainActor private final class StoreGameplayAudio: NSObject, WKScriptMessageHandler {
    weak var controller: GameController?
    var events: [[String: Any]] = []
    init(_ controller: GameController) { self.controller = controller }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        controller?.receive(message)
        guard let body = message.body as? [String: Any], body["kind"] as? String == "effect",
              let cue = body["cue"] as? String, ["place", "move", "line"].contains(cue) else { return }
        events.append(["cue": cue, "variation": body["variation"] as? Int ?? 2, "time": Date().timeIntervalSince1970])
    }
}
