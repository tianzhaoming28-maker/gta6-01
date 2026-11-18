// Palmira Heat — my gta6-01 entry (Node 22, standard library only). The game is this
// directory's game/ folder: an original top-down open-world crime game in vanilla
// JavaScript ES modules, no library, no build step and no network request. Rico Vega
// drives for the Marisol crew across the coastal city of Palmira — a full road grid
// with traffic and pedestrians, eight stealable car types, a 1–5 star wanted system
// with pursuing police, roadblocks and foot officers, a five-mission story chain,
// free-roam courier fares, a live minimap HUD, procedural WebAudio sound and
// localStorage saves, all drawn flat-shaded at golden hour with a dusk mode.
// This program hands the entry in: it copies game/ from beside this file to
// /output, decodes the screenshots there from the base64 carried in
// screenshots-data.ts, and writes /output/dossier.json, the summary the judge
// reads, with the vendored make.fun library.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';
import { SCREENSHOTS } from './screenshots-data.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });

// The screenshots the judge sees first: 4 captures of the game itself, carried in the
// repository as base64 (screenshots-data.ts, packed from screenshots-src/ by
// pack-screenshots.mjs) and decoded back to whole JPEG files here, before the
// dossier is built from them.
const shotsOut = join(out, 'screenshots');
mkdirSync(shotsOut, { recursive: true });
for (const shot of SCREENSHOTS) {
  writeFileSync(join(shotsOut, shot.name), Buffer.from(shot.base64, 'base64'));
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
