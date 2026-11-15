// The buy menu. Five things worth owning, priced like a real economy, and only open while the freeze
// clock or the buy window is running. Affordability is shown, not enforced silently: you press the
// key, the simulation decides.
import { WEAPONS, UTILITY } from '../sim/weapons.js';

const ENTRIES = [
  { key: '1', id: 'marlow', name: WEAPONS.marlow.name, price: WEAPONS.marlow.price, tag: 'RIFLE · 30 RDS' },
  { key: '2', id: 'vesper', name: WEAPONS.vesper.name, price: WEAPONS.vesper.price, tag: 'SMG · 25 RDS' },
  { key: '3', id: 'kevlar', name: UTILITY.kevlar.name, price: UTILITY.kevlar.price, tag: 'ARMOUR · 100' },
  { key: '4', id: 'he', name: UTILITY.he.name, price: UTILITY.he.price, tag: 'THROWN · RADIUS 4.6M' },
];

export function createBuyMenu(root, { onBuy, getPlayer }) {
  const panel = root.querySelector('#buy-menu');
  const list = root.querySelector('#buy-list');
  const cash = root.querySelector('#buy-cash');
  let open = false;

  const rows = new Map();
  for (const entry of ENTRIES) {
    const row = document.createElement('button');
    row.className = 'buy-row';
    row.type = 'button';
    row.innerHTML = `<span class="buy-key">${entry.key}</span>
      <span class="buy-name">${entry.name}</span>
      <span class="buy-tag">${entry.tag}</span>
      <span class="buy-price">$${entry.price}</span>`;
    row.addEventListener('click', () => {
      onBuy(entry.id);
      refresh();
    });
    list.appendChild(row);
    rows.set(entry.key, { entry, row });
  }

  function refresh() {
    const player = getPlayer();
    if (!player) return;
    cash.textContent = `$${player.money}`;
    for (const { entry, row } of rows.values()) {
      const affordable = player.money >= entry.price;
      const owned = entry.id === 'kevlar' ? player.armor >= 100 : entry.id === 'he' ? player.grenades > 0 : false;
      row.classList.toggle('unaffordable', !affordable);
      row.classList.toggle('owned', owned);
      row.disabled = !affordable || owned;
    }
  }

  function show(value) {
    open = value;
    panel.classList.toggle('open', open);
    if (open) refresh();
  }

  function press(key) {
    const hit = rows.get(key);
    if (!hit) return false;
    if (hit.row.disabled) return true;
    onBuy(hit.entry.id);
    refresh();
    return true;
  }

  return {
    refresh,
    press,
    show,
    get isOpen() {
      return open;
    },
  };
}
