// The renderer's half of the game: a dusk-lit refinery, six bodies built from capsules, and short
// lived effects for tracers, impacts and blasts. Everything is pooled and reused, so a long round
// does not grow the scene graph.
import * as THREE from 'three';
import { PALETTE } from '../core/palette.js';
import { buildWorld } from '../world/world.js';
import { WEAPONS } from '../sim/weapons.js';

const MAX_TRACERS = 24;
const MAX_SPARKS = 40;

// A sky with a horizon: a vertical gradient baked into a canvas, on the inside of a big sphere. The
// warm band sits just above the horizon line, which is what makes the map feel like dusk rather than
// a grey box with a dark lid.
function makeSky() {
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#0c1822');
  grad.addColorStop(0.3, '#27414f');
  grad.addColorStop(0.42, '#5c6a70');
  grad.addColorStop(0.48, '#b98a5c');
  grad.addColorStop(0.52, '#e8ab6b');
  grad.addColorStop(0.6, '#8a6a52');
  grad.addColorStop(1.0, '#3d332e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 8, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(220, 24, 16),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide, depthWrite: false, fog: false }),
  );
  sky.name = 'sky';

  // The sun itself, low in the west, so the light in the scene has a source you can see.
  const glow = document.createElement('canvas');
  glow.width = 128;
  glow.height = 128;
  const gctx = glow.getContext('2d');
  const radial = gctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  radial.addColorStop(0, '#fff0cf');
  radial.addColorStop(0.22, '#ffc98a');
  radial.addColorStop(0.55, '#c47a3c66');
  radial.addColorStop(1, '#c47a3c00');
  gctx.fillStyle = radial;
  gctx.fillRect(0, 0, 128, 128);
  const sunTex = new THREE.CanvasTexture(glow);
  sunTex.colorSpace = THREE.SRGBColorSpace;
  const sunSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: sunTex, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
  );
  sunSprite.scale.setScalar(96);
  sunSprite.position.set(-152, 34, 134);
  sky.add(sunSprite);
  return sky;
}

// A body that reads as a soldier at thirty metres: dark fatigues, a team-coloured shoulder yoke and
// helmet band, a chest rig, two legs with boots, and a rifle pointing down the model's +z axis (which
// is the direction the actor faces once the mesh is turned to the player's yaw).
function makeActorMesh(side) {
  const group = new THREE.Group();
  const accent = side === 'tide' ? PALETTE.tide : PALETTE.warden;
  const cloth = new THREE.MeshStandardMaterial({ color: 0x3c3a33, roughness: 0.86, metalness: 0.04 });
  const yoke = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.7, metalness: 0.1 });
  const gear = new THREE.MeshStandardMaterial({ color: 0x22241f, roughness: 0.66, metalness: 0.24 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xa8815f, roughness: 0.92 });
  const boot = new THREE.MeshStandardMaterial({ color: 0x191a17, roughness: 0.9 });

  const add = (mesh, x, y, z) => {
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.46, 0.24), cloth);
  add(torso, 0, 1.16, 0);

  // Chest rig and belt read as load-bearing kit rather than a naked torso.
  add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.09), gear), 0, 1.2, 0.14);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.07, 0.26), gear), 0, 0.94, 0);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.14), gear), 0, 1.19, -0.19);

  // Shoulder yoke in team colour: the fastest way for a player to read friend or enemy.
  add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.13, 0.22), yoke), -0.25, 1.34, 0);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.13, 0.22), yoke), 0.25, 1.34, 0);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.135, 12, 10), skin);
  add(head, 0, 1.56, 0.01);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.168, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58), gear);
  add(helmet, 0, 1.58, 0);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.035, 0.06), yoke), 0, 1.66, 0.12);
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.19, 0.06, 0.03),
    new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.55, roughness: 0.4 }),
  );
  add(visor, 0, 1.53, 0.14);

  // Arms: the right hand on the grip, the left out on the handguard.
  const armGeo = new THREE.CapsuleGeometry(0.062, 0.34, 3, 8);
  const rightArm = add(new THREE.Mesh(armGeo, cloth), 0.2, 1.19, 0.16);
  rightArm.rotation.set(-0.95, 0, 0.22);
  const leftArm = add(new THREE.Mesh(armGeo, cloth), -0.12, 1.22, 0.3);
  leftArm.rotation.set(-1.15, 0, -0.35);

  const legGeo = new THREE.CapsuleGeometry(0.085, 0.42, 3, 8);
  add(new THREE.Mesh(legGeo, cloth), -0.11, 0.5, 0);
  add(new THREE.Mesh(legGeo, cloth), 0.11, 0.5, 0);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.24), boot), -0.11, 0.07, 0.03);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.24), boot), 0.11, 0.07, 0.03);

  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.66), gear);
  add(gun, 0.13, 1.26, 0.34);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.08), gear), 0.13, 1.14, 0.3);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.24), gear), 0.13, 1.29, 0.62);

  group.userData.gun = gun;
  group.userData.cloth = yoke;
  return group;
}

