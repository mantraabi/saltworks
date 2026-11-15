// The look plan: one palette, and every material, body and UI surface is drawn from it. Dusk over a
// dead salt refinery — warm concrete, oxidised steel, cold shadow, one signal amber.
export const PALETTE = {
  canvas: 0x1b1f26,
  sand: 0xc9bda2,
  concrete: 0x8d8579,
  stone: 0x6f6a60,
  rust: 0x8a4a2c,
  steel: 0x4a5560,
  gunmetal: 0x23282c,
  shadow: 0x2b333c,
  amber: 0xffb347,
  signal: 0xffb347,
  bone: 0xe8e2d4,
  blood: 0x7a2226,
  flinch: 0x8f2f24,
  fog: 0x9c7f66,
};

// CSS mirrors of the same colours, so the HUD cannot drift from the scene.
export const CSS = {
  canvas: '#1b1f26',
  sand: '#c9bda2',
  concrete: '#8d8579',
  stone: '#6f6a60',
  rust: '#8a4a2c',
  steel: '#4a5560',
  gunmetal: '#23282c',
  shadow: '#2b333c',
  amber: '#ffb347',
  bone: '#e8e2d4',
  blood: '#7a2226',
  fog: '#9c7f66',
};

// Team colours, read from the palette so nothing is invented off-palette.
export const TEAM = {
  tide: { name: 'TIDE', colour: 0xd8843f, dark: 0x8a5222, css: '#d8843f' },
  warden: { name: 'WARDEN', colour: 0x6f8fa8, dark: 0x3d5468, css: '#6f8fa8' },
};

PALETTE.tide = TEAM.tide.colour;
PALETTE.tideDark = TEAM.tide.dark;
PALETTE.warden = TEAM.warden.colour;
PALETTE.wardenDark = TEAM.warden.dark;
