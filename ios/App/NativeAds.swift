import UIKit
import WebKit

// Independent native gate: changing JavaScript or a URL cannot activate ads.
struct AdConfiguration {
    let banner = false
    let interstitial = false
    #if DEBUG || IMANTO_TESTFLIGHT
    let rewarded = true
    #else
    let rewarded = false
    #endif
    // Must be deliberately approved after IDs, privacy and native QA are ready.
    #if DEBUG || IMANTO_TESTFLIGHT
    let rolloutApproved = true
    #else
    let rolloutApproved = false
    #endif
    func enabled(_ kind: String) -> Bool {
        guard rolloutApproved else { return false }
        switch kind { case "banner": return banner; case "interstitial": return interstitial; case "rewarded": return rewarded; case "privacy": return banner || interstitial || rewarded; default: return false }
    }
}

@MainActor final class NativeAds {
    weak var owner: GameController?
    let config = AdConfiguration()
    #if canImport(GoogleMobileAds) && canImport(UserMessagingPlatform)
    private lazy var provider = GoogleAdProvider(owner: owner)
    #endif
    init(owner: GameController) { self.owner = owner }
    func hideBanner() {
        #if canImport(GoogleMobileAds) && canImport(UserMessagingPlatform)
        provider.setBanner(false, completion: { _ in })
        #endif
        owner?.reserveBannerHeight(0)
    }
    func receive(_ body: [String: Any]) {
        Task { [weak self] in
            guard let self = self else { return }
            await self.owner?.subscriptions.refresh()
            self.receiveResolved(body)
        }
    }
    private func receiveResolved(_ body: [String: Any]) {
        guard let id = body["requestId"] as? String, id.count < 100,
              let kind = body["kind"] as? String, let action = body["action"] as? String else { return }
        let reply: ([String: Any]) -> Void = { [weak self] values in
            var result = values; result["requestId"] = id
            guard let data = try? JSONSerialization.data(withJSONObject: result),
                  let json = String(data: data, encoding: .utf8) else { return }
            self?.owner?.web.evaluateJavaScript("window.dispatchEvent(new CustomEvent('imanto-ad-result',{detail:\(json)}))", completionHandler: nil)
        }
        if (kind == "banner" || kind == "interstitial"), owner?.subscriptions.suppressAutomaticAds == true {
            hideBanner(); reply(["ready": false, "shown": false, "earned": false]); return
        }
        guard config.enabled(kind), UIApplication.shared.applicationState == .active else {
            reply(["ready": false, "shown": false, "earned": false]); return
        }
        #if canImport(GoogleMobileAds) && canImport(UserMessagingPlatform)
        switch action {
        case "ready": provider.ready(kind, completion: { reply(["ready": $0]) })
        case "show": provider.show(kind, onEarned: { reply(["phase": "earned", "shown": true, "earned": true]) }, completion: { shown, earned in reply(["shown": shown, "earned": earned]) })
        case "banner": provider.setBanner(body["visible"] as? Bool == true, completion: { reply(["shown": $0]) })
        case "privacy": provider.privacy { reply(["complete": $0]) }
        default: reply(["ready": false, "shown": false, "earned": false])
        }
        #else
        reply(["ready": false, "shown": false, "earned": false])
        #endif
    }
}

#if canImport(GoogleMobileAds) && canImport(UserMessagingPlatform)
import GoogleMobileAds
import UserMessagingPlatform

