(() => {
  'use strict';

  const accordion = document.getElementById('accordion');
  const sidebar   = document.getElementById('sidebar');
  const panels    = [...accordion.querySelectorAll('.acc-panel')];
  const navItems  = [...sidebar.querySelectorAll('.side-item')];
  const ids       = panels.map(p => p.dataset.panel);
  const canHover  = matchMedia('(hover:hover) and (pointer:fine)');

  const fromHash = () => { const h = location.hash.slice(1); return ids.includes(h) ? h : null; };
  let locked  = fromHash() || ids[0];
  let current = null;

  const setPanelBackground = panel => {
    if (!panel) return;
    const url = panel.dataset.bg;
    if (!url || panel.dataset.bgLoaded === url) return;
    panel.style.setProperty('--panel-bg', 'url("' + url.replace(/"/g, '%22') + '")');
    panel.dataset.bgLoaded = url;
  };

  /** Ενεργοποιεί ένα panel. lock=true: μένει ανοιχτό (click/πληκτρολόγιο). */
  function activate(id, { lock = false } = {}) {
    if (!ids.includes(id)) return;
    setPanelBackground(panels[ids.indexOf(id)]);
    if (lock) {
      locked = id;
      if (location.hash.slice(1) !== id) history.replaceState(null, '', '#' + id);
    }
    if (id === current) return;
    current = id;

    for (const p of panels) {
      const on = p.dataset.panel === id;
      p.classList.toggle('is-active', on);
      const tg = p.querySelector('.panel-toggle');
      tg.setAttribute('aria-expanded', on);
      tg.tabIndex = on ? -1 : 0;
      p.querySelector('.panel-content').inert = !on; // κρυφά CTA εκτός tab order
    }
    for (const b of navItems) {
      const on = b.dataset.open === id;
      b.classList.toggle('is-active', on);
      if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    }
  }

  const preview = id => { if (canHover.matches) { accordion.classList.add('is-previewing'); activate(id); } };
  const restore = () => { accordion.classList.remove('is-previewing'); activate(locked); };

  // Hover: ένα pointerleave στο container (όχι ανά panel) → χωρίς τρεμόπαιγμα ανάμεσα στα panels
  accordion.addEventListener('pointerover', e => {
    if (e.pointerType !== 'mouse') return;
    const p = e.target.closest('.acc-panel'); if (p) preview(p.dataset.panel);
  });
  accordion.addEventListener('pointerleave', restore);

  sidebar.addEventListener('pointerover', e => {
    if (e.pointerType !== 'mouse') return;
    const b = e.target.closest('.side-item'); if (b) preview(b.dataset.open);
  });
  sidebar.addEventListener('pointerleave', restore);

  // Click / Enter / Space
  accordion.addEventListener('click', e => {
    const t = e.target.closest('.panel-toggle');
    if (t) activate(t.closest('.acc-panel').dataset.panel, { lock: true });
  });
  sidebar.addEventListener('click', e => {
    const b = e.target.closest('.side-item');
    if (b) activate(b.dataset.open, { lock: true });
  });

  // Βελάκια / Home / End
  document.addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target.closest('input,textarea,select,[contenteditable]')) return;
    const i = ids.indexOf(locked), n = ids.length;
    const next = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: n - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const id = ids[(next + n) % n];
    activate(id, { lock: true });
    // κράτα το focus στο ίδιο σύστημα πλοήγησης που χρησιμοποιεί ο χρήστης
    const inNav = sidebar.contains(document.activeElement);
    (inNav ? navItems[ids.indexOf(id)] : panels[ids.indexOf(id)].querySelector('.panel-cta')).focus({ preventScroll: true });
  });

  window.addEventListener('hashchange', () => { const h = fromHash(); if (h) activate(h, { lock: true }); });

  // Πλοήγηση προς τον υπάρχοντα διαδραστικό χάρτη.
  accordion.addEventListener('click', e => {
    const b = e.target.closest('.panel-cta');
    if (b) window.location.assign('/map');
  });
  document.getElementById('mapCta').addEventListener('click', () => window.location.assign('/map'));

  activate(locked, { lock: true });
})();
