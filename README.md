# Imanto

Color puzzle by Krazel Games. Native iOS candidate 0.21 (1), English/Spanish.
Clean jelly, painted wood and crackle ceramic; complete palettes change between games.
Approved Spring placement with five subtle prerecorded pitches and Quick success line sound.
Warm menus, independent settings, readable large scores and remove-ads entry in pause.
Random openings, combos, persistent score and game. Recorded audio uses AVAudioPlayer.
Subscriptions use StoreKit 2 and local benefit counters verified with StoreKit. Block
removals let a player continue after game over, capped at one removal per game.
Google TEST inventory is enabled in the internal beta. Banner begins with game 5.
Interstitial after two played games, or one lasting ten active minutes. Persistent
cadence survives relaunch. No live AdMob inventory or public App Store release.

Build: npm ci; npm test; npm run build:ios; cd ios; xcodegen generate --spec project.ads.yml.
Protected owner-only workflow performs iPhone/iPad native QA before signing/upload.
Support: https://krazel.github.io/imanto/support/
Privacy: https://krazel.github.io/imanto/privacy/

Recorded effects: Kenney, CC0. Music: Meditation Impromptu 01, Kevin MacLeod,
CC BY 4.0, attribution and links inside the game. Copyright Krazel Studio.
