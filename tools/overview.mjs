// A top-down look at the carved level, for sanity-checking the layout and the prop placement. Not a
// submission asset — a development view.
import { withChrome } from './cdp.mjs';

await withChrome(async (page) => {
  await page.goto('http://127.0.0.1:8099/?shot=cover');
  await page.waitFor('window.__shotReady === true', 40000);
  await page.evaluate(`(() => {
    const { world } = window.__saltworks;
    const c = world.camera;
    c.position.set(0, 46, 0.1);
    c.rotation.set(-Math.PI / 2, 0, 0);
    c.fov = 55;
    c.updateProjectionMatrix();
    world.renderer.render(world.scene, c);
  })()`);
  await page.shot('/tmp/overview.jpg', 90);
  console.log('overview written');
});
