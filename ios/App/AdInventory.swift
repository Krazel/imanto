import Foundation

#if IMANTO_PRODUCTION && IMANTO_TESTFLIGHT
#error("Choose one Imanto advertising destination; production and TestFlight cannot be combined.")
#endif

// Selected at compilation, never from JavaScript, a URL, receipt or remote setting.
enum AdInventory {
    #if DEBUG || IMANTO_TESTFLIGHT
    static let mode = "demo"
    static let banner = "ca-app-pub-3940256099942544/2435281174"
    static let interstitial = "ca-app-pub-3940256099942544/4411468910"
    static let rewarded = "ca-app-pub-3940256099942544/1712485313"
    #elseif IMANTO_PRODUCTION
    static let mode = "production"
    static let banner = "ca-app-pub-3425091654264901/9778431363"
    static let interstitial = "ca-app-pub-3425091654264901/8321704454"
    static let rewarded = "ca-app-pub-3425091654264901/9990929215"
    #else
    static let mode = "disabled"
    static let banner = ""
    static let interstitial = ""
    static let rewarded = ""
    #endif

    static func enabled(bundleMode: String?) -> Bool {
        return mode != "disabled" && bundleMode == mode
    }
}
