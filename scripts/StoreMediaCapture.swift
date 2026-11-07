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
        defer {
            scripts.removeAllUserScripts()
            original.forEach { scripts.addUserScript($0) }
        }
        let fixtures = try ["streak", "six"].map { name in
            try String(contentsOf: XCTUnwrap(Bundle(for: Self.self).url(forResource: name, withExtension: "json")), encoding: .utf8)
        }

        for language in ["en", "es"] {
            scripts.removeAllUserScripts()
            original.forEach { scripts.addUserScript($0) }
            let setup = """
            (() => {
              localStorage.setItem('imanto-language-v1', '\(language)');
              const five = \(fixtures[0]), six = \(fixtures[1]);
              five.blockAppearance = {material:'special-liquid',palette:'lagoon'};
              six.blockAppearance = {material:'special-circuit',palette:'arcade'};
              if (new URLSearchParams(location.search).get('size') === '6')
                localStorage.setItem('imanto-six-game-v1', JSON.stringify(six));
              else localStorage.setItem('krazel-imanes-main-v6', JSON.stringify(five));
              window.imantoStoreCapture = '\(language)';
            })();
            """
            scripts.addUserScript(WKUserScript(source: setup, injectionTime: .atDocumentStart, forMainFrameOnly: true))
            web.reload()
            try await wait(web, "window.imantoStoreCapture === '\(language)' && document.documentElement.dataset.blockMaterial === 'special-liquid' && !document.querySelector('#pause')?.disabled && document.querySelectorAll('.cell').length === 25 && document.querySelector('#score')?.textContent === '150' && document.querySelector('#board')?.getAttribute('aria-busy') === 'false'")
            let fit = try await web.evaluateJavaScript("parseFloat(getComputedStyle(document.querySelector('.pieces .tile'),'::before').scale)") as? Double
            XCTAssertEqual(fit, 1.08)
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                web.takeSnapshot(with: nil) { _, error in
                    if let error { continuation.resume(throwing: error) }
                    else { continuation.resume(returning: ()) }
                }
            }
            try await settle(2.5)
            try capture(window, to: folder.appendingPathComponent("store-\(language)-01-five.png"))

            let video = window.traitCollection.userInterfaceIdiom == .phone
            if video {
                try Data().write(to: folder.appendingPathComponent("store-\(language).start"))
                let ready = folder.appendingPathComponent("store-\(language).ready").path
                for _ in 0..<900 {
                    if FileManager.default.fileExists(atPath: ready) { break }
                    try await settle(0.1)
                }
                guard FileManager.default.fileExists(atPath: ready) else {
                    throw NSError(domain: "ImantoStoreCapture", code: 2, userInfo: [NSLocalizedDescriptionKey: "Recorder did not acknowledge \(language)"])
                }
                try await settle(3.0)
            }
            _ = try await web.evaluateJavaScript("document.querySelector('#cells [data-at=\"12\"]').click();true")
            try await wait(web, "document.querySelector('#score')?.textContent==='300' && document.querySelector('#board')?.getAttribute('aria-busy')==='false'")
            if video { try await settle(3.0) }
            _ = try await web.evaluateJavaScript("document.querySelector('#pause').click();true")
            try await settle(0.45)
            try capture(window, to: folder.appendingPathComponent("store-\(language)-03-pause.png"))
            if video { try await settle(2.2) }
            _ = try await web.evaluateJavaScript("document.querySelector('#try-six').click();true")
            try await wait(web, "location.search.includes('size=6') && document.querySelectorAll('.cell').length===36 && !document.querySelector('#pause')?.disabled")
            try await settle(0.45)
            try capture(window, to: folder.appendingPathComponent("store-\(language)-02-six.png"))
            if video { try await settle(2.2) }
            _ = try await web.evaluateJavaScript("document.querySelector('#cells [data-at=\"17\"]').click();true")
            try await wait(web, "document.querySelector('#score')?.textContent==='50' && document.querySelector('#board')?.getAttribute('aria-busy')==='false'")
            if video {
                try await settle(4.8)
                try Data().write(to: folder.appendingPathComponent("store-\(language).end"))
                try await settle(0.7)
            }
            _ = try await web.evaluateJavaScript("document.querySelector('#pause').click();document.querySelector('#try-six').click();true")
            try await wait(web, "!location.search.includes('size=6') && document.querySelectorAll('.cell').length===25")
        }
        if window.traitCollection.userInterfaceIdiom == .pad {
            // StoreKit is unavailable in this host. The native view uses the
            // actual five product identifiers and the verified Spanish prices.
            let catalogue = StoreCatalogCaptureBridge(web: web)
            scripts.removeScriptMessageHandler(forName: "imantoSubscriptions")
            scripts.add(catalogue, name: "imantoSubscriptions")
            defer { scripts.removeScriptMessageHandler(forName: "imantoSubscriptions") }
            web.reload()
            try await wait(web, "window.imantoStoreCapture === 'es' && !document.querySelector('#pause')?.disabled")
            _ = try await web.evaluateJavaScript("document.querySelector('#pause').click();document.querySelector('#menu-remove-ads').click();true")
            try await wait(web, "document.querySelector('#membership').open && document.querySelectorAll('#membership-plans button:not(:disabled)').length === 5")
            try await settle(0.4)
            try capture(window, to: folder.appendingPathComponent("store-es-04-membership.png"))
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

    private func capture(_ window: UIWindow, to file: URL) throws {
        let format = UIGraphicsImageRendererFormat()
        format.scale = window.screen.scale
        format.opaque = true
        let renderer = UIGraphicsImageRenderer(bounds: window.bounds, format: format)
        let data = renderer.pngData { _ in _ = window.drawHierarchy(in: window.bounds, afterScreenUpdates: true) }
        try data.write(to: file)
    }
}

@MainActor private final class StoreCatalogCaptureBridge: NSObject, WKScriptMessageHandler {
    weak var web: WKWebView?
    init(web: WKWebView) { self.web = web }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let request = message.body as? [String: Any],
              request["action"] as? String == "status",
              let id = request["requestId"] as? String else { return }
        let prices = ["1,99 €", "3,99 €", "9,99 €", "15,99 €", "24,99 €"]
        let plans = MembershipConfiguration().plans
        let products: [[String: Any]] = zip(plans, prices).map { plan, price in
            ["id": plan.productID, "name": plan.productID, "price": price,
             "monthlyRemovals": plan.monthlyRemovals ?? 0, "unlimited": plan.unlimited]
        }
        let response: [String: Any] = ["requestId": id, "resolved": true, "available": true,
                                       "active": false, "balance": 0, "products": products]
        guard let data = try? JSONSerialization.data(withJSONObject: response),
              let json = String(data: data, encoding: .utf8) else { return }
        web?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('imanto-subscription-result',{detail:\(json)})); true",
                                completionHandler: nil)
    }
}
