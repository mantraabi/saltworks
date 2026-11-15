// List everything the camera can see close to it, with colour and transform. Used to find stray meshes
// that end up glued to the lens.
import { withChrome } from './cdp.mjs';

await withChrome(async (page) => {
  await page.goto(`http://127.0.0.1:8099/?shot=${process.argv[2] ?? 'cover'}`);
  await page.waitFor('window.__shotReady === true', 40000);
  const rows = await page.evaluate(`(() => {
    const { world } = window.__saltworks;
    const cam = world.camera;
    const origin = cam.getWorldPosition(new (cam.position.constructor)());
    const out = [];
    world.scene.traverse((o) => {
      if (!o.isMesh && !o.isLine && !o.isSprite) return;
      const p = o.getWorldPosition(new (cam.position.constructor)());
      const d = p.distanceTo(origin);
      if (d > 3.2) return;
      out.push({
        d: +d.toFixed(2),
        type: o.type,
        geo: o.geometry?.type,
        col: o.material?.color ? '#' + o.material.color.getHexString() : null,
        vis: o.visible,
        scale: [o.scale.x, o.scale.y, o.scale.z].map(v => +v.toFixed(2)),
        world: [p.x, p.y, p.z].map(v => +v.toFixed(2)),
        parent: o.parent?.type + '/' + (o.parent?.name || ''),
      });
    });
    out.sort((a, b) => a.d - b.d);
    return { near: out.slice(0, 24), total: out.length };
  })()`);
  console.log(JSON.stringify(rows, null, 1));
});
