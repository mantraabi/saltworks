// One store owns the match. Systems read and write it; the renderer only reads it. Keeping the whole
// match in one object is what makes a capture frame, a replay and a debug dump all the same thing.
import { SITES } from '../world/mapdata.js';

export const PHASE = {
  freeze: 'freeze',
  live: 'live',
  planted: 'planted',
  over: 'over',
  matchOver: 'match-over',
};

export const SIDE = { tide: 'tide', warden: 'warden' };

const ROUND_SECONDS = 100;
const FREEZE_SECONDS = 6;
const BOMB_SECONDS = 40;

export function createMatch(seed) {
  return {
    seed,
    tick: 0,
    time: 0,
    phase: PHASE.freeze,
    phaseTimer: FREEZE_SECONDS,
    round: 0,
    score: { tide: 0, warden: 0 },
    roundWinner: null,
    roundReason: '',
    bomb: {
      state: 'carried', // carried | dropped | planted | defused | exploded
      carrierId: null,
      x: 0,
      z: 0,
      timer: 0,
      plantProgress: 0,
      defuseProgress: 0,
      defuserId: null,
      site: null,
    },
    killfeed: [],
    grenades: [],
    events: [],
    players: [],
    playerId: null,
    focus: 1,
    stats: { shots: 0, hits: 0, kills: 0, headshots: 0 },
    message: '',
  };
}

export function siteAt(x, z) {
  for (const site of SITES) {
    const dx = x - site.x;
    const dz = z - site.z;
    if (dx * dx + dz * dz <= site.radius * site.radius) return site;
  }
  return null;
}

export function pushEvent(match, event) {
  match.events.push(event);
  if (match.events.length > 64) match.events.shift();
}

export function addKillfeed(match, entry) {
  match.killfeed.push({ ...entry, born: match.time });
  if (match.killfeed.length > 5) match.killfeed.shift();
}

export function resetRoundState(match) {
  match.phaseTimer = FREEZE_SECONDS;
  match.phase = PHASE.freeze;
  match.bomb.state = 'carried';
  match.bomb.carrierId = null;
  match.bomb.plantProgress = 0;
  match.bomb.defuseProgress = 0;
  match.bomb.defuserId = null;
  match.bomb.site = null;
  match.bomb.timer = 0;
  match.roundWinner = null;
  match.roundReason = '';
  match.killfeed.length = 0;
}

export const TIMING = { ROUND_SECONDS, FREEZE_SECONDS, BOMB_SECONDS };

export function aliveOf(match, side) {
  let count = 0;
  for (const p of match.players) if (p.side === side && p.alive) count += 1;
  return count;
}

export function playerById(match, id) {
  for (const p of match.players) if (p.id === id) return p;
  return null;
}
