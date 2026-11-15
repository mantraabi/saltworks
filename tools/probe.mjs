// Probe: report the muzzle-flash mesh state so a stuck flash can be proven rather than guessed.
import { withChrome } from './cdp.mjs';

await withChrome(async (page) => {
  await page.goto(`http://127.0.0.1:8099/?shot=${process.argv[2] ?? 'cover'}`);
  await page.waitFor('window.__shotReady === true', 40000);
  console.log(
    await page.evaluate(`(() => {
      const { world } = window.__saltworks;
      const found = [];
      world.scene.traverse((o) => {
        if (!o.isMesh) return;
        const hex = o.material?.color ? '#' + o.material.color.getHexString() : null;
        if (hex === '#ffd08a' || o.material?.blending === 2) {
          found.push({ hex, visible: o.visible, opacity: o.material.opacity, scale: o.scale.x, parentVisible: o.parent.visible });
        }
      });
      return JSON.stringify({ found, camChildren: world.camera.children.length });
    })()`),
  );
});
