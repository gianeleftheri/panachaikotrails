import L from 'leaflet';
import type { TrailCollection } from '../types/trail';

const runtime = window as typeof window & { __panachaikoMap?: L.Map; __panachaikoTrails?: TrailCollection };
const shell = document.getElementById('mapExplorerPanel');
const trailPanel = document.getElementById('trailPanel');
const recreationPanel = document.getElementById('recreationPanel');
const drawer = document.getElementById('trailDrawer');

if (shell && trailPanel && recreationPanel && drawer) {
  const lists = document.getElementById('explorerLists')!;
  const trailDetails = document.getElementById('explorerTrailDetails')!;
  const recreationDetails = document.getElementById('explorerRecreationDetails')!;
  const content = document.getElementById('explorerContent')!;
  const title = document.getElementById('explorerTitle')!;
  const subtitle = document.getElementById('explorerSubtitle')!;
  const search = document.getElementById('explorerSearch') as HTMLInputElement;
  const filter = document.getElementById('explorerFilter') as HTMLSelectElement;
  const results = document.getElementById('explorerResults')!;
  const empty = document.getElementById('explorerEmpty')!;
  const reopen = document.getElementById('explorerReopen') as HTMLButtonElement;
  const floatButton = document.getElementById('explorerFloat') as HTMLButtonElement;
  const desktop = window.matchMedia('(min-width:761px)');
  const landscape = window.matchMedia('(max-height:500px) and (orientation:landscape) and (max-width:900px)');
  type Category = 'trails' | 'recreation';
  type SheetSize = 'peek' | 'half' | 'full';
  let category: Category = 'trails';
  let view: 'list' | 'detail' = 'list';
  let selectedCode: string | null = null;
  let selectedSpot: { lat: number; lng: number; title: string } | null = null;
  let trigger: HTMLElement | null = null;
  let resizeFrame = 0;
  const listState = { trails: { search: '', filter: 'all', scroll: 0 }, recreation: { search: '', filter: 'all', scroll: 0 } };

  lists.append(trailPanel, recreationPanel);
  trailDetails.append(drawer);

  const accordionLabels: Record<string, string> = { info: 'Περιγραφή και υψομετρικά', notes: 'Σημεία διαδρομής', photos: 'Φωτογραφίες', videos: 'Βίντεο' };
  drawer.querySelectorAll<HTMLElement>('.td-panel').forEach(panel => {
    const section = document.createElement('details');
    section.className = 'explorer-section';
    section.open = panel.dataset.panel === 'info';
    const heading = document.createElement('summary');
    heading.textContent = accordionLabels[panel.dataset.panel ?? 'info'];
    panel.before(section);
    section.append(heading, panel);
    panel.hidden = false;
  });

  const resizeMap = () => {
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(() => runtime.__panachaikoMap?.invalidateSize({ pan: false }));
  };
  new ResizeObserver(resizeMap).observe(document.getElementById('map')!);
  const isBottomSheet = () => !desktop.matches && !landscape.matches;
  const syncOpen = () => {
    document.body.classList.toggle('explorer-open', !shell.hidden);
    document.body.classList.toggle('explorer-floating', !shell.hidden && shell.classList.contains('is-floating'));
    ['trailMenuToggle', 'recreationMenuToggle'].forEach((id, index) => {
      const active = !shell.hidden && category === (index === 0 ? 'trails' : 'recreation');
      const button = document.getElementById(id);
      button?.classList.toggle('open', active);
      button?.setAttribute('aria-expanded', String(active));
    });
    reopen.setAttribute('aria-expanded', String(!shell.hidden));
    resizeMap();
  };
  const setSize = (size: SheetSize) => {
    shell.dataset.size = size;
    shell.querySelectorAll<HTMLButtonElement>('[data-explorer-size]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.explorerSize === size));
    });
  };
  const openShell = () => { shell.hidden = false; reopen.hidden = true; syncOpen(); };
  const listTitle = () => {
    title.textContent = category === 'trails' ? 'Μονοπάτια' : 'Χώροι αναψυχής';
    subtitle.textContent = 'Επιλέξτε ένα σημείο για πληροφορίες';
  };
  const updateCategories = () => {
    shell.dataset.category = category;
    shell.querySelectorAll<HTMLButtonElement>('[data-explorer-category]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.explorerCategory === category));
    });
  };
  const fold = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('el');
  const applyFilters = () => {
    const query = fold(search.value.trim());
    const rows = (category === 'trails' ? trailPanel : recreationPanel).querySelectorAll<HTMLElement>(category === 'trails' ? '.trail-row' : '.recreation-row');
    let visible = 0;
    rows.forEach(row => {
      const trail = runtime.__panachaikoTrails?.[row.id.replace(/^row-/, '')];
      const matchesFilter = filter.value === 'all' || (category === 'trails'
        ? (filter.value === 'existing' ? trail?.existing === true : trail?.existing === false)
        : row.dataset.spotType === filter.value);
      row.hidden = !(matchesFilter && fold(row.textContent ?? '').includes(query));
      if (!row.hidden) visible++;
    });
    results.textContent = `${visible} από ${rows.length} ${category === 'trails' ? 'μονοπάτια' : 'σημεία'}`;
    empty.hidden = visible !== 0 || view !== 'list';
  };
  const saveList = () => {
    if (view === 'list') listState[category] = { search: search.value, filter: filter.value, scroll: content.scrollTop };
  };
  const configureFilters = () => {
    search.placeholder = category === 'trails' ? 'Αναζήτηση μονοπατιού…' : 'Αναζήτηση σημείου ή περιοχής…';
    const options = category === 'trails'
      ? [['all', 'Όλα τα μονοπάτια'], ['existing', 'Υφιστάμενα'], ['planned', 'Σχεδιαζόμενα']]
      : [['all', 'Όλα τα σημεία'], ['recreation_viewpoint', 'Αναψυχή / θέα'], ['watchtower_site', 'Πυροφυλάκια / θέα'], ['other', 'Άλλα σημεία']];
    filter.replaceChildren(...options.map(([value, label]) => new Option(label, value)));
    search.value = listState[category].search;
    filter.value = listState[category].filter;
  };
  const showList = (next: Category) => {
    saveList(); category = next; view = 'list'; shell.dataset.view = view;
    updateCategories(); configureFilters(); listTitle(); openShell();
    if (isBottomSheet()) setSize('half');
    content.scrollTop = listState[category].scroll;
    applyFilters();
  };
  const showDetail = (next: Category) => {
    saveList(); category = next; view = 'detail'; shell.dataset.view = view;
    updateCategories(); openShell(); empty.hidden = true;
    trailDetails.hidden = next !== 'trails'; recreationDetails.hidden = next !== 'recreation';
    content.scrollTop = 0;
    if (isBottomSheet()) setSize('half');
  };
  const focusSelection = () => {
    const map = runtime.__panachaikoMap;
    if (!map) return;
    if (isBottomSheet() && shell.dataset.size === 'full' && !shell.hidden) return;
    map.stop(); map.invalidateSize({ pan: false });
    const mapRect = map.getContainer().getBoundingClientRect();
    const rect = shell.getBoundingClientRect();
    // Desktop docked panels reserve width in the map; bottom sheets reserve height through padding.
    const bottom = isBottomSheet() && !shell.hidden ? Math.max(16, mapRect.bottom - rect.top + 16) : 20;
    const right = shell.classList.contains('is-floating') && !shell.hidden ? Math.max(20, mapRect.right - rect.left + 16) : 20;
    if (category === 'trails' && selectedCode) {
      const trail = runtime.__panachaikoTrails?.[selectedCode];
      if (!trail) return;
      const points = trail.segments.flatMap(segment => segment.map(([lng, lat]) => L.latLng(lat, lng)));
      if (points.length) map.fitBounds(L.latLngBounds(points), { paddingTopLeft: L.point(20, 84), paddingBottomRight: L.point(right, bottom), maxZoom: 15, animate: false });
    } else if (selectedSpot) {
      const size = map.getSize();
      const target = L.point(Math.max(30, (size.x - right) / 2), Math.max(90, (size.y - bottom + 70) / 2));
      const zoom = 15;
      const center = map.unproject(map.project([selectedSpot.lat, selectedSpot.lng], zoom).add(L.point(size.x / 2, size.y / 2).subtract(target)), zoom);
      map.setView(center, zoom, { animate: false });
    }
  };
  const deferFocus = () => window.requestAnimationFrame(() => window.requestAnimationFrame(focusSelection));

  const onTrail = (event: Event) => {
    selectedCode = (event as CustomEvent<{ code: string }>).detail.code;
    showDetail('trails');
    drawer.querySelectorAll<HTMLElement>('.td-panel').forEach(panel => { panel.hidden = false; });
    title.textContent = drawer.querySelector('.trail-card-title')?.textContent ?? selectedCode;
    const trail = runtime.__panachaikoTrails?.[selectedCode];
    subtitle.textContent = trail ? `${trail.length_km.toFixed(2)} χλμ · ${trail.existing ? 'Υφιστάμενο' : 'Σχεδιαζόμενο'}${trail.difficulty ? ' · ' + trail.difficulty : ''}` : 'Πληροφορίες διαδρομής';
    deferFocus();
  };
  document.addEventListener('panachaiko:trail-selected', onTrail);
  document.addEventListener('panachaiko:recreation-selected', event => {
    const detail = (event as CustomEvent<{ spot: { lat: number; lng: number; title: string; settlement: string }; html: string }>).detail;
    event.preventDefault();
    selectedSpot = detail.spot;
    showDetail('recreation');
    title.textContent = detail.spot.title;
    subtitle.textContent = detail.spot.settlement || 'Χώρος αναψυχής / θέας';
    // HTML is generated by the existing escaped popup renderer, never raw CMS markup.
    recreationDetails.innerHTML = '<div class="explorer-recreation-card">' + detail.html + '</div>';
    deferFocus();
  });

  ['trailMenuToggle', 'recreationMenuToggle'].forEach((id, index) => {
    const button = document.getElementById(id);
    button?.addEventListener('click', () => {
      trigger = button;
      showList(index === 0 ? 'trails' : 'recreation');
    });
    // Let the existing handlers enable layers, but always open the category on a repeated click.
    button?.addEventListener('click', () => (index === 0 ? trailPanel : recreationPanel).classList.remove('open'), true);
  });
  shell.querySelectorAll<HTMLButtonElement>('[data-explorer-category]').forEach(button => {
    button.addEventListener('click', () => {
      const next = button.dataset.explorerCategory as Category;
      document.getElementById(next === 'trails' ? 'trailMenuToggle' : 'recreationMenuToggle')?.click();
    });
  });
  shell.querySelectorAll<HTMLButtonElement>('[data-explorer-size]').forEach(button => {
    button.addEventListener('click', () => { setSize(button.dataset.explorerSize as SheetSize); window.setTimeout(focusSelection, 220); });
  });
  search.addEventListener('input', () => { applyFilters(); listState[category].search = search.value; });
  filter.addEventListener('change', () => { applyFilters(); listState[category].filter = filter.value; });
  new MutationObserver(applyFilters).observe(lists, { childList: true, subtree: true });
  document.getElementById('explorerBack')?.addEventListener('click', () => { showList(category); search.focus({ preventScroll: true }); });
  document.getElementById('explorerShowMap')?.addEventListener('click', () => {
    if (isBottomSheet()) { setSize('peek'); window.setTimeout(focusSelection, 220); }
    else deferFocus();
  });
  const hideShell = (collapsed: boolean) => {
    saveList(); shell.hidden = true; reopen.hidden = !collapsed; syncOpen(); trigger?.focus({ preventScroll: true });
  };
  document.getElementById('explorerClose')?.addEventListener('click', () => hideShell(false));
  document.getElementById('explorerCollapse')?.addEventListener('click', () => {
    if (isBottomSheet()) setSize('peek'); else hideShell(true);
  });
  reopen.addEventListener('click', () => { openShell(); if (isBottomSheet()) setSize('half'); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !shell.hidden) hideShell(false); });
  ['routeBuilderToggle', 'shelterBtn'].forEach(id => document.getElementById(id)?.addEventListener('click', () => { if (!shell.hidden) hideShell(true); }));

  floatButton.addEventListener('click', () => {
    const detached = shell.classList.toggle('is-floating');
    floatButton.setAttribute('aria-pressed', String(detached));
    floatButton.title = detached ? 'Επαναφορά στη δεξιά πλευρά' : 'Αποδέσμευση για μετακίνηση';
    floatButton.setAttribute('aria-label', floatButton.title);
    syncOpen(); deferFocus();
  });
  const header = document.getElementById('explorerHeader')!;
  let drag: { pointer: number; x: number; y: number; left: number; top: number } | null = null;
  header.addEventListener('pointerdown', event => {
    if (!desktop.matches || !shell.classList.contains('is-floating') || event.button !== 0 || (event.target as Element).closest('button')) return;
    const rect = shell.getBoundingClientRect(); drag = { pointer: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
    header.setPointerCapture(event.pointerId); shell.classList.add('is-dragging'); event.preventDefault();
  });
  header.addEventListener('pointermove', event => {
    if (!drag || drag.pointer !== event.pointerId) return;
    const left = Math.max(8, Math.min(window.innerWidth - shell.offsetWidth - 8, drag.left + event.clientX - drag.x));
    const top = Math.max(78, Math.min(Math.max(78, window.innerHeight - shell.offsetHeight - 8), drag.top + event.clientY - drag.y));
    shell.style.setProperty('--explorer-left', left + 'px'); shell.style.setProperty('--explorer-top', top + 'px');
  });
  const finishDrag = () => { drag = null; shell.classList.remove('is-dragging'); };
  header.addEventListener('pointerup', finishDrag); header.addEventListener('pointercancel', finishDrag); header.addEventListener('lostpointercapture', finishDrag);
  const grip = document.getElementById('explorerGrip')!;
  let swipe: { pointer: number; y: number; height: number } | null = null;
  grip.addEventListener('pointerdown', event => {
    if (!isBottomSheet() || event.button !== 0) return;
    swipe = { pointer: event.pointerId, y: event.clientY, height: shell.getBoundingClientRect().height }; grip.setPointerCapture(event.pointerId); event.preventDefault();
  });
  grip.addEventListener('pointerup', event => {
    if (!swipe || swipe.pointer !== event.pointerId) return;
    const height = swipe.height + swipe.y - event.clientY; swipe = null;
    const fullHeight = window.innerHeight - 150, halfHeight = Math.min(window.innerHeight * .48, 460);
    const choices: Array<[SheetSize, number]> = [['peek', 160], ['half', halfHeight], ['full', fullHeight]];
    choices.sort((a, b) => Math.abs(a[1] - height) - Math.abs(b[1] - height)); setSize(choices[0][0]); window.setTimeout(focusSelection, 220);
  });
  grip.addEventListener('pointercancel', () => { swipe = null; });
  desktop.addEventListener('change', () => {
    shell.classList.remove('is-floating'); floatButton.setAttribute('aria-pressed', 'false'); finishDrag(); syncOpen();
    if (!shell.hidden) deferFocus();
  });
  window.addEventListener('resize', () => { if (!shell.hidden && view === 'detail') deferFocus(); });
  configureFilters(); applyFilters();
  if (drawer.querySelector('.td-titleblock.selected')) {
    const code = document.querySelector<HTMLElement>('.trail-row.active')?.id.replace(/^row-/, '');
    if (code) onTrail(new CustomEvent('panachaiko:trail-selected', { detail: { code } }));
  }
}
