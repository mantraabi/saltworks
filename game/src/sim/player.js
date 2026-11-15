// Bodies and human movement. A player is a small state object with a position, a stance and a gun;
// the movement model is the classic one — accelerate toward the wish direction, apply friction, let
// the air keep your momentum — because a shooter lives or dies on how it feels to stop and start.
import { clamp, damp } from '../core/mathx.js';
import { integrateBody } from './collision.js';
import { makeWeaponState, WEAPONS, tickWeapon } from './weapons.js';

export const SPEED = { run: 5.35, walk: 2.75, crouch: 2.15, accel: 62, airAccel: 9, friction: 9.6 };

export function createPlayer(spec) {
  return {
    id: spec.id,
    name: spec.name,
    side: spec.side,
    isBot: Boolean(spec.isBot),
    x: spec.x,
    y: 0,
    z: spec.z,
    vx: 0,
    vz: 0,
    vy: 0,
    yaw: spec.yaw ?? 0,
    pitch: 0,
    radius: 0.34,
    height: 1.78,
    onGround: true,
    crouching: false,
    walking: false,
    health: 100,
    armor: 0,
    alive: true,
    money: 800,
    grenades: 0,
    kills: 0,
    deaths: 0,
    headshots: 0,
    spawn: spec,
    weapon: makeWeaponState(spec.weapon ?? 'sidewinder'),
    inventory: [spec.weapon ?? 'sidewinder'],
    recoil: { pitch: 0, yaw: 0, recover: 0 },
    aimPunch: 0,
    flinch: 0,
    shotsFired: 0,
    shotsHit: 0,
    ai: spec.isBot
      ? {
          state: 'advance',
          route: spec.route ?? 'mid',
          routeIndex: 0,
          targetId: null,
          canSee: false,
          timeOnTarget: 0,
          lastSeenX: spec.x,
          lastSeenZ: spec.z,
          reactAt: 0,
          burst: 0,
          burstPause: 0,
          thinkAt: 0,
          skill: spec.skill ?? 0.5,
          strafeDir: 1,
          strafeUntil: 0,
          stuckFor: 0,
          lastX: spec.x,
          lastZ: spec.z,
          heardX: spec.x,
          heardZ: spec.z,
          planting: false,
        }
      : null,
  };
}

// Equip a weapon the body already owns, or add it and equip it.
export function equip(player, weaponId) {
  if (!WEAPONS[weaponId]) return false;
  if (!player.inventory.includes(weaponId)) player.inventory.push(weaponId);
  player.weapon = makeWeaponState(weaponId);
  player.recoil.pitch = 0;
  player.recoil.yaw = 0;
  return true;
}

// Human locomotion for one fixed step: wish direction in the body's own frame, then friction,
// acceleration, and a crouch that changes both the hitbox height and the top speed.
export function moveHuman(player, input, dt, colliders, now) {
  if (!player.alive) return;
  player.crouching = Boolean(input.crouch) && player.onGround;
  player.walking = Boolean(input.walk);
  player.height = player.crouching ? 1.24 : 1.78;

  const forward = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
  const strafe = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const sin = Math.sin(player.yaw);
  const cos = Math.cos(player.yaw);
  let wishX = sin * forward + cos * strafe;
  let wishZ = -cos * forward + sin * strafe;
  const wishLen = Math.hypot(wishX, wishZ);
  if (wishLen > 1e-5) {
    wishX /= wishLen;
    wishZ /= wishLen;
  }

  const maxSpeed = player.crouching ? SPEED.crouch : player.walking ? SPEED.walk : SPEED.run;
  const targetX = wishX * maxSpeed;
  const targetZ = wishZ * maxSpeed;
  const accel = player.onGround ? SPEED.accel : SPEED.airAccel;

  if (player.onGround && wishLen < 1e-5) {
    const drop = Math.exp(-SPEED.friction * dt);
    player.vx *= drop;
    player.vz *= drop;
  } else {
    player.vx += (targetX - player.vx) * clamp(accel * dt / Math.max(maxSpeed, 1), 0, 1);
    player.vz += (targetZ - player.vz) * clamp(accel * dt / Math.max(maxSpeed, 1), 0, 1);
  }

  if (input.jump && player.onGround) {
    player.vy = 5.6;
    player.onGround = false;
  }

  integrateBody(player, player.vx, player.vz, dt, colliders);
  if (!player.onGround) {
    // Air control is deliberately weak: a jump commits you.
    player.vx *= 1 - 0.4 * dt;
    player.vz *= 1 - 0.4 * dt;
  }
  tickWeapon(player, dt, now);
  player.flinch = Math.max(0, player.flinch - dt * 2.4);
}

// Bot locomotion: the same integrator as the player, driven by a wish vector the AI writes.
export function moveBot(bot, dt, colliders, now) {
  if (!bot.alive) return;
  bot.height = bot.crouching ? 1.24 : 1.78;
  const speed = bot.crouching ? SPEED.crouch : SPEED.walk * 1.55;
  const wishLen = Math.hypot(bot.wishX ?? 0, bot.wishZ ?? 0);
  const targetX = wishLen > 1e-4 ? (bot.wishX / wishLen) * speed : 0;
  const targetZ = wishLen > 1e-4 ? (bot.wishZ / wishLen) * speed : 0;
  const accel = bot.onGround ? SPEED.accel * 0.8 : SPEED.airAccel;
  player_accelerate(bot, targetX, targetZ, accel, dt);
  integrateBody(bot, bot.vx, bot.vz, dt, colliders);
  tickWeapon(bot, dt, now);
  bot.flinch = Math.max(0, bot.flinch - dt * 2.4);
}

function player_accelerate(body, targetX, targetZ, accel, dt) {
  if (Math.hypot(targetX, targetZ) < 1e-4 && body.onGround) {
    const drop = Math.exp(-SPEED.friction * dt);
    body.vx *= drop;
    body.vz *= drop;
    return;
  }
  const max = Math.max(SPEED.run, 1);
  body.vx += (targetX - body.vx) * clamp((accel * dt) / max, 0, 1);
  body.vz += (targetZ - body.vz) * clamp((accel * dt) / max, 0, 1);
}

// Turn the body toward a heading at a finite rate — a person cannot snap a mouse 180° and a bot
// should not either, or every fight is decided by who was looking the right way first.
export function turnToward(body, targetYaw, targetPitch, dt, rate = 12) {
  const k = damp(rate, dt);
  let delta = targetYaw - body.yaw;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  body.yaw += delta * k;
  body.pitch += (clamp(targetPitch, -1.35, 1.35) - body.pitch) * k;
}
