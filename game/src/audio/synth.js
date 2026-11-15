// Sound, synthesised. No audio files: a shot is a noise burst through a low-pass, a hit is a short
// click, the device is a two-tone beacon. The context is created on the first click, because a
// browser will not let a page make noise before the user touches it.
export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let muted = false;

  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    const length = Math.floor(ctx.sampleRate * 0.5);
    noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  }

  function noise(duration, gain, frequency, q = 1) {
    if (!ctx || muted) return;
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = frequency;
    filter.Q.value = q;
    const amp = ctx.createGain();
    const now = ctx.currentTime;
    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.0008, now + duration);
    source.connect(filter);
    filter.connect(amp);
    amp.connect(master);
    source.start(now);
    source.stop(now + duration + 0.02);
  }

  function tone(frequency, duration, gain, type = 'square') {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    const now = ctx.currentTime;
    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.0008, now + duration);
    osc.connect(amp);
    amp.connect(master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  // Per-weapon voice: a rifle cracks, an SMG chatters, a pistol snaps, a knife is cloth and a thud.
  function shot(weaponId) {
    if (weaponId === 'marlow') {
      noise(0.16, 0.5, 2200);
      tone(96, 0.09, 0.16, 'sawtooth');
    } else if (weaponId === 'vesper') {
      noise(0.1, 0.38, 3000);
      tone(140, 0.06, 0.1, 'square');
    } else if (weaponId === 'sidewinder') {
      noise(0.13, 0.44, 1800);
      tone(120, 0.07, 0.12, 'sawtooth');
    } else {
      noise(0.07, 0.2, 900);
    }
  }

  return {
    unlock,
    shot,
    hit(lethal) {
      tone(lethal ? 210 : 620, lethal ? 0.12 : 0.05, 0.14, 'triangle');
    },
    hurt() {
      noise(0.2, 0.3, 500);
    },
    reload() {
      noise(0.05, 0.18, 1400);
      window.setTimeout(() => noise(0.04, 0.14, 900), 110);
    },
    step() {
      noise(0.05, 0.07, 620);
    },
    plant() {
      tone(880, 0.12, 0.16, 'square');
      window.setTimeout(() => tone(1320, 0.12, 0.14, 'square'), 140);
    },
    explode() {
      noise(0.7, 0.8, 420);
      tone(52, 0.5, 0.3, 'sine');
    },
    roundStart() {
      tone(440, 0.1, 0.1, 'triangle');
      window.setTimeout(() => tone(660, 0.12, 0.1, 'triangle'), 130);
    },
    roundEnd(won) {
      const notes = won ? [523, 659, 784] : [392, 330, 262];
      notes.forEach((n, i) => window.setTimeout(() => tone(n, 0.18, 0.12, 'triangle'), i * 130));
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get ready() {
      return Boolean(ctx) && !muted;
    },
  };
}
