// Entry point. Wires the simulation, the renderer, the HUD and the input together, then runs a fixed
// step loop so the game plays the same on a slow machine as on a fast one. `?shot=` switches the
// whole build into capture mode, which is how the screenshots in shots/ were produced.
import * as THREE from 'three';
import { createRenderWorld } from './render/scene.js';
import { createViewmodel } from './render/viewmodel.js';
import { createSimulation, STEP, advance } from './sim/simulation.js';
import { createHud } from './ui/hud.js';
import { createBuyMenu } from './ui/buymenu.js';
import { createAudio } from './audio/synth.js';
import { applyShotMode } from './shotmode.js';
import { WEAPONS } from './sim/weapons.js';
import { PHASE } from './sim/state.js';
import { clamp } from './core/mathx.js';

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') ?? 20261115);
const shotMode = params.get('shot');
const stage = document.getElementById('stage');

const world = createRenderWorld();
const sim = createSimulation({ colliders: world.level.colliders, seed });
const camera = world.camera;
world.scene.add(camera);
const viewmodel = createViewmodel(camera);
const hud = createHud(document);
const audio = createAudio();

const buyMenu = createBuyMenu(document, {
  onBuy: (id) => {
    const result = sim.buy(id);
    hud.setHint(result.ok ? `BOUGHT ${result.label}` : result.reason === 'money' ? 'NOT ENOUGH CASH' : '');
    if (result.ok) audio.reload();
  },
  getPlayer: () => sim.player,
});

// ---------------------------------------------------------------- input
const input = {
  forward: false,
  back: false,
  left: false,
  right: false,
  jump: false,
  crouch: false,
  walk: false,
  fire: false,
  firePressed: false,
  reload: false,
  use: false,
  grenade: false,
};

const SENSITIVITY = 0.0022;
const KEY_MAP = {
  KeyW: 'forward',
  KeyS: 'back',
  KeyA: 'left',
  KeyD: 'right',
  Space: 'jump',
  ControlLeft: 'crouch',
  KeyC: 'crouch',
  ShiftLeft: 'walk',
  KeyR: 'reload',
  KeyE: 'use',
  KeyG: 'grenade',
};

function onKey(event, down) {
  const field = KEY_MAP[event.code];
  if (field) {
    input[field] = down;
    event.preventDefault();
    return;
  }
  if (!down) {
    if (event.code === 'Tab') document.getElementById('scoreboard').classList.remove('open');
    return;
  }
  if (event.code === 'KeyB') {
    buyMenu.show(!buyMenu.isOpen);
    event.preventDefault();
  } else if (event.code === 'Tab') {
    showScoreboard();
    event.preventDefault();
  } else if (event.code === 'KeyM') {
    hud.setHint(audio.toggleMute() ? 'MUTED' : 'SOUND ON');
  } else if (/^Digit[1-4]$/.test(event.code) && buyMenu.isOpen) {
    buyMenu.press(event.code.replace('Digit', ''));
    event.preventDefault();
  }
}

document.addEventListener('keydown', (event) => onKey(event, true));
document.addEventListener('keyup', (event) => onKey(event, false));

stage.addEventListener('mousedown', (event) => {
  if (shotMode) return;
  audio.unlock();
  if (document.pointerLockElement !== stage) {
    stage.requestPointerLock?.();
    return;
  }
  if (event.button === 0) {
    input.fire = true;
    input.firePressed = true;
  }
});
document.addEventListener('mouseup', (event) => {
  if (event.button === 0) input.fire = false;
});
document.addEventListener('mousemove', (event) => {
  if (document.pointerLockElement !== stage) return;
  const player = sim.player;
  if (!player) return;
  player.yaw -= event.movementX * SENSITIVITY;
  player.pitch = clamp(player.pitch - event.movementY * SENSITIVITY, -1.45, 1.45);
});
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === stage;
  document.body.classList.toggle('locked', locked);
  hud.setHint(locked ? '' : 'CLICK TO DEPLOY · WASD MOVE · MOUSE AIM · R RELOAD · E USE · B BUY · TAB SCORES');
  if (!locked) {
    input.fire = false;
    for (const key of Object.keys(input)) input[key] = false;
  }
});

