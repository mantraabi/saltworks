// Capture the four screenshots the submission needs, at the size the rules allow (1280x720 JPEG, well
// under 256 KiB each). Each frame is the game's own renderer: the page is loaded with ?shot=<mode>,
// which drives the simulation to that moment and then hands over. Run with a server on $BASE.
import { withChrome } from './cdp.mjs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:8099';
const SEED = 20261115;
const SHOTS = [
  { mode: 'cover', file: 'screenshots/1-mid-approach.jpg' },
  { mode: 'contact', file: 'screenshots/2-contact.jpg' },
  { mode: 'objective', file: 'screenshots/3-device.jpg' },
  { mode: 'buy', file: 'screenshots/4-armoury.jpg' },
];

await withChrome(async (page) => {
  for (const shot of SHOTS) {
    await page.goto(`${BASE}/?shot=${shot.mode}&seed=${SEED}`);
    await page.waitFor('window.__shotReady === true', 40000);
    await new Promise((r) => setTimeout(r, 400));
    await page.shot(shot.file, 88);
    console.log(`${shot.file} done`);
  }
  if (page.logs.length) console.log('console:', page.logs.slice(-6).join(' | '));
});