export function createRenderWorld() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  document.getElementById('stage').appendChild(renderer.domElement);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.16;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(PALETTE.fog, 26, 96);
  scene.add(makeSky());

  const hemi = new THREE.HemisphereLight(0x9fc4d8, 0x6a5236, 1.25);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffd2a0, 2.0);
  sun.position.set(-34, 26, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -42;
  sun.shadow.camera.right = 42;
  sun.shadow.camera.top = 42;
  sun.shadow.camera.bottom = -42;
  sun.shadow.camera.far = 130;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.035;
  scene.add(sun);
  scene.add(sun.target);

  const fill = new THREE.DirectionalLight(0x7fa0c0, 0.75);
  fill.position.set(26, 14, -30);
  scene.add(fill);

  // A soft bounce from the sand floor keeps the shadowed sides readable instead of crushing to black.
  const bounce = new THREE.DirectionalLight(0xd9b98c, 0.4);
  bounce.position.set(6, -18, 4);
  scene.add(bounce);

  const level = buildWorld();
  scene.add(level.group);

  const camera = new THREE.PerspectiveCamera(76, 16 / 9, 0.05, 260);
  camera.rotation.order = 'YXZ';

  const actors = new Map();
  const tracerGroup = new THREE.Group();
  const sparkGroup = new THREE.Group();
  scene.add(tracerGroup);
  scene.add(sparkGroup);

  const tracerPool = [];
  const sparkPool = [];
  for (let i = 0; i < MAX_TRACERS; i += 1) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending }),
    );
    line.visible = false;
    line.frustumCulled = false;
    tracerGroup.add(line);
    tracerPool.push(line);
  }
  const sparkGeo = new THREE.SphereGeometry(0.06, 6, 4);
  for (let i = 0; i < MAX_SPARKS; i += 1) {
    const spark = new THREE.Mesh(
      sparkGeo,
      new THREE.MeshBasicMaterial({ color: 0xffcf8a, transparent: true, opacity: 1, blending: THREE.AdditiveBlending }),
    );
    spark.visible = false;
    sparkGroup.add(spark);
    sparkPool.push(spark);
  }

  const muzzle = new THREE.PointLight(0xffc27a, 0, 14, 2);
  scene.add(muzzle);

  function actorFor(player) {
    let mesh = actors.get(player.id);
    if (!mesh) {
      mesh = makeActorMesh(player.side);
      actors.set(player.id, mesh);
      scene.add(mesh);
    }
    return mesh;
  }

  // Push the match state onto the meshes. Deaths drop the body flat and keep it on the floor.
  function syncActors(match, time) {
    for (const player of match.players) {
      // The local player is the camera: drawing their body would put a torso in front of the lens.
      if (player.id === match.playerId) continue;
      const mesh = actorFor(player);
      mesh.visible = true;
      mesh.position.set(player.x, player.y, player.z);
      mesh.rotation.y = player.yaw + Math.PI;
      const crouch = player.crouching ? 0.72 : 1;
      mesh.scale.set(1, crouch, 1);
      if (!player.alive) {
        const since = Math.max(0, time - (player.diedAt ?? time));
        const fall = Math.min(1, since / 0.45);
        mesh.rotation.x = -Math.PI * 0.5 * fall;
        mesh.position.y = player.y + 0.16 * fall;
      } else {
        mesh.rotation.x = 0;
      }
      mesh.userData.cloth.emissive = new THREE.Color(
        player.flinch > 0.05 ? PALETTE.flinch : 0x000000,
      );
      mesh.userData.cloth.emissiveIntensity = player.flinch > 0.05 ? player.flinch * 1.4 : 0;
    }
    // Only living bodies should stand in front of the camera.
    for (const [id, mesh] of actors) {
      if (!match.players.some((p) => p.id === id)) mesh.visible = false;
    }
  }

  // Effects live for a fraction of a second: tracer streak, impact spark, blast flash.
  function syncEffects(effects, time, viewFrom) {
    let tracerIndex = 0;
    let sparkIndex = 0;
    for (const effect of effects) {
      const age = time - effect.born;
      if (age > 1.4) continue;
      if (effect.kind === 'tracer' && tracerIndex < MAX_TRACERS) {
        const line = tracerPool[tracerIndex];
        tracerIndex += 1;
        const pos = line.geometry.attributes.position;
        pos.setXYZ(0, effect.fromX, effect.fromY, effect.fromZ);
        pos.setXYZ(1, effect.toX, effect.toY, effect.toZ);
        pos.needsUpdate = true;
        line.material.opacity = Math.max(0, 0.85 - age * 1.6);
        line.visible = true;
      } else if ((effect.kind === 'impact' || effect.kind === 'blood') && sparkIndex < MAX_SPARKS) {
        const spark = sparkPool[sparkIndex];
        sparkIndex += 1;
        spark.position.set(effect.x, effect.y, effect.z);
        spark.material.color.set(effect.kind === 'blood' ? 0x8f2f24 : 0xffcf8a);
        spark.material.opacity = Math.max(0, 1 - age * 2.4);
        spark.scale.setScalar(effect.kind === 'blood' ? 1.6 : 1);
        spark.visible = true;
      } else if (effect.kind === 'blast' && sparkIndex < MAX_SPARKS) {
        const spark = sparkPool[sparkIndex];
        sparkIndex += 1;
        spark.position.set(effect.x, effect.y + 0.4, effect.z);
        spark.material.color.set(0xffb066);
        spark.material.opacity = Math.max(0, 0.9 - age * 1.1);
        spark.scale.setScalar(4 + age * 26);
        spark.visible = true;
      }
    }
    for (let i = tracerIndex; i < MAX_TRACERS; i += 1) tracerPool[i].visible = false;
    for (let i = sparkIndex; i < MAX_SPARKS; i += 1) sparkPool[i].visible = false;
    if (viewFrom) muzzle.position.set(viewFrom.x, viewFrom.y, viewFrom.z);
  }

  // The bomb: a squat box with a blinking beacon, so the device is visible on the floor.
  const bombMesh = new THREE.Group();
  const bombBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.2, 0.26),
    new THREE.MeshStandardMaterial({ color: 0x23282c, roughness: 0.55, metalness: 0.4 }),
  );
  bombBody.position.y = 0.1;
  bombMesh.add(bombBody);
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 8, 6),
    new THREE.MeshBasicMaterial({ color: PALETTE.signal }),
  );
  beacon.position.set(0, 0.24, 0);
  bombMesh.add(beacon);
  const bombLight = new THREE.PointLight(PALETTE.signal, 1.6, 6);
  bombLight.position.y = 0.3;
  bombMesh.add(bombLight);
  scene.add(bombMesh);

  function syncBomb(match, time) {
    const bomb = match.bomb;
    if (bomb.state === 'planted') {
      bombMesh.visible = true;
      bombMesh.position.set(bomb.x, 0, bomb.z);
      const blink = 0.55 + 0.45 * Math.sin(time * (bomb.timer < 10 ? 22 : 8));
      beacon.material.color.set(bomb.timer < 10 ? 0xff4a2a : PALETTE.signal);
      bombLight.intensity = 0.8 + blink * 2.4;
    } else {
      bombMesh.visible = false;
    }
  }

  function setMuzzle(intensity) {
    muzzle.intensity = intensity;
  }

  function resize(width, height) {
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
  }

  return {
    renderer,
    scene,
    camera,
    level,
    resize,
    syncActors,
    syncEffects,
    syncBomb,
    setMuzzle,
    sun,
  };
}
