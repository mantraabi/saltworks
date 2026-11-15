// What is actually under a pixel: raycast the scene from the camera and report the mesh that was hit,
// its transform and its material colour. Development tool for framing the shots.
import { withChrome } from './cdp.mjs';

const mode = process.argv[2] ?? 'cover';
const points = (process.argv[3] ?? '0,-0.55 0,0 0,0.3').split(' ');

await withChrome(async (page) => {
  await page.goto(`http://127.0.0.1:8099/?shot=${mode}`);
  await page.waitFor('window.__shotReady === true', 40000);
  const out = await page.evaluate(`(async () => {
    const THREE = await import('/vendor/three/three.module.min.js');
    const { world } = window.__saltworks;
    const rc = new THREE.Raycaster();
    const rows = [];
    for (const p of ${JSON.stringify(points)}) {
      const [nx, ny] = p.split(',').map(Number);
      rc.setFromCamera(new THREE.Vector2(nx, ny), world.camera);
      const hits = rc.intersectObjects(world.scene.children, true).filter(h => h.object.visible);
      const h = hits[0];
      rows.push(h ? {
        ndc: p,
        dist: +h.distance.toFixed(2),
        point: [h.point.x, h.point.y, h.point.z].map(v => +v.toFixed(2)),
        color: h.object.material?.color ? '#' + h.object.material.color.getHexString() : null,
        scale: h.object.scale ? [h.object.scale.x, h.object.scale.y, h.object.scale.z].map(v => +v.toFixed(2)) : null,
        pos: [h.object.position.x, h.object.position.y, h.object.position.z].map(v => +v.toFixed(2)),
        type: h.object.type,
      } : { ndc: p, hit: null });
    }
    return rows;
  })()`);
  console.log(JSON.stringify(out, null, 1));
});
