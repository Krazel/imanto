import XCTest
import UIKit
import WebKit
@testable import Imanto

// Deterministic transport/layout checks. No Google traffic or invented StoreKit entitlement.
@MainActor private final class AdFixture: NativeAdProviding {
    weak var owner: GameController?
    var banner: UIView?
    var presentations: [String] = []
    var audioPaused: [Bool] = []
    var initializations = 0
    var consentReady = true
    init(_ owner: GameController) { self.owner = owner }
    func initialize(_ completion: @escaping (Bool) -> Void) { initializations += 1; completion(consentReady) }
    func ready(_ kind: String, completion: @escaping (Bool) -> Void) { completion(true) }
    func available(_ kind: String) -> Bool { true }
    func privacy(_ completion: @escaping (Bool) -> Void) { completion(true) }
    func setBanner(_ visible: Bool, completion: @escaping (Bool) -> Void) {
        banner?.removeFromSuperview(); banner = nil
        guard visible, let owner = owner else { owner?.reserveBannerHeight(0); completion(false); return }
        let view = UIView(); view.backgroundColor = .systemTeal; view.translatesAutoresizingMaskIntoConstraints = false
        let label = UILabel(); label.text = "TEST · BANNER"; label.textColor = .white; label.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(label); owner.view.addSubview(view); banner = view
        NSLayoutConstraint.activate([
            view.leadingAnchor.constraint(equalTo: owner.view.safeAreaLayoutGuide.leadingAnchor),
            view.trailingAnchor.constraint(equalTo: owner.view.safeAreaLayoutGuide.trailingAnchor),
            view.bottomAnchor.constraint(equalTo: owner.view.safeAreaLayoutGuide.bottomAnchor), view.heightAnchor.constraint(equalToConstant: 50),
            label.centerXAnchor.constraint(equalTo: view.centerXAnchor), label.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        ])
        owner.reserveBannerHeight(50); completion(true)
    }
    func show(_ kind: String, onShown: @escaping () -> Void, onEarned: @escaping () -> Void, completion: @escaping (Bool, Bool) -> Void) {
        guard let owner = owner, owner.presentedViewController == nil else { completion(false, false); return }
        let page = UIViewController(); page.view.backgroundColor = .systemTeal; page.modalPresentationStyle = .fullScreen
        presentations.append(kind)
        owner.present(page, animated: false) {
            onShown()
            self.audioPaused.append(!owner.audio.active && owner.ads.fullscreenPresenting)
            if kind == "rewarded" { onEarned() }
            page.dismiss(animated: false) { completion(true, kind == "rewarded") }
        }
    }
}

