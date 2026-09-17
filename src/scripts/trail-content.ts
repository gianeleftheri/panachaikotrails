import L from 'leaflet';
import type { Trail } from '../types/trail';

const SUBMISSION_URL = import.meta.env.PUBLIC_TRAILS_SUBMISSION_URL || 'https://cms.panachaikotrails.gr/?rest_route=/panachaiko/v1/submissions';

type ContentType = 'photo' | 'video' | 'note';
type ContentState = {
  type: ContentType | null;
  latlng: L.LatLng | null;
  code: string | null;
  file: File | null;
  objectUrl: string | null;
  category: string;
};

const CATEGORIES: Record<string, { label: string; icon: string; color: string }> = {
  general: { label: 'Γενικό', icon: '📍', color: '#9c917c' },
  forest: { label: 'Δάσος', icon: '🌲', color: '#4d8c52' },
  viewpoint: { label: 'Θέα', icon: '👁️', color: '#3b82f6' },
  rest: { label: 'Ξεκούραση', icon: '🪑', color: '#c08a45' },
  danger: { label: 'Προσοχή', icon: '⚠️', color: '#dc2626' },
  water: { label: 'Νερό', icon: '💧', color: '#06b6d4' },
  flag: { label: 'Αφετηρία/Τέλος', icon: '🚩', color: '#cf5a34' },
  shelter: { label: 'Καταφύγιο', icon: '⛺', color: '#a855f7' },
  archaeological: { label: 'Αρχαιολογικός χώρος', icon: '🏛️', color: '#b08d3e' }
};

const escapeHtml = (value: unknown) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const categoryPickerHtml = (selected = 'general') => `
  <div class="cat-picker" id="cpCatPicker">
    ${Object.entries(CATEGORIES).map(([key, item]) => `
      <button type="button" class="cat-btn${key === selected ? ' active' : ''}" data-cat="${key}" title="${escapeHtml(item.label)}" style="--cat-color:${item.color}">
        <span aria-hidden="true">${item.icon}</span><span class="sr-only">${escapeHtml(item.label)}</span>
      </button>`).join('')}
  </div>`;

