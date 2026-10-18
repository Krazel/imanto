import XCTest
import UIKit
import WebKit
@testable import Imanto

@MainActor final class BoardPressTests: XCTestCase {
    func testFingerPreviewFollowsBoardAndReleasePlacesOnlyOnce() async throws {
        let controller = try XCTUnwrap((UIApplication.shared.delegate as? AppDelegate)?.window?.rootViewController as? GameController)
        controller.loadViewIfNeeded()
        let web = try XCTUnwrap(controller.web)
        var ready = false
        for _ in 0..<600 {
            if let value = try? await web.evaluateJavaScript("document.querySelectorAll('#cells button:not(:disabled)').length>=3 && document.querySelector('#board').getAttribute('aria-busy')==='false'"), value as? Bool == true { ready = true; break }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        XCTAssertTrue(ready); guard ready else { return }
        let setup = """
        (()=>{window.boardPressQA={cells:[...document.querySelectorAll('#cells button:not(:disabled)')].slice(0,3),before:JSON.parse(localStorage.getItem('krazel-imanes-main-v6')).turns};window.boardPressFire=(type,index)=>{const c=boardPressQA.cells[index],r=c.getBoundingClientRect();(type==='pointerdown'?c:document.querySelector('#board')).dispatchEvent(new PointerEvent(type,{pointerId:71,pointerType:'touch',isPrimary:true,button:0,buttons:type==='pointerup'?0:1,bubbles:true,cancelable:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2}));};boardPressFire('pointerdown',0);boardPressFire('pointermove',1);const g=document.querySelector('#preview .ghost');return JSON.stringify({at:Number(boardPressQA.cells[1].dataset.at),row:Number(g.style.getPropertyValue('--row')),col:Number(g.style.getPropertyValue('--col')),turns:JSON.parse(localStorage.getItem('krazel-imanes-main-v6')).turns,before:boardPressQA.before});})()
        """
        let text = try await web.evaluateJavaScript(setup) as! String
        let preview = try JSONSerialization.jsonObject(with: Data(text.utf8)) as! [String: Int]
        let at = try XCTUnwrap(preview["at"])
        XCTAssertEqual(preview["row"], at / 5); XCTAssertEqual(preview["col"], at % 5)
        XCTAssertEqual(preview["turns"], preview["before"], "Sliding only previews; no turn is committed")
        _ = try await web.evaluateJavaScript("boardPressFire('pointerup',1);boardPressFire('pointerup',1);boardPressQA.cells[1].click();true")
        for _ in 0..<600 {
            if let value = try? await web.evaluateJavaScript("document.querySelector('#board').getAttribute('aria-busy')==='false'"), value as? Bool == true { break }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        let after = try await web.evaluateJavaScript("JSON.parse(localStorage.getItem('krazel-imanes-main-v6')).turns") as! Int
        XCTAssertEqual(after, try XCTUnwrap(preview["before"]) + 1)
        _ = try await web.evaluateJavaScript("boardPressQA.cells=[...document.querySelectorAll('#cells button:not(:disabled)')].slice(0,3);boardPressFire('pointerdown',0);boardPressFire('pointermove',1);boardPressFire('pointercancel',1);boardPressFire('pointerup',1);true")
        let cancelled = try await web.evaluateJavaScript("JSON.parse(localStorage.getItem('krazel-imanes-main-v6')).turns") as! Int
        XCTAssertEqual(cancelled, after)
    }
}
