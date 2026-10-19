import UIKit
import WebKit
import AVFoundation

final class WeakHandler: NSObject, WKScriptMessageHandler {
    weak var owner: GameController?
    init(_ owner: GameController) { self.owner = owner }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, message.frameInfo.request.url?.isFileURL == true else { return }
        owner?.receive(message)
    }
}

final class GameController: UIViewController, WKNavigationDelegate {
    private(set) var web: WKWebView!
    private(set) var navigationReady = false
    private(set) var navigationError: String?
    private(set) var scriptErrors: [String] = []
    let audio = NativeAudio()
    var haptics: NativeHaptics!
    var ads: NativeAds!
    var subscriptions: NativeSubscriptions!
    private var webBottom: NSLayoutConstraint!
    func reserveBannerHeight(_ height: CGFloat) { webBottom.constant = -max(0, height); view.layoutIfNeeded() }
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 1, green: 0.969, blue: 0.922, alpha: 1)
        haptics = NativeHaptics(view: view)
        ads = NativeAds(owner: self)
        subscriptions = NativeSubscriptions(owner: self)
        subscriptions.wallet = NativeWallet()
        let configuration = WKWebViewConfiguration()
        configuration.preferences.isTextInteractionEnabled = true
        let handler = WeakHandler(self)
        configuration.userContentController.add(handler, name: "imantoAudio")
        configuration.userContentController.add(handler, name: "imantoText")
        configuration.userContentController.add(handler, name: "imantoHaptics")
        configuration.userContentController.add(handler, name: "imantoAds")
        configuration.userContentController.add(handler, name: "imantoSubscriptions")
        configuration.userContentController.addUserScript(WKUserScript(source: "window.imantoCapabilities={haptics:\(haptics.supported ? "true" : "false")};", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        #if DEBUG
        configuration.userContentController.add(handler, name: "imantoDiagnostics")
        configuration.userContentController.addUserScript(WKUserScript(source: "addEventListener('error',e=>window.webkit.messageHandlers.imantoDiagnostics.postMessage(String(e.message)));", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        #endif
        let policy = """
        (()=>{let last;const sync=()=>{const enabled=[...document.querySelectorAll('textarea,input,[contenteditable="true"]')].some(e=>!e.disabled&&e.getClientRects().length&&(!e.matches('input')||!['button','checkbox','radio','range','submit','hidden','color'].includes(e.type)));if(enabled!==last){last=enabled;window.webkit.messageHandlers.imantoText.postMessage(enabled)}};document.addEventListener('DOMContentLoaded',()=>{sync();new MutationObserver(sync).observe(document.body,{subtree:true,attributes:true,childList:true});addEventListener('resize',sync)});})();
        """
        configuration.userContentController.addUserScript(WKUserScript(source: policy, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        web = WKWebView(frame: .zero, configuration: configuration)
        web.navigationDelegate = self
        web.allowsLinkPreview = false
        web.isOpaque = false
        web.backgroundColor = view.backgroundColor
        web.scrollView.backgroundColor = view.backgroundColor
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.scrollView.bounces = false
        web.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(web)
        webBottom = web.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor)
        subscriptions.start()
        // Keep the entire game and dialogs inside the actual device safe area.
        NSLayoutConstraint.activate([
            web.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
            web.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webBottom
        ])
        if let root = Bundle.main.url(forResource: "Web", withExtension: nil) {
            web.loadFileURL(root.appendingPathComponent("index.html"), allowingReadAccessTo: root)
        }
        NotificationCenter.default.addObserver(self, selector: #selector(suspend), name: UIApplication.willResignActiveNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(resume), name: UIApplication.didBecomeActiveNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(interrupted), name: AVAudioSession.interruptionNotification, object: nil)
    }
    override func viewDidLayoutSubviews() { super.viewDidLayoutSubviews(); ads?.updateLayout() }
    override func viewDidAppear(_ animated: Bool) { super.viewDidAppear(animated); ads?.initializeOnLaunch() }
    func receive(_ message: WKScriptMessage) {
        #if DEBUG
        if message.name == "imantoDiagnostics", let error = message.body as? String { scriptErrors.append(error); NSLog("Imanto bundled script: %@", error); return }
        #endif
        if message.name == "imantoText", let enabled = message.body as? Bool {
            if web.configuration.preferences.isTextInteractionEnabled != enabled { web.configuration.preferences.isTextInteractionEnabled = enabled }
        } else if message.name == "imantoAudio", let body = message.body as? [String: Any] {
            audio.receive(body)
        } else if message.name == "imantoHaptics", let body = message.body as? [String: Any] {
            haptics.receive(body)
        } else if message.name == "imantoAds", let body = message.body as? [String: Any] {
            ads.receive(body)
        } else if message.name == "imantoSubscriptions", let body = message.body as? [String: Any] {
            subscriptions.receive(body)
        }
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { navigationReady = true; ads.initializeOnLaunch() }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { navigationError = error.localizedDescription }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { navigationError = error.localizedDescription }
    @objc private func suspend() { haptics.active = false; audio.active = false; audio.pause() }
    @objc private func resume() { haptics.active = !ads.fullscreenPresenting; audio.active = !ads.fullscreenPresenting; audio.reconcile(); ads.initializeOnLaunch(resetRetries: true); Task { await subscriptions.refresh() } }
    @objc private func interrupted(_ notification: Notification) {
        guard let number = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: number) else { return }
        if type == .began { audio.active = false; audio.pause() }
        else {
            let options = (notification.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt) ?? 0
            audio.active = UIApplication.shared.applicationState == .active && !ads.fullscreenPresenting
            if AVAudioSession.InterruptionOptions(rawValue: options).contains(.shouldResume) { audio.reconcile() }
        }
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        let url = navigationAction.request.url
        if url?.isFileURL == true { decisionHandler(.allow); return }
        decisionHandler(.cancel)
        // Only explicit taps can leave the offline app for credits/support.
        if navigationAction.navigationType == .linkActivated, let url = url, url.scheme == "https" { UIApplication.shared.open(url) }
    }
    override var preferredStatusBarStyle: UIStatusBarStyle { .darkContent }
    deinit { NotificationCenter.default.removeObserver(self) }
}

final class NativeAudio {
    private(set) var music: AVAudioPlayer?
    private(set) var pools: [String: [AVAudioPlayer]] = [:]
    private var effects = true, wantsMusic = false, unlocked = false, visible = true
    private var effectsVolume: Float = 0.7, musicVolume: Float = 0.15
    var active = true
    private(set) var lastError: String?
    init() {
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.mixWithOthers])
            for cue in ["button", "place", "move", "line"] {
                guard let url = Bundle.main.url(forResource: cue, withExtension: "wav", subdirectory: "Audio") else { throw CocoaError(.fileNoSuchFile) }
                pools[cue] = try (0..<3).map { _ in let p = try AVAudioPlayer(contentsOf: url); p.prepareToPlay(); return p }
            }
            guard let url = Bundle.main.url(forResource: "carefree", withExtension: "mp3", subdirectory: "Audio") else { throw CocoaError(.fileNoSuchFile) }
            music = try AVAudioPlayer(contentsOf: url)
            music?.numberOfLoops = -1
            music?.prepareToPlay()
        } catch { lastError = "Bundled audio could not be initialized" }
    }
    func receive(_ body: [String: Any]) {
        switch body["kind"] as? String {
        case "settings":
            effects = body["effects"] as? Bool ?? false
            wantsMusic = body["music"] as? Bool ?? false
            unlocked = body["unlocked"] as? Bool ?? false
            visible = body["visible"] as? Bool ?? false
            effectsVolume = volume(body["effectsVolume"])
            musicVolume = volume(body["musicVolume"])
            if !effects || effectsVolume == 0 { stopEffects() }
            reconcile()
        case "effect":
            guard active, visible, unlocked, effects, effectsVolume > 0,
                  let cue = body["cue"] as? String, let player = pools[cue]?.first(where: { !$0.isPlaying }) else { return }
            do {
                try AVAudioSession.sharedInstance().setActive(true)
                player.volume = effectsVolume; player.currentTime = 0; player.play()
            } catch { lastError = "Audio session could not be activated" }
        case "pause": pause()
        default: break
        }
    }
    private func volume(_ value: Any?) -> Float {
        guard let n = value as? NSNumber, n.floatValue.isFinite else { return 0 }
        return min(1, max(0, n.floatValue))
    }
    func reconcile() {
        for pool in pools.values { for p in pool { p.volume = effectsVolume } }
        music?.volume = musicVolume
        if wantsMusic && unlocked && visible && active && musicVolume > 0 {
            do { try AVAudioSession.sharedInstance().setActive(true); if music?.isPlaying == false { music?.play() } }
            catch { lastError = "Audio session could not be activated" }
        } else { music?.pause() }
    }
    private func stopEffects() { for pool in pools.values { for p in pool { p.stop(); p.currentTime = 0 } } }
    func pause() { music?.pause(); stopEffects() }
}
