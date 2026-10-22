import UIKit
import WebKit

// Independent native gate: changing JavaScript or a URL cannot activate ads.
struct AdConfiguration {
    let banner = true
    let interstitial = true
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

@MainActor protocol NativeAdProviding: AnyObject {
    func initialize(_ completion: @escaping (Bool) -> Void)
    func ready(_ kind: String, completion: @escaping (Bool) -> Void)
    func available(_ kind: String) -> Bool
    func show(_ kind: String, onShown: @escaping () -> Void, onEarned: @escaping () -> Void, completion: @escaping (Bool, Bool) -> Void)
    func setBanner(_ visible: Bool, completion: @escaping (Bool) -> Void)
    func privacy(_ completion: @escaping (Bool) -> Void)
    func updateLayout()
}
extension NativeAdProviding { func updateLayout() {} ; func initialize(_ completion: @escaping (Bool) -> Void) { completion(false) } }
@MainActor final class NativeAds {
    weak var owner: GameController?
    let config = AdConfiguration()
    private(set) var fullscreenPresenting = false
    var provider: NativeAdProviding?
    private var initializing = false
    private var initialized = false
    private var retry: DispatchWorkItem?
    private var attempts = 0
    init(owner: GameController) {
        self.owner = owner
        #if canImport(GoogleMobileAds) && canImport(UserMessagingPlatform)
        #if DEBUG
        // Native transport tests install a deterministic provider; never contact Google.
        if ProcessInfo.processInfo.environment["IMANTO_NATIVE_TESTS"] != "1" { provider = GoogleAdProvider(owner: owner) }
        #else
        provider = GoogleAdProvider(owner: owner)
        #endif
        #endif
    }
    func initializeOnLaunch(resetRetries: Bool = false) {
        if resetRetries { attempts = 0 }
        guard !initialized, !initializing, config.enabled("privacy"),
              let owner = owner, owner.navigationReady, owner.viewIfLoaded?.window != nil,
              owner.presentedViewController == nil, UIApplication.shared.applicationState == .active,
              let provider = provider else { return }
        retry?.cancel(); retry = nil; initializing = true; attempts += 1
        provider.initialize { [weak self] allowed in
            guard let self = self else { return }
            self.initializing = false; self.initialized = allowed
            if allowed {
                self.owner?.web.evaluateJavaScript("window.dispatchEvent(new Event('imanto-ads-initialized'))", completionHandler: nil)
            } else if self.attempts < 3 {
                let work = DispatchWorkItem { [weak self] in self?.initializeOnLaunch() }
                self.retry = work; DispatchQueue.main.asyncAfter(deadline: .now() + 15, execute: work)
            }
        }
    }
    private func setFullscreen(_ visible: Bool) {
        fullscreenPresenting = visible
        let active = UIApplication.shared.applicationState == .active && !visible
        owner?.haptics.active = active; owner?.audio.active = active
        if visible { owner?.audio.pause() } else { owner?.audio.reconcile() }
    }
    func updateLayout() { provider?.updateLayout() }
    func hideBanner() { provider?.setBanner(false, completion: { _ in }); owner?.reserveBannerHeight(0) }
    func receive(_ body: [String: Any]) {
        guard let id = body["requestId"] as? String, id.count < 100,
              let kind = body["kind"] as? String, let action = body["action"] as? String else { return }
        let reply: ([String: Any]) -> Void = { [weak self] values in
            var result = values; result["requestId"] = id
            guard let data = try? JSONSerialization.data(withJSONObject: result),
                  let json = String(data: data, encoding: .utf8) else { return }
            self?.owner?.web.evaluateJavaScript("window.dispatchEvent(new CustomEvent('imanto-ad-result',{detail:\(json)}))", completionHandler: nil)
        }
        // Entitlements are resolved on launch/foreground and Transaction.updates.
        // Cached availability must never wait for a network request between games.
        if (kind == "banner" || kind == "interstitial"), owner?.subscriptions.suppressAutomaticAds == true {
            hideBanner(); reply(["ready": false, "shown": false, "earned": false]); return
        }
        guard config.enabled(kind), UIApplication.shared.applicationState == .active, let provider = provider else {
            reply(["ready": false, "shown": false, "earned": false]); return
        }
        if action == "show", fullscreenPresenting { reply(["shown": false, "earned": false]); return }
        switch action {
        case "ready": provider.ready(kind, completion: { reply(["ready": $0]) })
        case "available": reply(["ready": provider.available(kind)])
        case "show": provider.show(kind, onShown: { [weak self] in self?.setFullscreen(true); reply(["phase": "shown", "shown": true]) }, onEarned: { reply(["phase": "earned", "shown": true, "earned": true]) }, completion: { [weak self] shown, earned in self?.setFullscreen(false); reply(["shown": shown, "earned": earned]) })
        case "banner": provider.setBanner(body["visible"] as? Bool == true, completion: { reply(["shown": $0]) })
        case "privacy": provider.privacy { reply(["complete": $0]) }
        default: reply(["ready": false, "shown": false, "earned": false])
        }
    }
}

#if canImport(GoogleMobileAds) && canImport(UserMessagingPlatform)
import GoogleMobileAds
import UserMessagingPlatform

// Real units are provisioned in AdMob. Beta always uses official Google demo inventory.
// Commercial rollout remains gated off until an App Store release is authorized.
struct AdUnitIDs {
    #if DEBUG || IMANTO_TESTFLIGHT
    static let banner = "ca-app-pub-3940256099942544/2435281174"
    static let interstitial = "ca-app-pub-3940256099942544/4411468910"
    static let rewarded = "ca-app-pub-3940256099942544/1712485313"
    #else
    static let banner = "ca-app-pub-3425091654264901/9778431363"
    static let interstitial = "ca-app-pub-3425091654264901/8321704454"
    static let rewarded = "ca-app-pub-3425091654264901/9990929215"
    #endif
}
@MainActor final class GoogleAdProvider: NSObject, NativeAdProviding, FullScreenContentDelegate, BannerViewDelegate {
    weak var owner: GameController?
    private var started = false
    private let consentPreparation = ConsentPreparation()
    private var preparing: Bool { consentPreparation.running }
    private var interstitial: InterstitialAd?
    private var rewarded: RewardedAd?
    private var loadedAt: [String: Date] = [:]
    private var banner: BannerView?
    private var bannerWanted = false
    private var bannerWidth: CGFloat = 0
    private var consentGeneration = 0
    private var onShown: (() -> Void)?
    private var loading = Set<String>()
    private var bannerCompletion: ((Bool) -> Void)?
    private var fullscreenCompletion: ((Bool, Bool) -> Void)?
    private var onEarned: (() -> Void)?
    private var shown = false, earned = false
    init(owner: GameController?) { self.owner = owner }
    private func prepare(_ completion: @escaping (Bool) -> Void) {
        if started { completion(ConsentInformation.shared.canRequestAds); return }
        consentPreparation.run({ [weak self] finish in
            guard let self = self, let owner = self.owner, self.mayPresentConsent else { finish(false); return }
            ConsentInformation.shared.requestConsentInfoUpdate(with: RequestParameters()) { [weak self] error in
                guard let self = self, error == nil, self.mayPresentConsent else { finish(false); return }
                let start: (Error?) -> Void = { [weak self] error in
                    guard let self = self, error == nil, ConsentInformation.shared.canRequestAds else { finish(false); return }
                    MobileAds.shared.start { [weak self] _ in self?.started = true; finish(true) }
                }
                if ConsentInformation.shared.consentStatus == .required {
                    // Like Tarot: check again after loading, before presenting a late form.
                    ConsentForm.load { [weak self] form, error in
                        guard let self = self, error == nil, let form = form, self.mayPresentConsent else { finish(false); return }
                        form.present(from: owner, completionHandler: start)
                    }
                } else { start(nil) }
            }
        }, completion: completion)
    }
    private var mayPresentConsent: Bool {
        guard let owner = owner else { return false }
        return owner.viewIfLoaded?.window != nil && owner.presentedViewController == nil && UIApplication.shared.applicationState == .active && fullscreenCompletion == nil
    }
    func initialize(_ completion: @escaping (Bool) -> Void) {
        prepare(completion)
    }
    private func request() -> Request {
        let request = Request(), extras = Extras()
        extras.additionalParameters = ["npa": "1"]
        request.register(extras); return request
    }
    func privacy(_ completion: @escaping (Bool) -> Void) {
        guard let owner = owner, fullscreenCompletion == nil, !preparing else { completion(false); return }
        if !started { prepare(completion); return }
        consentGeneration += 1
        interstitial = nil; rewarded = nil; loadedAt.removeAll()
        setBanner(false, completion: { _ in })
        guard ConsentInformation.shared.privacyOptionsRequirementStatus == .required else { completion(true); return }
        ConsentForm.presentPrivacyOptionsForm(from: owner) { error in completion(error == nil) }
    }
    func available(_ kind: String) -> Bool {
        guard ConsentInformation.shared.canRequestAds, fullscreenCompletion == nil,
              let date = loadedAt[kind], Date().timeIntervalSince(date) < 3500 else { return false }
        return kind == "interstitial" ? interstitial != nil : kind == "rewarded" && rewarded != nil
    }
    func ready(_ kind: String, completion: @escaping (Bool) -> Void) {
        guard !loading.contains(kind) else { completion(false); return }
        loading.insert(kind)
        prepare { [weak self] allowed in
            guard let self = self else { completion(false); return }
            guard allowed, self.fullscreenCompletion == nil else { self.loading.remove(kind); completion(false); return }
            if let date = self.loadedAt[kind], Date().timeIntervalSince(date) > 3500 {
                if kind == "interstitial" { self.interstitial = nil } else { self.rewarded = nil }
            }
            let generation = self.consentGeneration
            if kind == "interstitial" {
                if self.interstitial != nil { self.loading.remove(kind); completion(true); return }
                InterstitialAd.load(with: AdUnitIDs.interstitial, request: self.request()) { [weak self] ad, _ in
                    guard let self = self else { completion(false); return }
                    self.loading.remove(kind)
                    guard generation == self.consentGeneration, ConsentInformation.shared.canRequestAds else { completion(false); return }
                    self.interstitial = ad; ad?.fullScreenContentDelegate = self
                    if ad != nil { self.loadedAt[kind] = Date() }; completion(ad != nil)
                }
            } else if kind == "rewarded" {
                if self.rewarded != nil { self.loading.remove(kind); completion(true); return }
                RewardedAd.load(with: AdUnitIDs.rewarded, request: self.request()) { [weak self] ad, _ in
                    guard let self = self else { completion(false); return }
                    self.loading.remove(kind)
                    guard generation == self.consentGeneration, ConsentInformation.shared.canRequestAds else { completion(false); return }
                    self.rewarded = ad; ad?.fullScreenContentDelegate = self
                    if ad != nil { self.loadedAt[kind] = Date() }; completion(ad != nil)
                }
            } else { self.loading.remove(kind); completion(false) }
        }
    }
    func show(_ kind: String, onShown: @escaping () -> Void, onEarned: @escaping () -> Void, completion: @escaping (Bool, Bool) -> Void) {
        guard ConsentInformation.shared.canRequestAds, let owner = owner,
              owner.presentedViewController == nil, UIApplication.shared.applicationState == .active,
              fullscreenCompletion == nil else { completion(false, false); return }
        guard let date = loadedAt[kind], Date().timeIntervalSince(date) < 3500 else { completion(false, false); return }
        guard (kind == "rewarded" && rewarded != nil) || (kind == "interstitial" && interstitial != nil) else { completion(false, false); return }
        fullscreenCompletion = completion; self.onShown = onShown; self.onEarned = onEarned; shown = false; earned = false
        if kind == "rewarded", let ad = rewarded {
            rewarded = nil
            ad.present(from: owner) { [weak self] in
                guard let self = self, !self.earned else { return }
                self.earned = true; self.shown = true; self.onEarned?()
            }
        } else if let ad = interstitial { interstitial = nil; ad.present(from: owner) }
    }
    func adWillPresentFullScreenContent(_ ad: FullScreenPresentingAd) { shown = true; onShown?(); onShown = nil }
    func adDidDismissFullScreenContent(_ ad: FullScreenPresentingAd) { finish() }
    func ad(_ ad: FullScreenPresentingAd, didFailToPresentFullScreenContentWithError error: Error) { finish() }
    private func finish() {
        let completion = fullscreenCompletion; fullscreenCompletion = nil; onShown = nil; onEarned = nil
        completion?(shown, earned)
    }
    func updateLayout() {
        guard bannerWanted, banner != nil, let owner = owner,
              abs(owner.view.safeAreaLayoutGuide.layoutFrame.width - bannerWidth) > 1 else { return }
        setBanner(false, completion: { _ in }); setBanner(true, completion: { _ in })
    }
    func setBanner(_ visible: Bool, completion: @escaping (Bool) -> Void) {
        bannerWanted = visible
        if !visible { banner?.removeFromSuperview(); banner = nil; owner?.reserveBannerHeight(0); bannerCompletion?(false); bannerCompletion = nil; completion(false); return }
        if banner != nil { completion(true); return }
        prepare { [weak self] allowed in
            guard let self = self, allowed, self.bannerWanted, self.banner == nil, let owner = self.owner,
                  !owner.subscriptions.suppressAutomaticAds else { completion(false); return }
            // A compact anchored adaptive banner; safe-area space is reserved only after load.
            self.bannerWidth = owner.view.safeAreaLayoutGuide.layoutFrame.width
            let size = currentOrientationAnchoredAdaptiveBanner(width: self.bannerWidth)
            let banner = BannerView(adSize: size)
            banner.adUnitID = AdUnitIDs.banner
            banner.rootViewController = owner; banner.delegate = self
            self.banner = banner; self.bannerCompletion = completion
            banner.translatesAutoresizingMaskIntoConstraints = false; banner.isHidden = true; owner.view.addSubview(banner)
            NSLayoutConstraint.activate([banner.centerXAnchor.constraint(equalTo: owner.view.centerXAnchor), banner.bottomAnchor.constraint(equalTo: owner.view.safeAreaLayoutGuide.bottomAnchor)])
            banner.load(self.request())
        }
    }
    func bannerViewDidRecordImpression(_ bannerView: BannerView) {
        guard bannerView === banner, bannerWanted else { return }
        owner?.web.evaluateJavaScript("window.dispatchEvent(new Event('imanto-banner-impression'))", completionHandler: nil)
    }
    func bannerViewDidReceiveAd(_ bannerView: BannerView) {
        guard bannerView === banner else { bannerView.removeFromSuperview(); return }
        guard bannerWanted, owner?.subscriptions.suppressAutomaticAds != true else {
            setBanner(false, completion: { _ in }); return
        }
        bannerView.isHidden = false; owner?.reserveBannerHeight(bannerView.adSize.size.height)
        bannerCompletion?(true); bannerCompletion = nil
    }
    func bannerView(_ bannerView: BannerView, didFailToReceiveAdWithError error: Error) {
        guard bannerView === banner else { return }
        bannerView.removeFromSuperview(); banner = nil; owner?.reserveBannerHeight(0)
        bannerCompletion?(false); bannerCompletion = nil
    }
}
#endif
