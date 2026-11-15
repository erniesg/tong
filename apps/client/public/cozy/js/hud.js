// Small HUD manners: the Today list shows one step until opened, and the
// controls help leaves once the player is moving.
const MOVE_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);

export function initHud(doc = document) {
  const list = doc.getElementById('quest-list');
  const now = doc.getElementById('quest-now');
  if (list && now) {
    const sync = () => {
      const items = [...list.children];
      const next = items.find((li) => !li.matches('.step-done, .hangul-count')) ?? items[0];
      const text = next?.textContent ?? '';
      if (now.textContent !== text) now.textContent = text;
    };
    new MutationObserver(sync).observe(list, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'] });
    sync();
  }

  const help = doc.getElementById('controls-help');
  const hud = doc.getElementById('hud');
  if (help) {
    let timer = 0;
    const moved = () => {
      if (timer || hud?.classList.contains('hidden') || doc.body.classList.contains('talking')) return;
      timer = setTimeout(() => help.classList.add('seen'), 4000);
    };
    doc.defaultView.addEventListener('keydown', (e) => MOVE_KEYS.has(e.key?.toLowerCase()) && moved());
    doc.getElementById('stick')?.addEventListener('pointerdown', moved);
  }
}
