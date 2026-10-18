# Imanto

Color puzzle by Krazel Games. Native iOS candidate 0.18.1 (1), English/Spanish.
Random openings, combos, persistent score and game. Recorded audio uses AVAudioPlayer.
Subscriptions use StoreKit 2 and local benefit counters verified with StoreKit. Monthly block
helpers and included daily revives are separate, each capped at one per game.
Optional rewarded TEST ads are enabled for the internal beta; banner/interstitial
remain disabled. No live AdMob inventory or public App Store release.

Build: npm ci; npm test; npm run build:ios; cd ios; xcodegen generate --spec project.ads.yml.
Protected owner-only workflow performs iPhone/iPad native QA before signing/upload.
Support: https://krazel.github.io/imanto/support/
Privacy: https://krazel.github.io/imanto/privacy/

Recorded effects: Kenney, CC0. Optional music: Carefree, Kevin MacLeod,
CC BY 4.0, attribution and links inside the game. Copyright Krazel Studio.
