// Materials: every surface texture is drawn here, on a canvas, at load. No image files, no network
// requests — the refinery's concrete, oxide and hazard paint are generated from the palette with a
// seeded generator, so two loads of the same build look identical.
import * as THREE from 'three';
import { PALETTE } from '../core/palette.js';
import { createRng, hashSeed } from '../core/rng.js';

const TEX = 256;

function canvasOf(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function finish(canvas, repeat = 1) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.anisotropy = 4;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Concrete: a flat base, a thousand grits of dust, then a few long stains that run downward.
function concreteCanvas(seed, base) {
  const canvas = canvasOf(TEX);
  const ctx = canvas.getContext('2d');
  const rng = createRng(hashSeed('concrete', seed));
  const colour = new THREE.Color(base);
  ctx.fillStyle = `#${colour.getHexString()}`;
  ctx.fillRect(0, 0, TEX, TEX);
  for (let i = 0; i < 2600; i += 1) {
    const shade = rng.range(-0.13, 0.16);
    const c = colour.clone().offsetHSL(0, rng.range(-0.02, 0.02), shade);
    ctx.fillStyle = `#${c.getHexString()}`;
    const s = rng.range(1, 3.4);
    ctx.fillRect(rng.range(0, TEX), rng.range(0, TEX), s, s);
  }
  for (let i = 0; i < 9; i += 1) {
    const x = rng.range(0, TEX);
    const w = rng.range(3, 14);
    const y = rng.range(-40, TEX * 0.7);
    const h = rng.range(40, 190);
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, 'rgba(30,24,18,0.16)');
    grad.addColorStop(1, 'rgba(30,24,18,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);
  }
  return canvas;
}

// Painted steel: plate seams, rivets, and rust blooming out of a seam.
function steelCanvas(seed, base) {
  const canvas = canvasOf(TEX);
  const ctx = canvas.getContext('2d');
  const rng = createRng(hashSeed('steel', seed));
  const colour = new THREE.Color(base);
  ctx.fillStyle = `#${colour.getHexString()}`;
  ctx.fillRect(0, 0, TEX, TEX);
  for (let i = 0; i < 1500; i += 1) {
    const c = colour.clone().offsetHSL(0, rng.range(-0.03, 0.03), rng.range(-0.09, 0.09));
    ctx.fillStyle = `#${c.getHexString()}`;
    ctx.fillRect(rng.range(0, TEX), rng.range(0, TEX), rng.range(1, 4), rng.range(1, 4));
  }
  ctx.strokeStyle = 'rgba(18,22,26,0.55)';
  ctx.lineWidth = 2;
  for (let y = 0; y <= TEX; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(TEX, y + 0.5);
    ctx.stroke();
  }
  for (let x = 0; x <= TEX; x += 128) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, TEX);
    ctx.stroke();
  }
  const rust = new THREE.Color(PALETTE.rust);
  for (let i = 0; i < 26; i += 1) {
    const x = rng.range(0, TEX);
    const y = rng.range(0, TEX);
    const r = rng.range(3, 22);
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(${Math.round(rust.r * 255)},${Math.round(rust.g * 255)},${Math.round(rust.b * 255)},0.5)`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let x = 6; x < TEX; x += 16) {
    for (let y = 6; y < TEX; y += 16) {
      if (rng.next() > 0.55) continue;
      ctx.fillStyle = 'rgba(226,220,206,0.14)';
      ctx.beginPath();
      ctx.arc(x, y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return canvas;
}

// Sand floor: wind ripples, a cart track, and salt crust patches.
function sandCanvas(seed) {
  const canvas = canvasOf(TEX);
  const ctx = canvas.getContext('2d');
  const rng = createRng(hashSeed('sand', seed));
  const colour = new THREE.Color(PALETTE.sand);
  ctx.fillStyle = `#${colour.offsetHSL(0, 0, -0.06).getHexString()}`;
  ctx.fillRect(0, 0, TEX, TEX);
  for (let i = 0; i < 3400; i += 1) {
    const c = colour.clone().offsetHSL(rng.range(-0.01, 0.01), rng.range(-0.03, 0.03), rng.range(-0.11, 0.09));
    ctx.fillStyle = `#${c.getHexString()}`;
    ctx.fillRect(rng.range(0, TEX), rng.range(0, TEX), rng.range(1, 3), rng.range(1, 3));
  }
  ctx.strokeStyle = 'rgba(255,250,236,0.10)';
  for (let i = 0; i < 22; i += 1) {
    ctx.lineWidth = rng.range(1, 3);
    const y = rng.range(0, TEX);
    ctx.beginPath();
    for (let x = 0; x <= TEX; x += 8) {
      const yy = y + Math.sin((x / TEX) * Math.PI * 2 + i) * 4;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  for (let i = 0; i < 8; i += 1) {
    const x = rng.range(0, TEX);
    const y = rng.range(0, TEX);
    const r = rng.range(10, 30);
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,250,0.22)');
    grad.addColorStop(1, 'rgba(255,255,250,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
}

// Hazard paint: diagonal amber and shadow stripes for the edges of a raised platform.
function hazardCanvas() {
  const canvas = canvasOf(128);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = `#${new THREE.Color(PALETTE.shadow).getHexString()}`;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = `#${new THREE.Color(PALETTE.amber).getHexString()}`;
  ctx.lineWidth = 0;
  for (let i = -128; i < 256; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 16, 0);
    ctx.lineTo(i + 16 + 128, 128);
    ctx.lineTo(i + 128, 128);
    ctx.closePath();
    ctx.fill();
  }
  return canvas;
}

// A crate lid: plywood planks with a stencilled number, so cover reads as cover.
function crateCanvas(seed) {
  const canvas = canvasOf(TEX);
  const ctx = canvas.getContext('2d');
  const rng = createRng(hashSeed('crate', seed));
  const base = new THREE.Color(0x6d5335);
  ctx.fillStyle = `#${base.getHexString()}`;
  ctx.fillRect(0, 0, TEX, TEX);
  for (let y = 0; y < TEX; y += 32) {
    const c = base.clone().offsetHSL(0, rng.range(-0.04, 0.04), rng.range(-0.07, 0.07));
    ctx.fillStyle = `#${c.getHexString()}`;
    ctx.fillRect(0, y + 2, TEX, 28);
    ctx.fillStyle = 'rgba(20,14,8,0.42)';
    ctx.fillRect(0, y, TEX, 2);
  }
  ctx.strokeStyle = 'rgba(30,22,12,0.5)';
  ctx.lineWidth = 5;
  ctx.strokeRect(6, 6, TEX - 12, TEX - 12);
  ctx.fillStyle = 'rgba(232,226,212,0.5)';
  ctx.font = 'bold 44px monospace';
  ctx.fillText(rng.pick(['S-04', 'K-11', 'B-27', 'T-08']), 22, TEX - 34);
  return canvas;
}

// Build the material set once. Each material is shared, so the map costs a handful of draws.
export function buildMaterials() {
  const concreteMap = finish(concreteCanvas('wall', PALETTE.concrete), 3);
  const wall = new THREE.MeshStandardMaterial({ map: concreteMap, roughness: 0.94, metalness: 0.04 });
  const trim = new THREE.MeshStandardMaterial({ map: finish(concreteCanvas('trim', PALETTE.stone ?? 0x6f6a60), 2), roughness: 0.9 });

  const steel = new THREE.MeshStandardMaterial({
    map: finish(steelCanvas('plate', PALETTE.steel), 2),
    roughness: 0.55,
    metalness: 0.55,
  });
  const rusted = new THREE.MeshStandardMaterial({
    map: finish(steelCanvas('rust', PALETTE.rust), 2),
    roughness: 0.78,
    metalness: 0.3,
  });
  const tankMat = new THREE.MeshStandardMaterial({
    map: finish(steelCanvas('tank', 0x9aa39a), 3),
    roughness: 0.42,
    metalness: 0.7,
  });
  const crate = new THREE.MeshStandardMaterial({ map: finish(crateCanvas('crate'), 1), roughness: 0.86 });
  const hazard = new THREE.MeshStandardMaterial({ map: finish(hazardCanvas(), 2), roughness: 0.8 });
  const floor = new THREE.MeshStandardMaterial({
    map: finish(sandCanvas('floor'), 14),
    roughness: 0.97,
    metalness: 0,
  });

  // Paint for the site markings and spawn chevrons; unlit so they read under any lighting.
  const paintA = new THREE.MeshBasicMaterial({ color: PALETTE.amber, transparent: true, opacity: 0.5 });
  const paintB = new THREE.MeshBasicMaterial({ color: 0x6f8fa8, transparent: true, opacity: 0.45 });
  const paintNeutral = new THREE.MeshBasicMaterial({ color: PALETTE.bone, transparent: true, opacity: 0.22 });

  return { wall, trim, steel, rusted, tankMat, crate, hazard, floor, paintA, paintB, paintNeutral };
}

// The look for each prop kind: a mesh material and an accent material for the band.
export const PROP_STYLE = {
  container: { body: 'rusted', accent: 'hazard', accentBand: 0.18 },
  crate: { body: 'crate', accent: 'trim', accentBand: 0.08 },
  barrier: { body: 'wall', accent: 'hazard', accentBand: 0.22 },
  tank: { body: 'tankMat', accent: 'steel', accentBand: 0.1 },
  block: { body: 'wall', accent: 'steel', accentBand: 0.12 },
};
