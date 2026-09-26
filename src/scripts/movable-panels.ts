const desktopQuery = window.matchMedia('(min-width: 761px)');

const panelIds = ['trailPanel', 'recreationPanel'];

const clearDraggedPosition = (panel: HTMLElement) => {
  panel.classList.remove('panel-dragging');
  panel.style.removeProperty('left');
  panel.style.removeProperty('top');
  panel.style.removeProperty('right');
  panel.style.removeProperty('bottom');
  panel.style.removeProperty('transform');
};

const enablePanelDrag = (panel: HTMLElement) => {
  const handle = panel.querySelector<HTMLElement>('.left-panel-head');
  if (!handle) return;

  let wasOpen = panel.classList.contains('open');
  let pointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;
  let panelWidth = 0;
  let panelHeight = 0;
  let parentRect = new DOMRect();

  const finishDrag = () => {
    if (pointerId !== null && handle.hasPointerCapture(pointerId)) {
      handle.releasePointerCapture(pointerId);
    }
    pointerId = null;
    panel.classList.remove('panel-dragging');
  };

  handle.addEventListener('pointerdown', event => {
    if (!desktopQuery.matches || event.button !== 0) return;
    if ((event.target as HTMLElement).closest('button, a, input, select, textarea, [role="button"]')) return;

    const rect = panel.getBoundingClientRect();
    const parent = panel.offsetParent as HTMLElement | null;
    parentRect = parent?.getBoundingClientRect() ?? new DOMRect(0, 0, window.innerWidth, window.innerHeight);

    startX = event.clientX;
    startY = event.clientY;
    startLeft = rect.left;
    startTop = rect.top;
    panelWidth = rect.width;
    panelHeight = rect.height;
    pointerId = event.pointerId;

    panel.style.left = `${rect.left - parentRect.left}px`;
    panel.style.top = `${rect.top - parentRect.top}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    panel.style.transform = 'none';
    panel.classList.add('panel-dragging');

    handle.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  handle.addEventListener('pointermove', event => {
    if (pointerId !== event.pointerId || !desktopQuery.matches) return;

    const margin = 8;
    const minLeft = margin;
    const minTop = margin;
    const maxLeft = Math.max(minLeft, window.innerWidth - panelWidth - margin);
    const maxTop = Math.max(minTop, window.innerHeight - panelHeight - margin);

    const viewportLeft = Math.min(maxLeft, Math.max(minLeft, startLeft + event.clientX - startX));
    const viewportTop = Math.min(maxTop, Math.max(minTop, startTop + event.clientY - startY));

    panel.style.left = `${viewportLeft - parentRect.left}px`;
    panel.style.top = `${viewportTop - parentRect.top}px`;
    event.preventDefault();
  });

  handle.addEventListener('pointerup', finishDrag);
  handle.addEventListener('pointercancel', finishDrag);

  const observer = new MutationObserver(() => {
    const isOpen = panel.classList.contains('open');
    if (isOpen && !wasOpen) clearDraggedPosition(panel);
    wasOpen = isOpen;
  });
  observer.observe(panel, { attributes: true, attributeFilter: ['class'] });

  desktopQuery.addEventListener('change', event => {
    finishDrag();
    if (!event.matches) clearDraggedPosition(panel);
  });
};

panelIds.forEach(id => {
  const panel = document.getElementById(id);
  if (panel) enablePanelDrag(panel);
});
