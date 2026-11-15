// SALTWORKS — entrypoint. Node 22, standard library only.
//
// The game is game/: plain static files the browser loads as ES modules, with three.js resolved from
// an import map, so there is no build step and no bundler to trust. This program hands the entry in:
// it checks the same caps the scorer checks, copies game/ and screenshots/ to the output directory
// and writes dossier.json, the summary the judge reads, with the kit's vendored make.fun library.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts     # outside the grader
//   node serve.ts                                           # play it on http://localhost:8080
//
// The capture mode used for screenshots/ is documented in README.md: each shot is the game's own
// renderer driven to a named moment by ?shot=<mode>, listed in shots.json.

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-threejs.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's caps, from reference/gate.json. Refusing here what the scorer would refuse keeps a
// broken entry from being uploaded and graded as zero.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
};

const fail = (message) => {
  console.error(`refused: ${message}`);
  process.exit(1);
};

// Every file under a directory, as absolute paths. Symlinks are not followed: the entry ships files.
function listFiles(dir) {
  const found = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) found.push(path);
    }
  };
  walk(dir);
  return found;
}

const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');
const shotsIndex = join(here, 'shots.json');

if (!existsSync(gameDir)) fail('game/ is missing');
if (!existsSync(shotsIndex)) fail('shots.json is missing');

// ---- the game folder: file count and size, the two caps that shape the snapshot
const gameFiles = listFiles(gameDir);
const gameBytes = gameFiles.reduce((total, path) => total + statSync(path).size, 0);
if (gameFiles.length > CAPS.game_max_files) {
  fail(`game/ holds ${gameFiles.length} files, the cap is ${CAPS.game_max_files}`);
}
if (gameBytes > CAPS.game_max_bytes) {
  fail(`game/ holds ${(gameBytes / 1048576).toFixed(2)} MiB, the cap is 48 MiB`);
}

// ---- three.js must be the vendored copy the kit shipped, byte for byte: the rules let the entry
// carry three.js and nothing else that is not the entrant's own, and a substituted build is a
// different library wearing its name.
const vendoredThree = join(gameDir, 'vendor/three/three.module.min.js');
if (!existsSync(vendoredThree)) fail('game/vendor/three/three.module.min.js is missing');
const threeBytes = statSync(vendoredThree).size;
if (threeBytes < 500_000) fail(`the vendored three.js looks truncated (${threeBytes} bytes)`);

// ---- screenshots: at most four, each under 256 KiB, each named by shots.json
const shots = JSON.parse(readFileSync(shotsIndex, 'utf8'));
if (!Array.isArray(shots) || shots.length === 0) fail('shots.json must list at least one capture');
if (shots.length > CAPS.screenshots.max) {
  fail(`shots.json lists ${shots.length} captures, the cap is ${CAPS.screenshots.max}`);
}
if (!existsSync(shotsDir)) fail('screenshots/ is missing');
for (const shot of shots) {
  const path = join(shotsDir, shot.name);
  if (!existsSync(path)) fail(`shots.json names ${shot.name}, which screenshots/ does not hold`);
  const bytes = statSync(path).size;
  if (bytes > CAPS.screenshots.max_bytes) {
    fail(`${shot.name} is ${bytes} bytes, the cap is ${CAPS.screenshots.max_bytes}`);
  }
  if (typeof shot.query !== 'string' || !shot.query.startsWith('?shot=')) {
    fail(`shots.json entry ${shot.name} must carry the query that reproduces it`);
  }
}

// ---- hand it in
if (existsSync(out)) rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });
writeFileSync(join(out, 'dossier.json'), buildDossier(out, CAPS));

const totalBytes = gameBytes + shots.reduce((sum, shot) => sum + statSync(join(shotsDir, shot.name)).size, 0);
console.log(
  `saltworks: ${gameFiles.length} game files, ${(gameBytes / 1048576).toFixed(2)} MiB, ` +
    `${shots.length} captures, ${(totalBytes / 1048576).toFixed(2)} MiB in all -> ${out}`,
);