// Included only by project.ads.yml. Official Google test inventory, never live IDs.
@MainActor final class GoogleAdProvider: NSObject, FullScreenContentDelegate, BannerViewDelegate {
    weak var owner: GameController?
    private var started = false
    private var preparing = false
    private var interstitial: InterstitialAd?
    private var rewarded: RewardedAd?
    private var loadedAt: [String: Date] = [:]
    private var banner: BannerView?
    private var bannerCompletion: ((Bool) -> Void)?
    private var fullscreenCompletion: ((Bool, Bool) -> Void)?
    private var onEarned: (() -> Void)?
    private var shown = false, earned = false
    init(owner: GameController?) { self.owner = owner }
    private func prepare(_ completion: @escaping (Bool) -> Void) {
        guard let owner = owner, !preparing else { completion(false); return }
        if started { completion(ConsentInformation.shared.canRequestAds); return }
        preparing = true
        ConsentInformation.shared.requestConsentInfoUpdate(with: RequestParameters()) { [weak self] error in
            guard let self = self else { completion(false); return }
            guard error == nil else { self.preparing = false; completion(false); return }
            ConsentForm.loadAndPresentIfRequired(from: owner) { [weak self] error in
                guard let self = self else { completion(false); return }
                guard error == nil, ConsentInformation.shared.canRequestAds else { self.preparing = false; completion(false); return }
                MobileAds.shared.start { [weak self] _ in
                    self?.started = true; self?.preparing = false; completion(true)
                }
            }
        }
    }
    private func request() -> Request {
        let request = Request(), extras = Extras()
        extras.additionalParameters = ["npa": "1"]
        request.register(extras); return request
    }
    func privacy(_ completion: @escaping (Bool) -> Void) {
        guard let owner = owner, started, fullscreenCompletion == nil else { completion(false); return }
        interstitial = nil; rewarded = nil; loadedAt.removeAll()
        banner?.removeFromSuperview(); banner = nil; owner.reserveBannerHeight(0)
        guard ConsentInformation.shared.privacyOptionsRequirementStatus == .required else { completion(true); return }
        ConsentForm.presentPrivacyOptionsForm(from: owner) { error in completion(error == nil) }
    }
    func ready(_ kind: String, completion: @escaping (Bool) -> Void) {
        prepare { [weak self] allowed in
            guard let self = self, allowed, self.fullscreenCompletion == nil else { completion(false); return }
            if let date = self.loadedAt[kind], Date().timeIntervalSince(date) > 3500 {
                if kind == "interstitial" { self.interstitial = nil } else { self.rewarded = nil }
            }
            if kind == "interstitial" {
                if self.interstitial != nil { completion(true); return }
                InterstitialAd.load(with: "ca-app-pub-3940256099942544/4411468910", request: self.request()) { [weak self] ad, _ in
                    self?.interstitial = ad; ad?.fullScreenContentDelegate = self
                    if ad != nil { self?.loadedAt[kind] = Date() }; completion(ad != nil)
                }
            } else if kind == "rewarded" {
                if self.rewarded != nil { completion(true); return }
                RewardedAd.load(with: "ca-app-pub-3940256099942544/1712485313", request: self.request()) { [weak self] ad, _ in
                    self?.rewarded = ad; ad?.fullScreenContentDelegate = self
                    if ad != nil { self?.loadedAt[kind] = Date() }; completion(ad != nil)
                }
            } else { completion(false) }
        }
    }
    func show(_ kind: String, onEarned: @escaping () -> Void, completion: @escaping (Bool, Bool) -> Void) {
        guard ConsentInformation.shared.canRequestAds, let owner = owner,
              owner.presentedViewController == nil, UIApplication.shared.applicationState == .active,
              fullscreenCompletion == nil else { completion(false, false); return }
        guard let date = loadedAt[kind], Date().timeIntervalSince(date) < 3500 else { completion(false, false); return }
        guard (kind == "rewarded" && rewarded != nil) || (kind == "interstitial" && interstitial != nil) else { completion(false, false); return }
        fullscreenCompletion = completion; self.onEarned = onEarned; shown = false; earned = false
        if kind == "rewarded", let ad = rewarded {
            rewarded = nil
            ad.present(from: owner) { [weak self] in
                guard let self = self, !self.earned else { return }
                self.earned = true; self.shown = true; self.onEarned?()
            }
        } else if let ad = interstitial { interstitial = nil; ad.present(from: owner) }
    }
    func adWillPresentFullScreenContent(_ ad: FullScreenPresentingAd) { shown = true }
    func adDidDismissFullScreenContent(_ ad: FullScreenPresentingAd) { finish() }
    func ad(_ ad: FullScreenPresentingAd, didFailToPresentFullScreenContentWithError error: Error) { finish() }
    private func finish() {
        let completion = fullscreenCompletion; fullscreenCompletion = nil; onEarned = nil
        completion?(shown, earned)
    }
    func setBanner(_ visible: Bool, completion: @escaping (Bool) -> Void) {
        if !visible { banner?.removeFromSuperview(); banner = nil; owner?.reserveBannerHeight(0); bannerCompletion?(false); bannerCompletion = nil; completion(false); return }
        if banner != nil { completion(true); return }
        prepare { [weak self] allowed in
            guard let self = self, allowed, let owner = self.owner,
                  !owner.subscriptions.suppressAutomaticAds else { completion(false); return }
            // A compact anchored adaptive banner; safe-area space is reserved only after load.
            let size = currentOrientationAnchoredAdaptiveBanner(width: owner.view.safeAreaLayoutGuide.layoutFrame.width)
            let banner = BannerView(adSize: size)
            banner.adUnitID = "ca-app-pub-3940256099942544/2934735716"
            banner.rootViewController = owner; banner.delegate = self
            self.banner = banner; self.bannerCompletion = completion
            banner.translatesAutoresizingMaskIntoConstraints = false; banner.isHidden = true; owner.view.addSubview(banner)
            NSLayoutConstraint.activate([banner.centerXAnchor.constraint(equalTo: owner.view.centerXAnchor), banner.bottomAnchor.constraint(equalTo: owner.view.safeAreaLayoutGuide.bottomAnchor)])
            banner.load(self.request())
        }
    }
    func bannerViewDidReceiveAd(_ bannerView: BannerView) {
        guard bannerView === banner, owner?.subscriptions.suppressAutomaticAds != true else {
            bannerView.removeFromSuperview(); owner?.reserveBannerHeight(0); bannerCompletion?(false); bannerCompletion = nil; return
        }
        bannerView.isHidden = false; owner?.reserveBannerHeight(bannerView.adSize.size.height)
        bannerCompletion?(true); bannerCompletion = nil
    }
    func bannerView(_ bannerView: BannerView, didFailToReceiveAdWithError error: Error) {
        bannerView.isHidden = true; owner?.reserveBannerHeight(0)
        bannerCompletion?(false); bannerCompletion = nil
    }
}
#endif
