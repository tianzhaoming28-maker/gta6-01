// Coral Vice - make.fun hand-in program.
// Copies game/ into the output directory, decodes the embedded
// screenshot payloads from screenshots-data.ts into screenshots/,
// and writes dossier.json with the kit's buildDossier library.
//
// Run:  node main.ts            (writes to /output)
//       MAKEFUN_OUTPUT_DIR=out node main.ts   (local test)
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';
import { SCREENSHOTS } from './screenshots-data.ts';

const root = dirname(fileURLToPath(import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR || '/output';

mkdirSync(out, { recursive: true });

// 1. The game itself, byte for byte.
cpSync(join(root, 'game'), join(out, 'game'), { recursive: true });

// 2. Screenshots, decoded from their base64 payloads.
const shotsDir = join(out, 'screenshots');
mkdirSync(shotsDir, { recursive: true });
for (const shot of SCREENSHOTS) {
  writeFileSync(join(shotsDir, shot.name), Buffer.from(shot.base64, 'base64'));
}

// 3. The dossier, built by the scorer's own library with the gate's caps.
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);

console.log(`coral-vice: wrote game/, ${SCREENSHOTS.length} screenshots and dossier.json to ${out}`);
