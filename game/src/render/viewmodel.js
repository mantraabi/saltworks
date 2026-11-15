// The first-person weapon: modelled from boxes at load, held under the camera, and animated by hand
// — sway, bob, recoil kick, reload roll. The models are deliberately chunky: at this scale a clean
// silhouette reads better than detail.
import * as THREE from 'three';
import { PALETTE } from '../core/palette.js';
import { WEAPONS, currentSpread } from '../sim/weapons.js';

function metal(color, roughness = 0.38, metalness = 0.82) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function box(w, h, d, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = false;
  return mesh;
}

// Each gun is built from the same primitives, only the proportions and the furniture change.
function buildRifle(accent) {
  const group = new THREE.Group();
  const steel = metal(PALETTE.steel);
  const dark = metal(PALETTE.gunmetal, 0.62, 0.45);
  const poly = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.72, metalness: 0.1 });
  group.add(box(0.075, 0.085, 0.44, dark, 0, 0, -0.12));
  group.add(box(0.045, 0.045, 0.5, steel, 0, 0.012, -0.5));
  group.add(box(0.06, 0.06, 0.16, steel, 0, 0.005, -0.76));
  group.add(box(0.07, 0.16, 0.1, dark, 0, -0.1, -0.04));
  group.add(box(0.06, 0.13, 0.16, poly, 0, -0.02, 0.16));
  group.add(box(0.055, 0.1, 0.08, poly, 0, -0.06, 0.02));
  group.add(box(0.02, 0.05, 0.02, steel, 0, 0.08, -0.32));
  group.add(box(0.03, 0.07, 0.03, steel, 0, 0.07, -0.02));
  group.add(box(0.05, 0.02, 0.1, dark, 0, 0.095, -0.1));
  return group;
}

function buildPistol(accent) {
  const group = new THREE.Group();
  const steel = metal(PALETTE.gunmetal, 0.34, 0.9);
  const poly = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.68, metalness: 0.12 });
  group.add(box(0.06, 0.075, 0.26, steel, 0, 0.02, -0.14));
  group.add(box(0.05, 0.03, 0.2, steel, 0, 0.058, -0.13));
  group.add(box(0.055, 0.13, 0.085, poly, 0, -0.075, 0.0));
  group.add(box(0.035, 0.04, 0.03, steel, 0, 0.075, -0.26));
  return group;
}

function buildKnife() {
  const group = new THREE.Group();
  const steel = metal(0xd6dde2, 0.22, 0.96);
  const grip = new THREE.MeshStandardMaterial({ color: PALETTE.rust, roughness: 0.85 });
  group.add(box(0.02, 0.09, 0.24, steel, 0, 0.02, -0.2));
  group.add(box(0.028, 0.05, 0.1, grip, 0, 0.0, 0.0));
  group.add(box(0.05, 0.014, 0.03, steel, 0, 0.0, -0.08));
  return group;
}

// Two gloved hands around the grip — enough to sell that somebody is holding this.
function buildHands() {
  const group = new THREE.Group();
  const glove = new THREE.MeshStandardMaterial({ color: 0x2a2b26, roughness: 0.9, metalness: 0.05 });
  const cuff = new THREE.MeshStandardMaterial({ color: 0x4b4a3c, roughness: 0.92 });
  const right = box(0.075, 0.1, 0.13, glove, 0.012, -0.075, 0.05);
  right.rotation.x = 0.22;
  group.add(right);
  group.add(box(0.09, 0.06, 0.09, cuff, 0.012, -0.1, 0.16));
  const left = box(0.07, 0.09, 0.12, glove, -0.055, -0.06, -0.16);
  left.rotation.set(0.18, 0.3, 0);
  group.add(left);
  group.add(box(0.085, 0.055, 0.08, cuff, -0.08, -0.075, -0.05));
  return group;
}

export function createViewmodel(camera) {
  const root = new THREE.Group();
  root.position.set(0.2, -0.21, -0.46);
  root.scale.setScalar(0.82);
  camera.add(root);

  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.26, 0.26),
    new THREE.MeshBasicMaterial({
      color: 0xffd08a,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    }),
  );
  flash.position.set(0.02, 0.03, -0.72);
  flash.visible = false;
  root.add(flash);

  const flashLight = new THREE.PointLight(0xffc07a, 0, 9, 2);
  flashLight.position.set(0.1, 0.1, -0.6);
  root.add(flashLight);

  const models = new Map();
  const accentFor = (id) =>
    id === 'marlow' ? 0x3d4a3a : id === 'vesper' ? 0x4a3f34 : id === 'sidewinder' ? 0x3a3d42 : PALETTE.rust;

  function modelFor(id) {
    if (models.has(id)) return models.get(id);
    let group;
    if (id === 'marlow') group = buildRifle(accentFor(id));
    else if (id === 'vesper') group = buildRifle(accentFor(id));
    else if (id === 'sidewinder') group = buildPistol(accentFor(id));
    else group = buildKnife();
    group.add(buildHands());
    group.visible = false;
    root.add(group);
    models.set(id, group);
    return group;
  }

  let currentId = null;
  let kick = 0;
  let flashFor = 0;
  let bobPhase = 0;
  let reloadT = 0;

  function sync(player, dt, time) {
    if (!player) return;
    const id = player.weapon.id;
    if (id !== currentId) {
      for (const [, m] of models) m.visible = false;
      modelFor(id).visible = true;
      currentId = id;
      kick = 0;
    }
    const model = modelFor(id);
    const speed = Math.hypot(player.vx, player.vz);
    bobPhase += dt * (4 + speed * 1.6);
    const bobX = Math.sin(bobPhase) * 0.006 * (0.4 + speed * 0.3);
    const bobY = Math.abs(Math.cos(bobPhase)) * 0.005 * (0.4 + speed * 0.35);

    if (player.weapon.reloading) {
      reloadT = Math.min(1, reloadT + dt * 3.2);
    } else {
      reloadT = Math.max(0, reloadT - dt * 5);
    }
    const reloadRoll = Math.sin(reloadT * Math.PI) * 0.5;

    kick = Math.max(0, kick - dt * 7.5);
    const spread = currentSpread(player);

    root.position.set(
      0.2 + bobX + spread * 0.12,
      -0.21 + bobY - kick * 0.012 + reloadRoll * -0.1,
      -0.46 + kick * 0.045,
    );
    root.rotation.set(-kick * 0.06 + reloadRoll * 0.5, reloadRoll * -0.35 + kick * 0.02, reloadRoll * 0.3);

    if (flashFor > 0) {
      flashFor -= dt;
      const life = Math.max(0, flashFor / 0.055);
      flash.visible = true;
      flash.material.opacity = life * 0.9;
      flash.rotation.z = time * 40;
      flash.scale.setScalar(0.8 + life * 0.5);
      flashLight.intensity = life * 5.5;
    } else {
      flash.visible = false;
      flash.material.opacity = 0;
      flashLight.intensity = 0;
    }
    return model;
  }

  function onShot() {
    kick = Math.min(1.6, kick + 0.55);
    flashFor = 0.055;
  }

  return { root, sync, onShot, get weaponId() { return currentId; } };
}

export { buildRifle, buildPistol, buildKnife };