// ---------------------------------------------------------------- scoreboard
function showScoreboard() {
  const board = document.getElementById('scoreboard');
  const rows = sim.match.players
    .slice()
    .sort((a, b) => (a.side === b.side ? b.kills - a.kills : a.side < b.side ? -1 : 1))
    .map((p) => {
      const weapon = WEAPONS[p.weapon.id].name;
      const status = p.alive ? 'LIVE' : 'DOWN';
      return `<div class="sb-row ${p.side} ${p.alive ? '' : 'down'}">
        <span class="sb-name">${p.name}</span>
        <span class="sb-side">${p.side === 'tide' ? 'TIDE' : 'WARDEN'}</span>
        <span class="sb-k">${p.kills}</span>
        <span class="sb-weapon">${weapon}</span>
        <span class="sb-status">${status}</span>
      </div>`;
    })
    .join('');
  board.innerHTML = `<div class="sb-head"><span>TIDE ${sim.match.score.tide}</span><span>ROUND ${sim.match.round}</span><span>WARDEN ${sim.match.score.warden}</span></div>${rows}`;
  board.classList.add('open');
}

// ---------------------------------------------------------------- loop
const clock = { last: performance.now(), acc: 0 };
let lastShotAt = sim.player ? sim.player.lastShotAt : undefined;
let lastHealth = sim.player ? sim.player.health : 100;
let lastHits = sim.match.stats.hits;
let eventCursor = 0;

function drainEvents() {
  const events = sim.match.events;
  if (events.length < eventCursor) eventCursor = 0;
  for (; eventCursor < events.length; eventCursor += 1) {
    const event = events[eventCursor];
    if (event.type === 'planted') audio.plant();
    else if (event.type === 'exploded') audio.explode();
    else if (event.type === 'round-start') audio.roundStart();
    else if (event.type === 'round-end') audio.roundEnd(event.winner === sim.player.side);
    else if (event.type === 'defused') audio.plant();
  }
}

function syncScene(dt) {
  const player = sim.player;
  const time = sim.match.time;

  const eye = player.y + (player.crouching ? 1.02 : 1.6);
  const speed = Math.hypot(player.vx, player.vz);
  const bob = Math.sin(time * 10) * 0.014 * Math.min(1, speed / 4.5);
  const shake = player.shake ?? 0;
  camera.position.set(
    player.x + Math.cos(time * 31) * shake * 0.02,
    eye + bob + Math.cos(time * 27) * shake * 0.02,
    player.z + Math.sin(time * 29) * shake * 0.02,
  );
  camera.rotation.set(
    player.pitch + player.recoil.pitch * 0.5,
    player.yaw + player.recoil.yaw * 0.5,
    (player.viewRoll ?? 0) + (player.recoil.yaw ?? 0) * 0.25,
  );

  if (player.lastShotAt !== lastShotAt) {
    lastShotAt = player.lastShotAt;
    viewmodel.onShot();
    audio.shot(player.weapon.id);
  }
  if (player.health < lastHealth) {
    hud.markDamage(time);
    audio.hurt();
  }
  lastHealth = player.health;
  if (sim.match.stats.hits > lastHits) {
    hud.markHit(time, false);
    audio.hit(false);
  }
  lastHits = sim.match.stats.hits;

  world.syncActors(sim.match, time);
  world.syncEffects(sim.effects, time, camera.position);
  world.syncBomb(sim.match, time);
  viewmodel.sync(player, dt, time);
  hud.update(sim.match, player, time);
}

function render() {
  world.renderer.render(world.scene, world.camera);
}

function frame(now) {
  const dt = Math.min(0.1, (now - clock.last) / 1000);
  clock.last = now;
  if (!shotMode) {
    clock.acc += dt;
    let steps = 0;
    while (clock.acc >= STEP && steps < 10) {
      sim.step(input);
      input.firePressed = false;
      clock.acc -= STEP;
      steps += 1;
    }
    drainEvents();
    if (buyMenu.isOpen && sim.match.phase === PHASE.live) buyMenu.show(false);
  }
  syncScene(dt);
  render();
  requestAnimationFrame(frame);
}

function resize() {
  const width = stage.clientWidth || window.innerWidth;
  const height = stage.clientHeight || window.innerHeight;
  world.resize(width, height);
}
window.addEventListener('resize', resize);
resize();

if (shotMode) {
  const config = applyShotMode(shotMode, sim);
  if (config.openBuyMenu) buyMenu.show(true);
  if (config.fired) {
    advance(sim, 0.02);
    viewmodel.onShot();
  }
  syncScene(0.016);
  render();
  // A second frame lets the shadow map and the tone mapping settle before the capture.
  requestAnimationFrame(() => {
    syncScene(0.016);
    render();
    window.__shotReady = true;
  });
  document.body.classList.add('capture');
} else {
  hud.setHint('CLICK TO DEPLOY · WASD MOVE · MOUSE AIM · R RELOAD · E USE · B BUY · TAB SCORES');
  requestAnimationFrame(frame);
}

// Handy for the determinism check and for poking at a live match from the console.
window.__saltworks = { sim, world, hud, shotMode, seed };