@MainActor final class AdsIntegrationTests: XCTestCase {
    func testConsentStartsWithoutPrivacyButtonOrAdPlacement() async throws {
        let owner = try await controller(), original = owner.ads, ads = NativeAds(owner: owner)
        let fixture = AdFixture(owner); ads.provider = fixture; owner.ads = ads
        defer { owner.ads = original }
        fixture.consentReady = false
        ads.initializeOnLaunch()
        XCTAssertEqual(fixture.initializations, 1)
        fixture.consentReady = true
        ads.initializeOnLaunch()
        ads.initializeOnLaunch()
        XCTAssertEqual(fixture.initializations, 2, "Retry succeeds and later lifecycle calls do not initialize twice")
        XCTAssertTrue(fixture.presentations.isEmpty, "Consent initialization must not show a fullscreen ad")
        XCTAssertNil(fixture.banner, "Consent initialization must not bypass the free first games")
    }
    private func controller() async throws -> GameController {
        let controller = try XCTUnwrap((UIApplication.shared.delegate as? AppDelegate)?.window?.rootViewController as? GameController)
        for _ in 0..<600 {
            if controller.navigationReady {
                await controller.subscriptions.refresh()
                if !controller.subscriptions.suppressAutomaticAds,
                   let idle = try? await controller.web.evaluateJavaScript("document.querySelector('#board')?.getAttribute('aria-busy')==='false'"), idle as? Bool == true { return controller }
            }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        XCTFail("Game did not load"); return controller
    }
    private func send(_ web: WKWebView, action: String, kind: String, id: String, visible: Bool = false) async throws -> [[String: Any]] {
        _ = try await web.evaluateJavaScript("window.imantoAdQA=[];window.imantoAdQAListener=e=>window.imantoAdQA.push(e.detail);window.addEventListener('imanto-ad-result',window.imantoAdQAListener);window.webkit.messageHandlers.imantoAds.postMessage({action:'\(action)',kind:'\(kind)',requestId:'\(id)',visible:\(visible)});true")
        for _ in 0..<300 {
            let done = try await web.evaluateJavaScript("window.imantoAdQA.some(r=>r.requestId==='\(id)'&&!r.phase)") as? Bool
            if done == true { break }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        let json = try await web.evaluateJavaScript("window.removeEventListener('imanto-ad-result',window.imantoAdQAListener);JSON.stringify(window.imantoAdQA.filter(r=>r.requestId==='\(id)'))") as! String
        return try JSONSerialization.jsonObject(with: Data(json.utf8)) as! [[String: Any]]
    }
    func testBannerUsesSafeAreaWithoutMovingOrResizingTheBoard() async throws {
        let owner = try await controller(), original = owner.ads.provider, fixture = AdFixture(owner)
        owner.ads.provider = fixture
        defer { fixture.setBanner(false, completion: { _ in }); owner.ads.provider = original }
        let originalFrame = owner.web.frame
        let boardProbe = "JSON.stringify(document.querySelector('#board').getBoundingClientRect().toJSON())"
        let originalBoard = try await owner.web.evaluateJavaScript(boardProbe) as! String
        let results = try await send(owner.web, action: "banner", kind: "banner", id: "qa-banner", visible: true)
        XCTAssertEqual(results.last?["shown"] as? Bool, true)
        let banner = try XCTUnwrap(fixture.banner)
        XCTAssertEqual(owner.web.frame, originalFrame, "The banner overlays trailing space without resizing the viewport")
        let bannerBoard = try await owner.web.evaluateJavaScript(boardProbe) as! String
        XCTAssertEqual(bannerBoard, originalBoard, "Ad presentation must not move or shrink the board")
        XCTAssertEqual(banner.frame.maxY, owner.view.safeAreaLayoutGuide.layoutFrame.maxY, accuracy: 1)
        // WKWebView has its own compositor; takeSnapshot avoids a blank GPU backing
        // in UIKit drawHierarchy, then captures the measured native banner below it.
        let gameImage: UIImage = try await withCheckedThrowingContinuation { continuation in
            owner.web.takeSnapshot(with: nil) { image, error in
                if let image = image { continuation.resume(returning: image) }
                else { continuation.resume(throwing: error ?? CocoaError(.fileReadUnknown)) }
            }
        }
        XCTAssertNotNil(banner.superview)
        let renderer = UIGraphicsImageRenderer(bounds: owner.view.bounds)
        let image = renderer.image { context in
            owner.view.backgroundColor?.setFill(); context.cgContext.fill(owner.view.bounds)
            gameImage.draw(in: owner.web.frame)
            context.cgContext.saveGState()
            context.cgContext.translateBy(x: banner.frame.minX, y: banner.frame.minY)
            banner.layer.render(in: context.cgContext)
            context.cgContext.restoreGState()
        }
        try XCTUnwrap(image.pngData()).write(to: FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("imanto-ads-qa.png"))
        _ = try await send(owner.web, action: "banner", kind: "banner", id: "qa-hide")
        XCTAssertNil(fixture.banner)
        XCTAssertEqual(owner.web.frame.maxY, owner.view.safeAreaLayoutGuide.layoutFrame.maxY, accuracy: 1)
    }
    func testFullscreenBridgeSeparatesPresentationRewardAndDismissal() async throws {
        let owner = try await controller(), original = owner.ads.provider, fixture = AdFixture(owner)
        owner.ads.provider = fixture
        defer { owner.ads.provider = original }
        for kind in ["interstitial", "rewarded"] {
            let available = try await send(owner.web, action: "available", kind: kind, id: "qa-cache-\(kind)")
            XCTAssertEqual(available.last?["ready"] as? Bool, true)
            let results = try await send(owner.web, action: "show", kind: kind, id: "qa-show-\(kind)")
            XCTAssertEqual(results.first?["phase"] as? String, "shown")
            XCTAssertEqual(results.filter { $0["phase"] as? String == "earned" }.count, kind == "rewarded" ? 1 : 0)
            XCTAssertEqual(results.last?["shown"] as? Bool, true)
            XCTAssertEqual(results.last?["earned"] as? Bool, kind == "rewarded")
            XCTAssertNil(owner.presentedViewController)
            XCTAssertFalse(owner.ads.fullscreenPresenting)
            XCTAssertTrue(owner.audio.active)
        }
        XCTAssertEqual(fixture.presentations, ["interstitial", "rewarded"])
        XCTAssertEqual(fixture.audioPaused, [true, true])
    }
}
