# Imanto

Color puzzle by Krazel Games. Native iOS candidate 0.19 (1), English/Spanish.
Random openings, combos, persistent score and game. Recorded audio uses AVAudioPlayer.
Subscriptions use StoreKit 2 and local benefit counters verified with StoreKit. Monthly block
helpers and included daily revives are separate, each capped at one per game.
Google TEST inventory is enabled for all three formats in the internal beta.
Banner begins with game 5; interstitial after game 6, then every 3 completed games.
Full-screen ads have a 180-second minimum interval. Voluntary rewarded revive once/game. No live AdMob inventory or public App Store release.

Build: npm ci; npm test; npm run build:ios; cd ios; xcodegen generate --spec project.ads.yml.
Protected owner-only workflow performs iPhone/iPad native QA before signing/upload.
Support: https://krazel.github.io/imanto/support/
Privacy: https://krazel.github.io/imanto/privacy/

Recorded effects: Kenney, CC0. Optional music: Carefree, Kevin MacLeod,
CC BY 4.0, attribution and links inside the game. Copyright Krazel Studio.
