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
        let audio = StoreAudioCaptureBridge(controller)
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
        let video = window.traitCollection.userInterfaceIdiom == .phone

        for language in ["en", "es"] {
            for alternate in [false, true] {
                let five = alternate ? "special-glass" : "classic"
                let six = alternate ? "classic" : "special-glass"
                scripts.removeAllUserScripts()
                original.forEach { scripts.addUserScript($0) }
                let setup = """
                (() => {
                  localStorage.setItem('imanto-language-v1', '\(language)');
                  const five = \(fixtures[0]), six = \(fixtures[1]);
                  const prepare = (state, material, extra) => {
                    state.blockAppearance = {material, palette:'original'};
                    for (const [index,color] of extra) state.board[index] = {id:state.nextId++,color};
                    state.round = 4;
                    if (state.combo.count) state.combo.lastRound = 4;
                    state.nextTray[1].color = 'violet';
                    return JSON.stringify(state);
                  };
                  if (new URLSearchParams(location.search).get('size') === '6')
                    localStorage.setItem('imanto-six-game-v1', prepare(six,'\(six)',[[2,'teal'],[7,'honey'],[21,'violet'],[27,'teal'],[32,'honey']]));
                  else localStorage.setItem('krazel-imanes-main-v6', prepare(five,'\(five)',[[3,'honey'],[6,'violet'],[18,'teal'],[24,'honey']]));
                  window.imantoStoreCapture = '\(language)-\(five)';
                })();
                """
                scripts.addUserScript(WKUserScript(source: setup, injectionTime: .atDocumentStart, forMainFrameOnly: true))
                let captureVideo = video && !alternate
                let prefix = folder.appendingPathComponent("store-\(language)")
                let readyFive = "window.imantoStoreCapture === '\(language)-\(five)' && document.documentElement.dataset.blockMaterial === '\(five)' && document.querySelectorAll('.cell').length === 25 && document.querySelector('#score')?.textContent === '150' && document.querySelector('#board')?.getAttribute('aria-busy') === 'false'"
                web.reload()
                try await wait(web, readyFive)
                try await capture(window, web, to: folder.appendingPathComponent("store-\(language)-0\(alternate ? 3 : 1)-five-\(five).png"))

                var moments: [String: Double] = [:]
                if captureVideo {
                    audio.events.removeAll()
                    try Data().write(to: prefix.appendingPathExtension("start"))
                    let ready = prefix.appendingPathExtension("ready").path
                    for _ in 0..<900 {
                        if FileManager.default.fileExists(atPath: ready) { break }
                        try await settle(0.1)
                    }
                    guard FileManager.default.fileExists(atPath: ready) else {
                        throw NSError(domain: "ImantoStoreCapture", code: 2, userInfo: [NSLocalizedDescriptionKey: "Recorder did not acknowledge \(language)"])
                    }
                    try await settle(3.0)
                    _ = try await web.evaluateJavaScript("document.querySelector('#cells [data-at=\\\"12\\\"]').click();true")
                    try await wait(web, "document.querySelector('#score')?.textContent==='300' && document.querySelector('#board')?.getAttribute('aria-busy')==='false'")
                    try await settle(4.1)
                    moments["classicEnd"] = Date().timeIntervalSince1970
                }
                _ = try await web.evaluateJavaScript("document.querySelector('#pause').click();document.querySelector('#try-six').click();true")
                try await wait(web, "location.search.includes('size=6') && document.documentElement.dataset.blockMaterial === '\(six)' && document.querySelectorAll('.cell').length === 36 && !document.querySelector('#pause')?.disabled")
                try await capture(window, web, to: folder.appendingPathComponent("store-\(language)-0\(alternate ? 2 : 4)-six-\(six).png"))
                if captureVideo {
                    moments["glassStart"] = Date().timeIntervalSince1970
                    try await settle(3.0)
                    _ = try await web.evaluateJavaScript("document.querySelector('#cells [data-at=\\\"17\\\"]').click();true")
                    try await wait(web, "document.querySelector('#score')?.textContent==='50' && document.querySelector('#board')?.getAttribute('aria-busy')==='false'")
                    try await settle(4.6)
                    moments["glassEnd"] = Date().timeIntervalSince1970
                    let timeline: [String: Any] = ["moments": moments, "effects": audio.events]
                    try JSONSerialization.data(withJSONObject: timeline).write(to: prefix.appendingPathExtension("timeline"))
                    try Data().write(to: prefix.appendingPathExtension("end"))
                    try await settle(0.7)
                }
                _ = try await web.evaluateJavaScript("document.querySelector('#pause').click();document.querySelector('#try-six').click();true")
                try await wait(web, readyFive)
            }
        }
    }

    private func wait(_ web: WKWebView, _ condition: String) async throws {
        for _ in 0..<450 {
            if !web.isLoading, let result = try? await web.evaluateJavaScript(condition), result as? Bool == true { return }
            try await settle(0.1)
        }
        throw NSError(domain: "ImantoStoreCapture", code: 1, userInfo: [NSLocalizedDescriptionKey: condition])
    }

    private func settle(_ seconds: Double) async throws {
        try await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
    }

    private func capture(_ window: UIWindow, _ web: WKWebView, to file: URL) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            web.takeSnapshot(with: nil) { _, error in
                if let error { continuation.resume(throwing: error) }
                else { continuation.resume(returning: ()) }
            }
        }
        try await settle(2.5)
        let format = UIGraphicsImageRendererFormat()
        format.scale = window.screen.scale
        format.opaque = true
        let renderer = UIGraphicsImageRenderer(bounds: window.bounds, format: format)
        let data = renderer.pngData { _ in _ = window.drawHierarchy(in: window.bounds, afterScreenUpdates: true) }
        try data.write(to: file)
    }
}

@MainActor private final class StoreAudioCaptureBridge: NSObject, WKScriptMessageHandler {
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
