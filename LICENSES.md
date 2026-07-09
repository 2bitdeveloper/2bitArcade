# 2bitArcade - Licenses

## IMPORTANT: 2bit Developer's own games are NOT open source
JumpFighter, Origami Ascent, Neon Runner, and the 2bitArcade site itself
are copyrighted, all-rights-reserved works. They may not be hosted or
reused without written permission. See the LICENSE file. The source is
public for transparency/verification only. The MIT/permissive terms below
apply ONLY to the third-party games listed.

---

# 2bitArcade - Third-Party Licenses

## Radius Raid
- Author: Jack Rugile
- Source: https://github.com/jackrugile/radius-raid-js13k
- License: MIT (full text at public/rraid/LICENSE.md)
- Modifications: none to game code. Script paths adjusted in the host
  page; a bridge script adds leaderboard submission alongside the game.

## Bullet Hell
- Author: Amelia Clarke (selenebun)
- Source: https://github.com/selenebun/bullethell
- License: MIT (full text at public/bullethell/LICENSE)
- Bundled: p5.js (MIT). Game code unmodified; a bridge script adds
  leaderboard submission alongside the game.

## SpacePi
- Author: Jack Rugile
- Source: https://github.com/jackrugile/spacepi-js13k
- License: MIT (full text at public/spacepi/LICENSE.md)
- Modifications: ONE line - the game instance is exposed as `window.sp`
  (original: `var sp=new SpacePi;sp.initGame()`) so the leaderboard bridge
  can read cumulative level scores. Game logic otherwise unmodified.

## Lucky Alien
- Author: thcheetah777 (deltea)
- Source: https://github.com/thcheetah777/luckyalien
- License: MIT (full text at public/luckyalien/LICENSE.md)
- Bundled: Phaser 3 (MIT, via CDN); graphics by Kenney.nl (CC0).
- Modifications: the original bundled copyrighted background music
  (ripped Kirby soundtrack). Those four tracks (start/background/boss/
  credits) were REMOVED and replaced with original music. A bridge
  script adds leaderboard submission. Game logic otherwise unmodified.

## Jungle Strike
- Original work by 2bit Developer (created for 2bitArcade).
- All code and art original (canvas-drawn run-and-gun); no third-party
  assets. An original game in the run-and-gun genre (not affiliated with
  or derived from any existing franchise). VT323 font via Google Fonts (OFL).

## Sunset Drift
- Original work by 2bit Developer (created for 2bitArcade).
- All code and art original (canvas-drawn pseudo-3D racer); no third-party
  game assets. VT323 font via Google Fonts (OFL).

## Neon Runner
- Original work by 2bit Developer (created for 2bitArcade).
- All code and art original (canvas-drawn); no third-party game assets.

## Neon Night Racer
- Base engine: Arshiamk (https://github.com/Arshiamk/neon-night-racer), MIT
  (full text at public/neonracer/LICENSE).
- Modifications by 2bit Developer: the original was a driving demo with no
  fail state. Added an original traffic/collision/lives system
  (public/neonracer/js/traffic.js) - AI vehicles, 3 lives, off-road and
  vehicle collisions, and distance-scaled difficulty - plus small hooks in
  game.js (instantiate/reset/update/render the traffic system, restart after
  wreck) and the window.game export. The new traffic.js and gameplay logic
  are original 2bit Developer work; the underlying pseudo-3D road engine
  remains Arshiamk's under MIT.

## Origami Ascent / JumpFighter
- Original works by 2bit Developer.
