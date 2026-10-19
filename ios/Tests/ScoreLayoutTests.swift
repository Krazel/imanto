import XCTest
import UIKit
import WebKit
@testable import Imanto

@MainActor final class ScoreLayoutTests: XCTestCase {
    func testMaximumScoreFitsHUDAndPauseInBothLanguages() async throws {
        let owner = try XCTUnwrap((UIApplication.shared.delegate as? AppDelegate)?.window?.rootViewController as? GameController)
        for _ in 0..<600 {
            if let ready = try? await owner.web.evaluateJavaScript("!!localStorage.getItem('krazel-imanes-main-v6') && document.querySelector('#board')?.getAttribute('aria-busy')==='false'"), ready as? Bool == true { break }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        let backup = try await owner.web.evaluateJavaScript("JSON.stringify(['krazel-imanes-main-v6','imanto-best-v1','imanto-language-v1'].map(k=>[k,localStorage.getItem(k)]))") as! String
        defer {
            owner.web.evaluateJavaScript("for(const [k,v] of \(backup)){if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v)};location.reload()", completionHandler: nil)
        }
        for language in ["es", "en"] {
            _ = try await owner.web.evaluateJavaScript("let qaScore=JSON.parse(localStorage.getItem('krazel-imanes-main-v6'));qaScore.score=Number.MAX_SAFE_INTEGER;localStorage.setItem('krazel-imanes-main-v6',JSON.stringify(qaScore));localStorage.setItem('imanto-best-v1',String(Number.MAX_SAFE_INTEGER));localStorage.setItem('imanto-language-v1','\(language)');location.reload();true")
            var ready = false
            for _ in 0..<600 {
                if let loaded = try? await owner.web.evaluateJavaScript("document.documentElement.lang==='\(language)' && document.querySelector('#score')?.dataset.value==='9007199254740991'"), loaded as? Bool == true { ready = true; break }
                try await Task.sleep(nanoseconds: 100_000_000)
            }
            XCTAssertTrue(ready)
            _ = try await owner.web.evaluateJavaScript("document.querySelector('#pause').click();true")
            let fits = try await owner.web.evaluateJavaScript("['#score','#best-score','#menu-score','#menu-best'].every(s=>{const e=document.querySelector(s);return e.scrollWidth<=e.clientWidth+1 && e.getBoundingClientRect().right<=innerWidth}) && document.documentElement.scrollWidth<=innerWidth") as? Bool
            XCTAssertEqual(fits, true, "Large scores must not overflow in \(language)")
            let exact = try await owner.web.evaluateJavaScript("document.querySelector('#menu-score').textContent.replace(/[^0-9]/g,'')") as? String
            XCTAssertEqual(exact, "9007199254740991")
            _ = try await owner.web.evaluateJavaScript("document.querySelector('#menu').close();true")
        }
    }
}
