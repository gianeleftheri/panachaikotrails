(() => {
  'use strict';

  const accordion = document.getElementById('accordion');
  const sidebar   = document.getElementById('sidebar');
  const panels    = [...accordion.querySelectorAll('.acc-panel')];
  const navItems  = [...sidebar.querySelectorAll('.side-item')];
  const ids       = panels.map(p => p.dataset.panel);

  // Η Αρχική είναι πάντα το default panel σε νέο load / refresh.
  // Δεν κρατάμε το προηγούμενο panel στο URL, ώστε η σελίδα να ανοίγει σταθερά από την πρώτη καρτέλα.
  let locked  = ids[0];
  let current = null;

  const setPanelBackground = panel => {
    if (!panel) return;
    const url = panel.dataset.bg;
    if (!url || panel.dataset.bgLoaded === url) return;
    panel.style.setProperty('--panel-bg', 'url("' + url.replace(/"/g, '%22') + '")');
    panel.dataset.bgLoaded = url;
  };

  const setPanelPreview = panel => {
    if (!panel || panel.classList.contains('is-active')) return;
    const url = panel.dataset.bgPreview;
    if (!url || panel.dataset.bgLoaded === url) return;
    panel.style.setProperty('--panel-bg', 'url("' + url.replace(/"/g, '%22') + '")');
    panel.dataset.bgLoaded = url;
  };

  // Μετά το πρώτο paint φορτώνουμε μόνο μικρές previews για τα κλειστά panels.
  // Έτσι οι φωτογραφίες φαίνονται χωρίς να επιβαρύνουν το LCP της αρχικής.
  const warmPanelPreviews = () => {
    panels.forEach((panel, index) => {
      if (panel.dataset.panel === 'home') return;
      setTimeout(() => setPanelPreview(panel), index * 140);
    });
  };

  /** Ενεργοποιεί ένα panel. lock=true: μένει ανοιχτό (click/πληκτρολόγιο). */
  function activate(id, { lock = false } = {}) {
    if (!ids.includes(id)) return;
    setPanelBackground(panels[ids.indexOf(id)]);
    if (lock) {
      locked = id;
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
    window.dispatchEvent(new CustomEvent('panachaiko:panel', { detail: { id } }));
  }

  // Άνοιγμα αποκλειστικά με click / Enter / Space.
  // Κάθε νέο click ανοίγει το επιλεγμένο panel και κλείνει αυτόματα το προηγούμενο.
  // Το mouse-over δεν αλλάζει ποτέ το ενεργό panel.
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

  // Πλοήγηση προς τον υπάρχοντα διαδραστικό χάρτη.
  accordion.addEventListener('click', e => {
    const b = e.target.closest('.panel-cta');
    if (b) window.location.assign('/map');
  });
  document.getElementById('mapCta').addEventListener('click', () => window.location.assign('/map'));

  activate(locked, { lock: true });

  const schedulePreviews = () => {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(warmPanelPreviews, { timeout: 1800 });
    } else {
      setTimeout(warmPanelPreviews, 700);
    }
  };
  if (document.readyState === 'complete') {
    schedulePreviews();
  } else {
    window.addEventListener('load', schedulePreviews, { once: true });
  }
})();
