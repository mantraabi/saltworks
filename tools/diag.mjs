// Diagnostics for the capture mode: reports what the renderer actually did, so a black frame can be
// told apart from a blank scene.
import { withChrome } from './cdp.mjs';

const url = process.argv[2] ?? 'http://127.0.0.1:8099/?shot=cover';

await withChrome(async (page) => {
  await page.goto(url);
  try {
    await page.waitFor('window.__shotReady === true', 40000);
  } catch {
    console.log('shotReady never fired');
  }
  const info = await page.evaluate(`(() => {
    const s = window.__saltworks;
    if (!s) return { error: 'no __saltworks' };
    const r = s.world.renderer;
    const c = s.world.camera;
    const p = s.sim.player;
    return {
      calls: r.info.render.calls,
      triangles: r.info.render.triangles,
      programs: r.info.programs?.length ?? -1,
      size: [r.domElement.width, r.domElement.height],
      camera: [c.position.x, c.position.y, c.position.z].map(v => +v.toFixed(2)),
      rotation: [c.rotation.x, c.rotation.y, c.rotation.z].map(v => +v.toFixed(2)),
      player: [p.x, p.y, p.z].map(v => +v.toFixed(2)),
      alive: p.alive,
      health: p.health,
      sceneChildren: s.world.scene.children.length,
      levelChildren: s.world.scene.children.find(o => o.name === 'saltworks')?.children.length ?? -1,
      actors: s.world.scene.children.filter(o => o.name?.startsWith('actor')).length,
      phase: s.sim.match.phase,
      fog: s.world.scene.fog ? [s.world.scene.fog.near, s.world.scene.fog.far] : null,
      gl: (() => { try { return r.getContext().getParameter(r.getContext().VERSION); } catch (e) { return 'ctx fail ' + e.message; } })(),
    };
  })()`);
  console.log(JSON.stringify(info, null, 2));
  console.log('--- console ---');
  console.log(page.logs.slice(-15).join('\n'));
});
