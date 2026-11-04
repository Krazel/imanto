import UIKit
import WebKit

// Independent native gate: changing JavaScript or a URL cannot activate ads.
struct AdConfiguration {
    let banner = true
    let interstitial = true
    let rewarded = true
    func enabled(_ kind: String) -> Bool {
        guard AdInventory.enabled(bundleMode: Bundle.main.object(forInfoDictionaryKey: "ImantoAdsMode") as? String) else { return false }
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
    func privacyState() -> [String: Bool]
    func applicationDidEnterBackground()
    func updateLayout()
}
extension NativeAdProviding {
    func updateLayout() {}
    func initialize(_ completion: @escaping (Bool) -> Void) { completion(false) }
    func privacyState() -> [String: Bool] { ["required": true, "busy": false, "retry": false] }
    func applicationDidEnterBackground() {}
}
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
        if resetRetries, !initializing { attempts = 0; initialized = false }
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
    func applicationDidEnterBackground() {
        initialized = false
        retry?.cancel(); retry = nil
        provider?.applicationDidEnterBackground()
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
        case "status": reply(provider.privacyState())
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

// The destination-specific inventory also guards against a mismatched packaged plist.
struct AdUnitIDs {
    static let banner = AdInventory.banner
    static let interstitial = AdInventory.interstitial
    static let rewarded = AdInventory.rewarded
}
@MainActor final class GoogleAdProvider: NSObject, NativeAdProviding, FullScreenContentDelegate, BannerViewDelegate {
    weak var owner: GameController?
    private var started = false
    private var starting = false
    private var startWaiters: [(Bool) -> Void] = []
    private let consent = AdConsentState()
    private let consentPreparation = ConsentPreparation()
    private var preparing: Bool { consentPreparation.running }
    private var interstitial: InterstitialAd?
    private var rewarded: RewardedAd?
    private var loadedAt: [String: Date] = [:]
    private var banner: BannerView?
    private var bannerWanted = false
    private var bannerWidth: CGFloat = 0
    private var onShown: (() -> Void)?
    private var loading: [String: Int] = [:]
    private var bannerCompletion: ((Bool) -> Void)?
    private var fullscreenCompletion: ((Bool, Bool) -> Void)?
    private var onEarned: (() -> Void)?
    private var shown = false, earned = false
    init(owner: GameController?) { self.owner = owner }
    private var mayRequestAds: Bool {
        consent.permitsAds(umpCanRequestAds: ConsentInformation.shared.canRequestAds)
    }
    private func publishPrivacyState() {
        guard let data = try? JSONSerialization.data(withJSONObject: privacyState()),
              let json = String(data: data, encoding: .utf8) else { return }
        owner?.web.evaluateJavaScript("window.dispatchEvent(new CustomEvent('imanto-ad-privacy-state',{detail:\(json)}))", completionHandler: nil)
    }
    func privacyState() -> [String: Bool] {
        ["required": ConsentInformation.shared.privacyOptionsRequirementStatus == .required,
         "busy": preparing || consent.updating,
         "retry": consent.failed,
         "canRequestAds": mayRequestAds]
    }
    private func retireAds(preserveBannerIntent: Bool = false) {
        let wanted = bannerWanted
        interstitial = nil; rewarded = nil; loadedAt.removeAll(); loading.removeAll()
        setBanner(false, completion: { _ in })
        if preserveBannerIntent { bannerWanted = wanted }
    }
    func applicationDidEnterBackground() {
        consent.invalidate(); retireAds(); publishPrivacyState()
    }
    private func startSDK(_ completion: @escaping (Bool) -> Void) {
        guard mayRequestAds else { completion(false); return }
        // No publisher-wide NPA/PPT/RDP override. GMA still applies UMP/TCF/GPP
        // and Apple's permission; default does not force personalization.
        MobileAds.shared.requestConfiguration.publisherPrivacyPersonalizationState = .default
        if started { completion(true); return }
        startWaiters.append(completion)
        guard !starting else { return }
        starting = true
        MobileAds.shared.start { [weak self] _ in
            guard let self = self else { return }
            self.started = true; self.starting = false
            let callbacks = self.startWaiters; self.startWaiters.removeAll()
            callbacks.forEach { $0(self.mayRequestAds) }
        }
    }
    private func prepare(_ completion: @escaping (Bool) -> Void) {
        if consent.resolved { completion(mayRequestAds); return }
        if consent.failed && !preparing { completion(false); return }
        consentPreparation.run({ [weak self] finish in
            guard let self = self, let owner = self.owner, self.mayPresentConsent else { finish(false); return }
            let ticket = self.consent.begin()
            self.retireAds(preserveBannerIntent: true); self.publishPrivacyState()
            let resolve: (Bool) -> Void = { [weak self] succeeded in
                guard let self = self else { finish(false); return }
                guard ticket == self.consent.generation else { finish(false); return }
                guard self.consent.updating else { return }
                let allowed = self.consent.finish(ticket, allowed: ConsentInformation.shared.canRequestAds, succeeded: succeeded)
                self.publishPrivacyState()
                if allowed { self.startSDK { finish($0) } } else { finish(false) }
            }
            ConsentInformation.shared.requestConsentInfoUpdate(with: RequestParameters()) { [weak self] error in
                guard let self = self, error == nil, self.mayPresentConsent, ticket == self.consent.generation else { resolve(false); return }
                let start: (Error?) -> Void = { [weak self] error in
                    guard let self = self else { resolve(false); return }
                    resolve(error == nil && UIApplication.shared.applicationState == .active && ticket == self.consent.generation)
                }
                if ConsentInformation.shared.consentStatus == .required {
                    // UMP owns the regional/ATT sequence. Never call ATT merely
                    // because canRequestAds is true, or reset a user's choices.
                    ConsentForm.load { [weak self] form, error in
                        guard let self = self, error == nil, let form = form, self.mayPresentConsent, ticket == self.consent.generation else { resolve(false); return }
                        form.present(from: owner, completionHandler: start)
                    }
                } else { start(nil) }
            }
        }, completion: { [weak self] allowed in self?.publishPrivacyState(); completion(allowed) })
    }
    private var mayPresentConsent: Bool {
        guard let owner = owner else { return false }
        return owner.viewIfLoaded?.window != nil && owner.presentedViewController == nil && UIApplication.shared.applicationState == .active && fullscreenCompletion == nil
    }
    func initialize(_ completion: @escaping (Bool) -> Void) {
        // Foreground refresh is separate from the SDK's once-only initialization.
        guard !preparing else { completion(false); return }
        consent.invalidate(); retireAds()
        prepare(completion)
    }
    private func request() -> Request {
        Request()
    }
    func privacy(_ completion: @escaping (Bool) -> Void) {
        guard let owner = owner, fullscreenCompletion == nil, !preparing else { completion(false); return }
        guard mayPresentConsent else { completion(false); return }
        consent.invalidate(); retireAds()
        consentPreparation.run({ [weak self] finish in
            guard let self = self else { finish(false); return }
            let ticket = self.consent.begin(); self.publishPrivacyState()
            let resolve: (Error?) -> Void = { [weak self] error in
                guard let self = self else { finish(false); return }
                guard ticket == self.consent.generation else { finish(false); return }
                guard self.consent.updating else { return }
                let succeeded = error == nil && ticket == self.consent.generation && UIApplication.shared.applicationState == .active
                self.retireAds()
                _ = self.consent.finish(ticket, allowed: ConsentInformation.shared.canRequestAds, succeeded: succeeded)
                // Completion means choices were resolved, including a refusal.
                // Starting GMA remains conditional on the applicable UMP ad mode.
                if self.mayRequestAds { self.startSDK { _ in finish(succeeded) } }
                else { finish(succeeded) }
            }
            ConsentInformation.shared.requestConsentInfoUpdate(with: RequestParameters()) { [weak self] error in
                guard let self = self else { finish(false); return }
                guard error == nil, ticket == self.consent.generation, self.mayPresentConsent else {
                    resolve(error ?? NSError(domain: "ImantoConsent", code: 1)); return
                }
                if ConsentInformation.shared.consentStatus == .required {
                    ConsentForm.load { [weak self] form, error in
                        guard let self = self, error == nil, let form = form, self.mayPresentConsent, ticket == self.consent.generation else {
                            resolve(error ?? NSError(domain: "ImantoConsent", code: 2)); return
                        }
                        form.present(from: owner, completionHandler: resolve)
                    }
                } else if ConsentInformation.shared.privacyOptionsRequirementStatus == .required {
                    ConsentForm.presentPrivacyOptionsForm(from: owner, completionHandler: resolve)
                } else { resolve(nil) }
            }
        }, completion: { [weak self] complete in self?.publishPrivacyState(); completion(complete) })
    }
    func available(_ kind: String) -> Bool {
        guard mayRequestAds, !preparing, fullscreenCompletion == nil,
              let date = loadedAt[kind], Date().timeIntervalSince(date) < 3500 else { return false }
        return kind == "interstitial" ? interstitial != nil : kind == "rewarded" && rewarded != nil
    }
    func ready(_ kind: String, completion: @escaping (Bool) -> Void) {
        guard !preparing, !consent.updating, loading[kind] == nil else { completion(false); return }
        prepare { [weak self] allowed in
            guard let self = self else { completion(false); return }
            guard allowed, self.mayRequestAds, self.fullscreenCompletion == nil, self.loading[kind] == nil else { completion(false); return }
            if let date = self.loadedAt[kind], Date().timeIntervalSince(date) > 3500 {
                if kind == "interstitial" { self.interstitial = nil } else { self.rewarded = nil }
            }
            let generation = self.consent.generation
            self.loading[kind] = generation
            if kind == "interstitial" {
                if self.interstitial != nil { self.loading.removeValue(forKey: kind); completion(true); return }
                InterstitialAd.load(with: AdUnitIDs.interstitial, request: self.request()) { [weak self] ad, _ in
                    guard let self = self else { completion(false); return }
                    if self.loading[kind] == generation { self.loading.removeValue(forKey: kind) }
                    guard self.consent.accepts(generation, umpCanRequestAds: ConsentInformation.shared.canRequestAds) else { completion(false); return }
                    self.interstitial = ad; ad?.fullScreenContentDelegate = self
                    if ad != nil { self.loadedAt[kind] = Date() }; completion(ad != nil)
                }
            } else if kind == "rewarded" {
                if self.rewarded != nil { self.loading.removeValue(forKey: kind); completion(true); return }
                RewardedAd.load(with: AdUnitIDs.rewarded, request: self.request()) { [weak self] ad, _ in
                    guard let self = self else { completion(false); return }
                    if self.loading[kind] == generation { self.loading.removeValue(forKey: kind) }
                    guard self.consent.accepts(generation, umpCanRequestAds: ConsentInformation.shared.canRequestAds) else { completion(false); return }
                    self.rewarded = ad; ad?.fullScreenContentDelegate = self
                    if ad != nil { self.loadedAt[kind] = Date() }; completion(ad != nil)
                }
            } else { self.loading.removeValue(forKey: kind); completion(false) }
        }
    }
    func show(_ kind: String, onShown: @escaping () -> Void, onEarned: @escaping () -> Void, completion: @escaping (Bool, Bool) -> Void) {
        guard mayRequestAds, !preparing, let owner = owner,
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
        if visible && (preparing || consent.updating) { completion(false); return }
        bannerWanted = visible
        if !visible { banner?.removeFromSuperview(); banner = nil; owner?.reserveBannerHeight(0); bannerCompletion?(false); bannerCompletion = nil; completion(false); return }
        if banner != nil { completion(mayRequestAds); return }
        prepare { [weak self] allowed in
            guard let self = self, allowed, self.mayRequestAds, self.bannerWanted, self.banner == nil, let owner = self.owner,
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
        guard mayRequestAds, !preparing, bannerWanted, owner?.subscriptions.suppressAutomaticAds != true else {
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
