# gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/tianzhaoming28-maker/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/tianzhaoming28-maker/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Coral Vice** is a complete open-world crime game that runs in a desktop browser from static files — no build step, no network, no libraries, just hand-rolled Canvas2D. You play Mari Vega, an ex-getaway driver who owes $9,000 to the Flamingo Syndicate. Her fixer, Tia Carmen, feeds her work from a beachfront cafe: meet-ups, a stolen coupe to deliver, a timed package run, a fleeing bookie to catch, a police heat level to raise and then shake off, three Syndicate collectors to take down, and one final drive to the ferry pier that burns the debt. After the story, Carmen keeps offering repeatable cash errands.

The city of Coral Bay is generated deterministically from a seed: nine-by-nine blocks of pastel art-deco buildings, parks, parking lots, palm trees and named districts. It is fully explorable on foot and by car. Traffic AI drives the road grid in right-hand lanes, braking for cars and pedestrians; pedestrians stroll the sidewalks, pause to check their phones, and flee from gunfire, punches and speeding cars. Any parked car can be hot-wired and any moving car can be jacked with the E key, and every crime — punching, shooting, carjacking, hit-and-runs, crashes — feeds a five-star wanted system. Coral Bay PD responds with pursuit cars that steer to intercept and box you in, and with officers on foot who chase and shoot; break line of sight and the heat decays.

Combat is punch (F) plus a mouse-aimed pistol with synthesized gunshots. The HUD shows health, car condition, cash, wanted stars, the district name and clock, a live minimap with police blips and a gold objective marker with a distance arrow, and a speedometer while driving. Everything is wrapped in a day-night cycle with lit windows and dusk tints, a start screen with continue support, progress saved to localStorage, a pause screen, a "wasted" hospital respawn, and a fully synthesized WebAudio soundtrack and effects — engine-quiet, file-free, and generated in code.

Controls: WASD / arrows to move and drive, SHIFT to sprint, E to enter or exit a car, F or SPACE to punch, mouse to aim and hold click to shoot, SPACE as handbrake while driving, P to pause, M to mute.

## Run it

```sh
node serve.ts
# then open http://localhost:8173/ in a desktop browser
# (opening game/index.html directly from disk works too)

# Produce the make.fun hand-in (copies game/, decodes the embedded
# screenshots and writes dossier.json):
node pack-screenshots.mjs   # only needed after re-capturing screenshots
node main.ts                # writes to /output, or $MAKEFUN_OUTPUT_DIR
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=3fpa24p8&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
