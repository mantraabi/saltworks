// Capture mode. The screenshots have to be the real game, so this module draws nothing: it drives the
// same simulation to a chosen moment and leaves the camera in the hands of a player standing where the
// shot is. `?shot=cover|contact|objective|buy`. Poses are aimed with the same yaw maths the player
// uses, so the crosshair always lands on the subject of the frame.
import { PHASE } from './sim/state.js';
import { equip } from './sim/player.js';
import { advance } from './sim/simulation.js';
import { SITES } from './world/mapdata.js';

const LIVE_TIMER = 96;

// Forward is (-sin yaw, -cos yaw), so aiming at a point is a two-argument arctangent.
function aimAt(player, x, z) {
  const dx = x - player.x;
  const dz = z - player.z;
  player.yaw = Math.atan2(-dx, -dz);
}

function stand(player, x, z, lookX, lookZ, pitch = 0) {
  player.x = x;
  player.z = z;
  player.y = 0;
  player.vx = 0;
  player.vz = 0;
  player.pitch = pitch;
  player.alive = true;
  player.health = 100;
  player.crouching = false;
  player.recoil.pitch = 0;
  player.recoil.yaw = 0;
  if (lookX !== undefined) aimAt(player, lookX, lookZ);
}

function hold(player, x, z, lookX, lookZ) {
  stand(player, x, z, lookX, lookZ);
  player.ai.state = 'hold';
  player.ai.holdUntil = 1e9;
  player.ai.canSee = false;
  player.ai.targetId = null;
}

export const SHOT_MODES = ['cover', 'contact', 'objective', 'buy'];

export function applyShotMode(mode, sim) {
  const { match } = sim;
  const player = sim.player;
  const byId = (id) => match.players.find((p) => p.id === id);

  // Every capture happens mid-round, so the HUD tells the truth about a live round.
  if (mode !== 'buy') {
    match.phase = PHASE.live;
    match.phaseTimer = LIVE_TIMER;
    match.message = '';
  }

  if (mode === 'buy') {
    match.phase = PHASE.freeze;
    match.phaseTimer = 5;
    match.message = 'ROUND 1 · BUY PHASE';
    match.bomb.state = 'carried';
    match.bomb.carrierId = player.id;
    equip(player, 'sidewinder');
    player.money = 4300;
    player.armor = 0;
    stand(player, 0.9, 12.4, 0.4, 0, -0.02);
    return { openBuyMenu: true };
  }

  if (mode === 'cover') {
    // Mid, on the approach: the pump house splits the lane, the catwalk stairs sit on the left and a
    // defender holds the far barrier on the right. This is the frame that says "tactical shooter".
    equip(player, 'marlow');
    player.money = 3400;
    player.armor = 100;
    match.bomb.state = 'carried';
    match.bomb.carrierId = 'rivet';

    const foe = byId('harrow');
    foe.alive = true;
    foe.health = 100;
    equip(foe, 'vesper');
    hold(foe, 2.7, 0.6, 1.4, 11.0);

    const mate = byId('rivet');
    mate.alive = true;
    mate.health = 100;
    equip(mate, 'marlow');
    hold(mate, -3.6, 4.2, -8.0, -4.0);

    stand(player, 1.5, 11.6, 2.7, 0.6, -0.02);
    advance(sim, 0.4);
    return {};
  }

  if (mode === 'contact') {
    // Trading shots through the site door: muzzle lit, tracer out, blood on the plate.
    equip(player, 'marlow');
    player.money = 2900;
    player.armor = 100;
    match.bomb.state = 'carried';
    match.bomb.carrierId = player.id;

    const foe = byId('kestrel');
    foe.alive = true;
    foe.health = 100;
    equip(foe, 'vesper');
    hold(foe, -18.1, -16.1, -18.2, -8.0);
    foe.ai.canSee = true;
    foe.ai.targetId = player.id;

    const mate = byId('moss');
    mate.alive = true;
    mate.health = 100;
    equip(mate, 'marlow');
    hold(mate, -16.4, -11.6, -18.0, -17.0);

    stand(player, -18.2, -10.2, -18.1, -16.1, -0.01);
    advance(sim, 0.3);
    // A real burst through the real fire path: tracer, muzzle flash, impact and recoil all come from
    // the same code a player's trigger pulls.
    sim.step({ fire: true, firePressed: true });
    sim.step({ fire: true });
    sim.step({ fire: false });
    player.weapon.ammo = Math.max(1, player.weapon.ammo);
    return { fired: true };
  }

  if (mode === 'objective') {
    // The device is down: the beacon, the painted floor and the clock carry the frame.
    const site = SITES[0];
    equip(player, 'vesper');
    player.money = 2250;
    player.armor = 100;
    match.bomb.state = 'planted';
    match.bomb.site = site.id;
    match.bomb.x = site.x - 0.4;
    match.bomb.z = site.z - 0.5;
    match.bomb.timer = 27.4;
    match.bomb.carrierId = null;
    match.bomb.plantProgress = 1;
    match.phase = PHASE.planted;
    match.phaseTimer = 27.4;

    const guard = byId('brant');
    guard.alive = true;
    guard.health = 100;
    equip(guard, 'marlow');
    hold(guard, -20.8, -14.8, -18.9, -17.0);

    const mate = byId('rivet');
    mate.alive = true;
    mate.health = 100;
    equip(mate, 'marlow');
    hold(mate, -16.0, -17.6, -18.9, -17.0);

    stand(player, -17.2, -14.2, -18.9, -17.0, -0.19);
    advance(sim, 0.4);
    return {};
  }

  return {};
}
