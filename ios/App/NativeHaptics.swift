import UIKit
import CoreHaptics

// No custom engine, audio, sustained vibration or delayed playback queue.
@MainActor final class NativeHaptics {
    enum Cue: String { case place, line, combo, allClear }
    let supported: Bool
    var active = true { didSet { if !active { releaseGenerators() } } }
    private var enabled = true, visible = true
    private weak var view: UIView?
    private var impacts: [String: UIImpactFeedbackGenerator] = [:]
    private var success: UINotificationFeedbackGenerator?
    private let output: ((Cue) -> Void)?

    init(view: UIView, supported: Bool = CHHapticEngine.capabilitiesForHardware().supportsHaptics, output: ((Cue) -> Void)? = nil) {
        self.view = view; self.supported = supported; self.output = output
    }
    private var canPlay: Bool { supported && enabled && visible && active }
    func receive(_ body: [String: Any]) {
        switch body["kind"] as? String {
        case "settings":
            enabled = body["enabled"] as? Bool ?? false
            visible = body["visible"] as? Bool ?? false
            if !canPlay { releaseGenerators() }
        case "prepare": prepare()
        case "play":
            guard canPlay, let name = body["cue"] as? String, let cue = Cue(rawValue: name) else { return }
            if let output = output { output(cue); return }
            switch cue {
            case .place: impact(.soft).impactOccurred(intensity: 0.6)
            case .line: impact(.light).impactOccurred(intensity: 0.85)
            case .combo: impact(.medium).impactOccurred(intensity: 0.9)
            case .allClear: notification().notificationOccurred(.success)
            }
            // Prepare the next reward while the board's movement is starting.
            prepare()
        default: break
        }
    }
    private func prepare() {
        guard canPlay, output == nil else { return }
        for style in [UIImpactFeedbackGenerator.FeedbackStyle.soft, .light, .medium] { impact(style).prepare() }
        notification().prepare()
    }
    private func impact(_ style: UIImpactFeedbackGenerator.FeedbackStyle) -> UIImpactFeedbackGenerator {
        let key = String(style.rawValue)
        if let existing = impacts[key] { return existing }
        let generator: UIImpactFeedbackGenerator
        if #available(iOS 17.5, *), let view = view { generator = UIImpactFeedbackGenerator(style: style, view: view) }
        else { generator = UIImpactFeedbackGenerator(style: style) }
        impacts[key] = generator
        return generator
    }
    private func notification() -> UINotificationFeedbackGenerator {
        if let existing = success { return existing }
        let generator: UINotificationFeedbackGenerator
        if #available(iOS 17.5, *), let view = view { generator = UINotificationFeedbackGenerator(view: view) }
        else { generator = UINotificationFeedbackGenerator() }
        success = generator
        return generator
    }
    private func releaseGenerators() { impacts.removeAll(); success = nil }
}
