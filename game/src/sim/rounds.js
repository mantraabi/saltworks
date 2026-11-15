// The round: a freeze time to buy, a live phase to fight, a planted phase to race, and a score.
// Also the economy — money in, money out, and the buy the bots make for themselves at the top of a
// round, so a bot is never standing on a rifle it cannot afford to have bought.
import { PHASE, TIMING, resetRoundState, siteAt, aliveOf, pushEvent } from './state.js';
import { SPAWNS, SITES } from '../world/mapdata.js';
import { equip } from './player.js';
import { WEAPONS, UTILITY } from './weapons.js';

const WIN_TARGET = 7;
const REWARD = { win: 3250, lossBase: 1400, lossStep: 500, lossCap: 3400, kill: 300, plant: 300, defuse: 300 };

// Put one body back on its spawn slot with a clean slate.
export function respawn(player, slotIndex) {
  const slots = SPAWNS[player.side];
  const slot = slots[slotIndex % slots.length];
  player.x = slot.x;
  player.z = slot.z;
  player.y = 0;
  player.vx = 0;
  player.vz = 0;
  player.vy = 0;
  player.yaw = slot.yaw;
  player.pitch = 0;
  player.health = 100;
  player.alive = true;
  player.crouching = false;
  player.onGround = true;
  player.recoil.pitch = 0;
  player.recoil.yaw = 0;
  player.aimPunch = 0;
  player.weapon.ammo = WEAPONS[player.weapon.id].magazine;
  player.weapon.reloading = false;
  if (player.ai) {
    player.ai.routeIndex = 0;
    player.ai.state = 'advance';
    player.ai.targetId = null;
    player.ai.canSee = false;
    player.ai.thinkAt = 0;
    player.ai.stuckFor = 0;
    player.ai.planting = false;
  }
}

// What a bot decides to hold at the top of a round.
function botBuy(match, bot, rng) {
  if (bot.money >= WEAPONS.marlow.price + UTILITY.kevlar.price) {
    bot.money -= WEAPONS.marlow.price + UTILITY.kevlar.price;
    equip(bot, 'marlow');
    bot.armor = UTILITY.kevlar.armor;
    return;
  }
  if (bot.money >= WEAPONS.marlow.price) {
    bot.money -= WEAPONS.marlow.price;
    equip(bot, 'marlow');
    return;
  }
  if (bot.money >= WEAPONS.vesper.price) {
    bot.money -= WEAPONS.vesper.price;
    equip(bot, 'vesper');
    if (bot.money >= UTILITY.kevlar.price) {
      bot.money -= UTILITY.kevlar.price;
      bot.armor = UTILITY.kevlar.armor;
    }
    return;
  }
  if (rng.next() < 0.5) equip(bot, 'sidewinder');
}

// Open the next round: re-spawn everyone, hand the device to one Tide player, let the bots shop.
export function startRound(match, rng) {
  match.round += 1;
  resetRoundState(match);
  match.roundWinner = null;
  match.message = match.round === 1 ? 'Round 1 · buy phase' : `Round ${match.round} · buy phase`;

  const slots = { tide: 0, warden: 0 };
  for (const player of match.players) {
    const index = slots[player.side];
    slots[player.side] += 1;
    respawn(player, index);
    if (player.isBot) botBuy(match, player, rng);
    // A player who died last round comes back with only a sidearm; survival keeps your gun.
    if (!player.isBot) {
      if ((player.deaths ?? 0) > 0 && !player.keptWeapon) {
        player.inventory = ['sidewinder'];
        equip(player, 'sidewinder');
      }
      player.keptWeapon = false;
    }
  }

  const tide = match.players.filter((p) => p.side === 'tide' && p.alive);
  const carrier = tide.find((p) => p.id === match.playerId) ?? tide[0];
  if (carrier) {
    match.bomb.state = 'carried';
    match.bomb.carrierId = carrier.id;
  }
  pushEvent(match, { type: 'round-start', round: match.round });
}

