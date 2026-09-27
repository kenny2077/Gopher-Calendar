// A short first-run tour: a highlight around one element at a time and a
// card beside it. Steps whose target is missing are skipped.
//   startTour([{ target: () => el, title, body, before?: () => void }], { onEnd })

export function startTour(steps, { onEnd } = {}) {
  const live = steps.filter(s => s.target());
  if (!live.length) { onEnd?.(); return; }

  const spot = document.createElement('div');
  spot.className = 'tour-spot';
  const card = document.createElement('div');
  card.className = 'tour-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'false');
  card.setAttribute('aria-labelledby', 'tourTitle');
  document.body.append(spot, card);

  let i = 0;
  const lastFocus = document.activeElement;

  function place() {
    const el = live[i].target();
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pad = 6;
    Object.assign(spot.style, {
      top: `${r.top - pad}px`, left: `${r.left - pad}px`,
      width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px`,
    });
    // Card below the target when there is room, otherwise above; kept on screen.
    const cw = card.offsetWidth, ch = card.offsetHeight, gap = 14;
    let top = r.bottom + gap;
    if (top + ch > innerHeight - 12) top = Math.max(12, r.top - ch - gap);
    let left = Math.min(Math.max(12, r.left + r.width / 2 - cw / 2), innerWidth - cw - 12);
    card.style.top = `${top}px`;
    card.style.left = `${left}px`;
  }

  function show() {
    const step = live[i];
    step.before?.();
    const el = step.target();
    el?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    card.innerHTML = `
      <p class="tour-count">${i + 1} of ${live.length}</p>
      <h2 id="tourTitle">${step.title}</h2>
      <p>${step.body}</p>
      <div class="tour-actions">
        <button class="btn quiet small" type="button" data-tour="skip">${i === live.length - 1 ? 'Close' : 'Skip tour'}</button>
        <span class="inline">
          ${i > 0 ? '<button class="btn small" type="button" data-tour="back">Back</button>' : ''}
          <button class="btn primary small" type="button" data-tour="next">${i === live.length - 1 ? 'Done' : 'Next'}</button>
        </span>
      </div>`;
    place();
    card.querySelector('[data-tour=next]').focus();
  }

  function end() {
    removeEventListener('resize', place);
    removeEventListener('scroll', place, true);
    document.removeEventListener('keydown', onKey, true);
    spot.remove();
    card.remove();
    lastFocus?.focus?.();
    onEnd?.();
  }

  function onKey(ev) {
    if (ev.key === 'Escape') { ev.stopPropagation(); end(); }
    if (ev.key === 'ArrowRight' && document.activeElement?.closest('.tour-card')) go(1);
    if (ev.key === 'ArrowLeft' && document.activeElement?.closest('.tour-card')) go(-1);
  }

  function go(d) {
    const next = i + d;
    if (next >= live.length) return end();
    if (next < 0) return;
    i = next;
    show();
  }

  card.addEventListener('click', ev => {
    const act = ev.target.closest('[data-tour]')?.dataset.tour;
    if (act === 'next') go(1);
    if (act === 'back') go(-1);
    if (act === 'skip') end();
  });
  addEventListener('resize', place);
  addEventListener('scroll', place, true);
  document.addEventListener('keydown', onKey, true);
  show();
}