export const createTrailContentController = (map: L.Map, getTrail: (code: string) => Trail | undefined) => {
  const overlay = document.getElementById('contentPanelOverlay');
  const panel = document.getElementById('contentPanel');
  let state: ContentState = { type: null, latlng: null, code: null, file: null, objectUrl: null, category: 'general' };

  const closePanel = () => {
    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
    state = { type: null, latlng: null, code: null, file: null, objectUrl: null, category: 'general' };
    overlay?.classList.remove('open');
    if (panel) panel.innerHTML = '';
  };

  const openPanel = (type: ContentType, latlng: L.LatLng, code: string) => {
    const trail = getTrail(code);
    if (!trail || !overlay || !panel) return;

    state = { type, latlng, code, file: null, objectUrl: null, category: 'general' };
    const coords = `📍 ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
    const trailLine = `${code} · ${trail.name}`;
    const placeholder = type === 'photo'
      ? 'π.χ. Δάσος - Θέα προς την κορυφή'
      : type === 'video'
        ? 'π.χ. Η κατάβαση προς το φαράγγι'
        : 'π.χ. Απότομο σημείο';

    const common = `
      <div class="cp-trail-tag">${escapeHtml(trailLine)}</div>
      <div class="cp-coords">${escapeHtml(coords)}</div>
      <label class="cp-label">Κατηγορία σημείου</label>
      ${categoryPickerHtml()}
      <label class="cp-label" for="cpHeadline">Τίτλος (προαιρετικό)</label>
      <input type="text" id="cpHeadline" class="cp-input" maxlength="120" placeholder="${escapeHtml(placeholder)}">`;

    let fields = '';
    if (type === 'photo') {
      fields = `
        <div class="cp-title">Προσθήκη φωτογραφίας</div>
        ${common}
        <label class="cp-label" for="cpFile">Αρχείο εικόνας</label>
        <input type="file" id="cpFile" accept="image/jpeg,image/png,image/webp,image/gif" class="cp-file">
        <img id="cpPreview" class="cp-preview" alt="Προεπισκόπηση φωτογραφίας">
        <label class="cp-label" for="cpCaption">Λεζάντα / περιγραφή (προαιρετικό)</label>
        <input type="text" id="cpCaption" class="cp-input" maxlength="500" placeholder="π.χ. Θέα προς το καταφύγιο">`;
    } else if (type === 'video') {
      fields = `
        <div class="cp-title">Προσθήκη βίντεο</div>
        ${common}
        <label class="cp-label" for="cpFile">Αρχείο βίντεο</label>
        <input type="file" id="cpFile" accept="video/mp4,video/webm,video/quicktime" class="cp-file">
        <div class="cp-or">— ή —</div>
        <label class="cp-label" for="cpVideoUrl">Σύνδεσμος YouTube / Vimeo</label>
        <input type="url" id="cpVideoUrl" class="cp-input" maxlength="500" placeholder="https://youtube.com/watch?v=...">
        <label class="cp-label" for="cpCaption">Λεζάντα / περιγραφή (προαιρετικό)</label>
        <input type="text" id="cpCaption" class="cp-input" maxlength="500" placeholder="π.χ. Η κατάβαση προς το φαράγγι">`;
    } else {
      fields = `
        <div class="cp-title">Προσθήκη περιγραφής</div>
        ${common}
        <label class="cp-label" for="cpText">Κείμενο</label>
        <textarea id="cpText" class="cp-textarea" maxlength="3000" placeholder="π.χ. Εδώ το μονοπάτι γίνεται απότομο — προσοχή σε βρεγμένες πέτρες."></textarea>`;
    }

    panel.innerHTML = `
      <button class="cp-close" id="cpClose" type="button" aria-label="Κλείσιμο">✕</button>
      ${fields}
      <input type="text" id="cpWebsite" class="cp-honeypot" tabindex="-1" autocomplete="off" aria-hidden="true">
      <p class="cp-moderation-note">Η υποβολή αποθηκεύεται στο WordPress και εμφανίζεται στον χάρτη αφού εγκριθεί.</p>
      <button class="cp-btn" id="cpAddBtn" type="button" disabled>Υποβολή για έλεγχο</button>
      <div class="cp-status" id="cpStatus" aria-live="polite"></div>`;
    overlay.classList.add('open');

    document.getElementById('cpClose')?.addEventListener('click', closePanel);

    panel.querySelectorAll<HTMLButtonElement>('.cat-btn').forEach(button => {
      button.addEventListener('click', () => {
        panel.querySelectorAll('.cat-btn').forEach(item => item.classList.remove('active'));
        button.classList.add('active');
        state.category = button.dataset.cat || 'general';
      });
    });

    const addButton = document.getElementById('cpAddBtn') as HTMLButtonElement | null;
    const fileInput = document.getElementById('cpFile') as HTMLInputElement | null;
    const textInput = document.getElementById('cpText') as HTMLTextAreaElement | null;
    const videoUrl = document.getElementById('cpVideoUrl') as HTMLInputElement | null;

    const refreshEnabled = () => {
      if (!addButton) return;
      if (type === 'note') addButton.disabled = !textInput?.value.trim();
      else if (type === 'photo') addButton.disabled = !state.file;
      else addButton.disabled = !(state.file || videoUrl?.value.trim());
    };

    textInput?.addEventListener('input', refreshEnabled);
    videoUrl?.addEventListener('input', refreshEnabled);
    fileInput?.addEventListener('change', () => {
      state.file = fileInput.files?.[0] ?? null;
      if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
      state.objectUrl = state.file ? URL.createObjectURL(state.file) : null;
      const preview = document.getElementById('cpPreview') as HTMLImageElement | null;
      if (preview && state.objectUrl) {
        preview.src = state.objectUrl;
        preview.style.display = 'block';
      }
      refreshEnabled();
    });

    addButton?.addEventListener('click', async () => {
      if (!state.type || !state.latlng || !state.code || !addButton) return;
      const status = document.getElementById('cpStatus');
      const title = (document.getElementById('cpHeadline') as HTMLInputElement | null)?.value.trim() ?? '';
      const caption = (document.getElementById('cpCaption') as HTMLInputElement | null)?.value.trim() ?? '';
      const text = textInput?.value.trim() ?? caption;
      const externalVideo = videoUrl?.value.trim() ?? '';
      const website = (document.getElementById('cpWebsite') as HTMLInputElement | null)?.value ?? '';

      const form = new FormData();
      form.set('trail_code', state.code);
      form.set('content_type', state.type);
      form.set('category', state.category);
      form.set('title', title);
      form.set('text', text);
      form.set('lat', String(state.latlng.lat));
      form.set('lng', String(state.latlng.lng));
      form.set('video_url', externalVideo);
      form.set('website', website);
      if (state.file) form.set('file', state.file, state.file.name);

      addButton.disabled = true;
      addButton.textContent = 'Υποβολή…';
      if (status) {
        status.textContent = 'Αποστολή στο CMS…';
        status.className = 'cp-status';
      }

      try {
        const response = await fetch(SUBMISSION_URL, { method: 'POST', body: form, credentials: 'omit' });
        const payload = await response.json().catch(() => null) as { message?: string } | null;
        if (!response.ok) throw new Error(payload?.message || `HTTP ${response.status}`);
        if (status) {
          status.textContent = 'Υποβλήθηκε για έλεγχο ✅';
          status.className = 'cp-status ok';
        }
        addButton.textContent = 'Υποβλήθηκε';
        window.setTimeout(closePanel, 1300);
      } catch (error) {
        if (status) {
          status.textContent = error instanceof Error ? `Δεν ολοκληρώθηκε η υποβολή: ${error.message}` : 'Δεν ολοκληρώθηκε η υποβολή.';
          status.className = 'cp-status error';
        }
        addButton.disabled = false;
        addButton.textContent = 'Δοκιμή ξανά';
      }
    });
  };

  const showChoice = (latlng: L.LatLng, code: string) => {
    const trail = getTrail(code);
    if (!trail) return;
    const el = document.createElement('div');
    el.className = 'add-choice-bubble';
    el.innerHTML = `
      <button type="button" data-type="photo"><span class="ico">📷</span><span>Φωτογραφία</span></button>
      <button type="button" data-type="video"><span class="ico">🎥</span><span>Βίντεο</span></button>
      <button type="button" data-type="note"><span class="ico">📝</span><span>Περιγραφή</span></button>`;

    el.querySelectorAll<HTMLButtonElement>('button').forEach(button => {
      button.addEventListener('click', () => {
        map.closePopup();
        openPanel(button.dataset.type as ContentType, latlng, code);
      });
    });

    const drawer = document.getElementById('trailDrawer');
    const drawerOpen = drawer?.classList.contains('open');
    const rightReserve = drawerOpen && drawer ? Math.ceil(drawer.getBoundingClientRect().width) + 20 : 20;
    L.popup({
      closeButton: false,
      className: 'add-choice-popup',
      offset: [0, -8],
      autoPan: true,
      autoPanPaddingTopLeft: [10, 70],
      autoPanPaddingBottomRight: [rightReserve, 40]
    }).setLatLng(latlng).setContent(el).openOn(map);
  };

  overlay?.addEventListener('click', event => {
    if (event.target === overlay) closePanel();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && overlay?.classList.contains('open')) closePanel();
  });

  return { showChoice, closePanel };
};
