# Imanto

A warm color puzzle by Krazel Games. English and Spanish. Complete monochrome rows or columns; place one tile to push its orthogonal neighbors once.

Native iOS beta 0.15 (1), iPhone/iPad, iOS 16+. Offline WKWebView runtime; recorded music and effects use AVAudioPlayer and playback session. Drag or tap to place tiles. Consecutive scoring moves grow a combo multiplier, renewed through the current and following hand. The HUD shows score, personal best and combo. Optional UIKit haptics for placement, lines, combos and all-clear, with a separate saved toggle on supported iPhones. No accounts, ads, analytics or purchases.

## Build

`npm ci`, `npm test`, `npm run build:ios`, then `cd ios && xcodegen generate`. Open Imanto.xcodeproj. The manual release workflow runs native simulator tests before signing; signing and Apple upload secrets are restricted to the main-only production environment. Standard public macOS runner; one-day artifact retention, no cache.

## Rights and sources

Game code/art: copyright Krazel Studio. Public source visibility does not grant a separate license. Recorded button/place/move/line sounds: Kenney, CC0. “Carefree” Kevin MacLeod (incompetech.com), CC BY 4.0: https://creativecommons.org/licenses/by/4.0/ . Original audio and credits in web/audio and ios/Audio. Three OGG effects are decoded to PCM WAV for AVAudioPlayer without changing rate, channels or level.

Support: https://krazel.github.io/imanto/support/
Privacy: https://krazel.github.io/imanto/privacy/

TestFlight beta only. App Store and itch.io listings remain drafts. Physical-device haptics, audio, silent-switch and text-gesture QA is pending user testing.
