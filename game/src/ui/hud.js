// The HUD. It reads the match and writes text nodes; it never simulates. Crosshair gap follows the
// real spread, the killfeed is a sliding list, and the device panel is the only thing that changes
// colour when the round is about to be decided.
import { currentSpread, WEAPONS } from '../sim/weapons.js';
import { PHASE } from '../sim/state.js';
import { SITES } from '../world/mapdata.js';

const fmtTime = (seconds) => {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function createHud(root) {
  const el = (id) => root.querySelector(`#${id}`);
  const refs = {
    health: el('hud-health'),
    healthBar: el('hud-health-bar'),
    armor: el('hud-armor'),
    armorBar: el('hud-armor-bar'),
    ammo: el('hud-ammo'),
    reserve: el('hud-reserve'),
    weapon: el('hud-weapon'),
    money: el('hud-money'),
    timer: el('hud-timer'),
    phase: el('hud-phase'),
    scoreTide: el('hud-score-tide'),
    scoreWarden: el('hud-score-warden'),
    killfeed: el('hud-killfeed'),
    message: el('hud-message'),
    bomb: el('hud-bomb'),
    bombFill: el('hud-bomb-fill'),
    bombLabel: el('hud-bomb-label'),
    crosshair: el('hud-crosshair'),
    hitmarker: el('hud-hitmarker'),
    damage: el('hud-damage'),
    hint: el('hud-hint'),
  };
  const crossLines = ['top', 'right', 'bottom', 'left'].map((side) => {
    const line = document.createElement('i');
    line.className = `cross-${side}`;
    refs.crosshair.appendChild(line);
    return { side, line };
  });

  let lastKillCount = 0;
  let hitmarkerUntil = 0;
  let damageUntil = 0;
  let lastRenderSignature = '';

  function update(match, player, time) {
    if (!player) return;
    const spread = currentSpread(player);
    const speed = Math.hypot(player.vx, player.vz);
    const gap = 4 + spread * 900 + speed * 1.4;
    refs.crosshair.style.setProperty('--gap', `${gap.toFixed(1)}px`);
    refs.crosshair.classList.toggle('firing', match.time - (player.lastShotAt ?? -9) < 0.08);

    const phaseLabel =
      match.phase === PHASE.freeze
        ? 'BUY PHASE'
        : match.phase === PHASE.planted
          ? 'DEVICE ARMED'
          : match.phase === PHASE.over
            ? 'ROUND OVER'
            : match.phase === PHASE.matchOver
              ? 'MATCH OVER'
              : 'LIVE';

    const signature = [
      Math.round(player.health),
      Math.round(player.armor),
      player.weapon.ammo,
      player.weapon.reserve,
      player.money,
      phaseLabel,
      Math.ceil(match.phaseTimer),
      match.score.tide,
      match.score.warden,
      match.killfeed.length,
      player.weapon.id,
    ].join('|');
    if (signature === lastRenderSignature) {
      if (time < hitmarkerUntil) refs.hitmarker.classList.add('on');
      else refs.hitmarker.classList.remove('on');
      refs.damage.style.opacity = String(Math.max(0, Math.min(1, (damageUntil - time) * 1.6)));
      return;
    }
    lastRenderSignature = signature;

    refs.health.textContent = String(Math.max(0, Math.round(player.health)));
    refs.healthBar.style.width = `${Math.max(0, player.health)}%`;
    refs.armor.textContent = String(Math.round(player.armor));
    refs.armorBar.style.width = `${Math.max(0, player.armor)}%`;
    refs.ammo.textContent = WEAPONS[player.weapon.id].melee ? '—' : String(player.weapon.ammo);
    refs.reserve.textContent = WEAPONS[player.weapon.id].melee ? '' : `/ ${player.weapon.reserve}`;
    refs.weapon.textContent = WEAPONS[player.weapon.id].name;
    refs.money.textContent = `$${player.money}`;
    refs.timer.textContent = match.phase === PHASE.planted ? fmtTime(match.bomb.timer) : fmtTime(match.phaseTimer);
    refs.phase.textContent = phaseLabel;
    refs.scoreTide.textContent = String(match.score.tide);
    refs.scoreWarden.textContent = String(match.score.warden);
    refs.message.textContent = match.message;
    refs.message.style.opacity = match.message ? '1' : '0';

    if (match.bomb.state === 'planted') {
      const site = SITES.find((s) => s.id === match.bomb.site);
      refs.bomb.classList.add('armed');
      refs.bombLabel.textContent = `DEVICE · ${site ? site.name : 'SITE'}`;
      refs.bombFill.style.width = `${Math.max(0, Math.min(1, match.bomb.timer / 40)) * 100}%`;
      refs.bomb.classList.toggle('critical', match.bomb.timer < 10);
    } else if (match.bomb.state === 'carried' && match.bomb.carrierId === player.id) {
      refs.bomb.classList.add('armed');
      refs.bomb.classList.remove('critical');
      refs.bombLabel.textContent = 'YOU CARRY THE DEVICE';
      refs.bombFill.style.width = `${(match.bomb.plantProgress ?? 0) * 100}%`;
    } else {
      refs.bomb.classList.remove('armed', 'critical');
      refs.bombLabel.textContent = match.bomb.state === 'defused' ? 'DEVICE DEFUSED' : '';
      refs.bombFill.style.width = '0%';
    }

    // Killfeed: rebuild only when it changed.
    if (match.killfeed.length !== lastKillCount) {
      lastKillCount = match.killfeed.length;
      refs.killfeed.textContent = '';
      for (const entry of match.killfeed.slice(-4)) {
        const row = document.createElement('div');
        row.className = `feed ${entry.killerSide === 'tide' ? 'friendly' : 'enemy'}`;
        const zone = entry.zone === 'head' ? ' · HS' : '';
        row.textContent = `${entry.killerName} → ${entry.victimName}${zone}`;
        refs.killfeed.appendChild(row);
      }
    }

    if (time < hitmarkerUntil) refs.hitmarker.classList.add('on');
    else refs.hitmarker.classList.remove('on');
    refs.damage.style.opacity = String(Math.max(0, Math.min(1, (damageUntil - time) * 1.6)));
  }

  // Called from the loop when the simulation reports a hit on, or by, the player.
  function markHit(time, lethal) {
    hitmarkerUntil = time + (lethal ? 0.42 : 0.16);
    refs.hitmarker.classList.toggle('lethal', Boolean(lethal));
  }

  function markDamage(time) {
    damageUntil = time + 0.55;
  }

  function setHint(text) {
    refs.hint.textContent = text;
    refs.hint.style.opacity = text ? '1' : '0';
  }

  return { update, markHit, markDamage, setHint, refs };
}