// Award the money and the score for a finished round.
function settle(match, winner, reason) {
  match.phase = PHASE.over;
  match.phaseTimer = 4;
  match.roundWinner = winner;
  match.roundReason = reason;
  match.score[winner] += 1;
  match.message = `${winner === 'tide' ? 'TIDE' : 'WARDEN'} take the round · ${reason}`;
  for (const player of match.players) {
    if (player.side === winner) {
      player.money = Math.min(16000, player.money + REWARD.win);
      player.lossStreak = 0;
    } else {
      player.lossStreak = Math.min(3, (player.lossStreak ?? 0) + 1);
      const payout = Math.min(REWARD.lossCap, REWARD.lossBase + REWARD.lossStep * (player.lossStreak - 1));
      player.money = Math.min(16000, player.money + payout);
    }
  }
  pushEvent(match, { type: 'round-end', winner, reason, score: { ...match.score } });
  if (match.score[winner] >= WIN_TARGET) {
    match.phase = PHASE.matchOver;
    match.message = `${winner === 'tide' ? 'TIDE' : 'WARDEN'} win the match ${match.score.tide}–${match.score.warden}`;
    pushEvent(match, { type: 'match-end', winner });
  }
}

// The device: planting, ticking, defusing. Called every step with whoever is holding the use key.
export function tickBomb(match, dt, planters, defusers) {
  const bomb = match.bomb;

  if (match.phase === PHASE.live && bomb.state === 'carried') {
    const planter = planters.find((p) => p.alive && siteAt(p.x, p.z) !== null);
    if (planter) {
      const site = siteAt(planter.x, planter.z);
      bomb.plantProgress += dt / 3.1;
      bomb.site = site.id;
      if (bomb.plantProgress >= 1) {
        bomb.state = 'planted';
        bomb.x = planter.x;
        bomb.z = planter.z;
        bomb.timer = TIMING.BOMB_SECONDS;
        bomb.plantProgress = 0;
        bomb.carrierId = null;
        match.phase = PHASE.planted;
        match.phaseTimer = TIMING.BOMB_SECONDS;
        planter.money += REWARD.plant;
        match.message = `Device planted on ${site.name}`;
        pushEvent(match, { type: 'planted', site: site.id, x: bomb.x, z: bomb.z });
      }
    } else {
      bomb.plantProgress = Math.max(0, bomb.plantProgress - dt * 1.4);
    }
    return;
  }

  if (bomb.state === 'planted') {
    bomb.timer -= dt;
    match.phaseTimer = bomb.timer;
    const defuser = defusers.find((p) => p.alive && Math.hypot(p.x - bomb.x, p.z - bomb.z) < 1.3);
    if (defuser) {
      bomb.defuseProgress += dt / 6.6;
      bomb.defuserId = defuser.id;
      if (bomb.defuseProgress >= 1) {
        bomb.state = 'defused';
        defuser.money += REWARD.defuse;
        settle(match, 'warden', 'Device defused');
        pushEvent(match, { type: 'defused', by: defuser.id });
      }
    } else {
      bomb.defuseProgress = Math.max(0, bomb.defuseProgress - dt * 1.6);
      bomb.defuserId = null;
    }
    if (bomb.state === 'planted' && bomb.timer <= 0) {
      bomb.state = 'exploded';
      settle(match, 'tide', 'Device detonated');
      pushEvent(match, { type: 'exploded', x: bomb.x, z: bomb.z });
    }
  }
}

// Phase clock, elimination check, and the hand-off to the next round.
export function tickRounds(match, dt) {
  if (match.phase === PHASE.matchOver) return;

  if (match.phase === PHASE.freeze) {
    match.phaseTimer -= dt;
    if (match.phaseTimer <= 0) {
      match.phase = PHASE.live;
      match.phaseTimer = TIMING.ROUND_SECONDS;
      match.message = '';
      pushEvent(match, { type: 'live' });
    }
    return;
  }

  if (match.phase === PHASE.live) {
    match.phaseTimer -= dt;
    const tideAlive = aliveOf(match, 'tide');
    const wardenAlive = aliveOf(match, 'warden');
    if (wardenAlive === 0) settle(match, 'tide', 'Warden eliminated');
    else if (tideAlive === 0) settle(match, 'warden', 'Tide eliminated');
    else if (match.phaseTimer <= 0) settle(match, 'warden', 'Time expired');
    return;
  }

  if (match.phase === PHASE.planted) {
    const wardenAlive = aliveOf(match, 'warden');
    if (wardenAlive === 0) settle(match, 'tide', 'Warden eliminated');
    return;
  }

  if (match.phase === PHASE.over) {
    match.phaseTimer -= dt;
    if (match.phaseTimer <= 0) startRound(match, match.rng);
  }
}

// A site's name, for the HUD and the killfeed.
export function siteName(id) {
  const site = SITES.find((s) => s.id === id);
  return site ? site.name : '—';
}

export { WIN_TARGET, REWARD };
