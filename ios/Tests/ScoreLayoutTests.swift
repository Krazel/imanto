import XCTest
import UIKit
import WebKit
@testable import Imanto

@MainActor final class ScoreLayoutTests: XCTestCase {
    func testMaximumScoreFitsHUDAndPauseInBothLanguages() async throws {
        let owner = try XCTUnwrap((UIApplication.shared.delegate as? AppDelegate)?.window?.rootViewController as? GameController)
        let web = try XCTUnwrap(owner.web)
        let root = try XCTUnwrap(Bundle.main.url(forResource: "Web", withExtension: nil))
        let fixtureURL = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "streak", withExtension: "json"))
        let fixture = try String(contentsOf: fixtureURL, encoding: .utf8)
        let originalScripts = web.configuration.userContentController.userScripts
        defer {
            web.configuration.userContentController.removeAllUserScripts()
            originalScripts.forEach { web.configuration.userContentController.addUserScript($0) }
        }
        // Other tests deliberately leave a lost or nearly full game. Use a known
        // playable board before startup, rather than changing that game's score.
        let backup = try await web.evaluateJavaScript("JSON.stringify(['krazel-imanes-main-v6','imanto-best-v1','imanto-language-v1'].map(k=>[k,localStorage.getItem(k)]))") as! String
        let restore = "(()=>{for(const [k,v] of \(backup)){if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v)};return true})()"
        do {
            for language in ["es", "en"] {
                let token = UUID().uuidString
                web.configuration.userContentController.removeAllUserScripts()
                originalScripts.forEach { web.configuration.userContentController.addUserScript($0) }
                let seed = "(()=>{const save=\(fixture);save.score=Number.MAX_SAFE_INTEGER;localStorage.setItem('krazel-imanes-main-v6',JSON.stringify(save));localStorage.setItem('imanto-best-v1',String(Number.MAX_SAFE_INTEGER));localStorage.setItem('imanto-language-v1','\(language)');window.imantoScoreFixture='\(token)'})()"
                web.configuration.userContentController.addUserScript(WKUserScript(source: seed, injectionTime: .atDocumentStart, forMainFrameOnly: true))
                web.loadFileURL(root.appendingPathComponent("index.html"), allowingReadAccessTo: root)
                var ready = false
                for _ in 0..<600 {
                    if !web.isLoading, let loaded = try? await web.evaluateJavaScript("window.imantoScoreFixture==='\(token)' && document.documentElement.lang==='\(language)' && document.querySelector('#score')?.dataset.value==='9007199254740991' && document.querySelector('#board')?.getAttribute('aria-busy')==='false' && document.querySelector('#pause')?.disabled===false"), loaded as? Bool == true { ready = true; break }
                    try await Task.sleep(nanoseconds: 100_000_000)
                }
                if !ready {
                    let diagnostic = (try? await web.evaluateJavaScript("JSON.stringify({url:location.href,fixture:window.imantoScoreFixture,language:document.documentElement.lang,score:document.querySelector('#score')?.dataset.value,busy:document.querySelector('#board')?.getAttribute('aria-busy'),pauseDisabled:document.querySelector('#pause')?.disabled,saved:localStorage.getItem('krazel-imanes-main-v6')})")) as? String
                    let attachment = XCTAttachment(string: diagnostic ?? "Web view unavailable")
                    attachment.lifetime = .keepAlways
                    add(attachment)
                    XCTFail("Isolated maximum-score scene must become playable: \(diagnostic ?? "unavailable")")
                    break
                }
                _ = try await web.evaluateJavaScript("document.querySelector('#pause').click();true")
                let menuOpen = try await web.evaluateJavaScript("document.querySelector('#menu').open") as? Bool
                XCTAssertEqual(menuOpen, true)
                let fits = try await web.evaluateJavaScript("['#score','#best-score','#menu-score','#menu-best'].every(s=>{const e=document.querySelector(s);return e.scrollWidth<=e.clientWidth+1 && e.getBoundingClientRect().right<=innerWidth}) && document.documentElement.scrollWidth<=innerWidth") as? Bool
                XCTAssertEqual(fits, true, "Large scores must not overflow in \(language)")
                let exact = try await web.evaluateJavaScript("document.querySelector('#menu-score').textContent.replace(/[^0-9]/g,'')") as? String
                XCTAssertEqual(exact, "9007199254740991")
                _ = try await web.evaluateJavaScript("document.querySelector('#menu').close();true")
            }
            _ = try await web.evaluateJavaScript(restore)
        } catch {
            _ = try? await web.evaluateJavaScript(restore)
            throw error
        }
    }
}
