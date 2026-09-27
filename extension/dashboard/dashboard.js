import { buildModel, deadlinesIn, loadLevel, scheduleWeek, dayNames, currentWeekIndex } from '../lib/model.js';
import { SYMBOLS, KIND_LABELS } from '../lib/classify.js';
import { buildIcs } from '../lib/ics.js';
import { polishCourse, readSyllabusFile, readPdf, blobToDataUrl, hashInput, aiConfig, aiReady, PROVIDERS, providerOrigins } from '../lib/polish.js';
import { aiTriage, ruleTriage, listCandidates, pendingPicks, approvedFor, fingerprint } from '../lib/sources.js';
import { extractRules, EXTRACT_VERSION } from '../lib/extract.js';
import { sampleData } from '../lib/sample-data.js';
import { startTour } from './tour.js';
import { fetchClosures } from '../lib/closures.js';
import {
  addDays, fmtShort, fmtLong, fmtMonth, fmtDow, fmtRange, hhmmLabel, relativeAgo, todayKey, mondayOf, keyToDate,
} from '../lib/time.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SUIT_ORDER = ['exam', 'quiz', 'project', 'milestone', 'assignment', 'participation'];

// The public demo (GitHub Pages) runs this same page with a sample semester.
// Everything can be browsed, but actions that would sync, save or download
// only explain themselves.
const IS_DEMO = !!globalThis.__GOPHER_DEMO__;
function demoOnly(action) {
  if (!IS_DEMO) return false;
  ui.notice = { html: `This is a demo, so ${esc(action)} doesn’t run here. <a href="https://github.com/kenny2077/Gopher-Calendar#quick-install">Install the extension</a> to use it with your own Canvas and MyU. <button class="btn quiet small" type="button" data-act="dismiss">Dismiss</button>` };
  renderHeader();
  scrollTo({ top: 0, behavior: 'smooth' });
  return true;
}

let store = {};
let model = null;
const savedView = (() => { try { return localStorage.getItem('calendar-view'); } catch { return null; } })();
const ui = {
  view: savedView === 'classes' ? 'classes' : 'workload', showSources: false, layer: 'semester', weekIndex: 0, focusCourse: null, schedIndex: null, notice: null,
};

/* ---------- storage ---------- */

async function load() {
  store = await chrome.storage.local.get(null);
  model = store.canvas || store.myu ? buildModel(store) : null;
  render();
}

let reloadTimer;
chrome.storage.onChanged.addListener(() => {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(load, 60);
});

// Polish results for several courses land concurrently; queue the writes.
let polishWrites = Promise.resolve();
function setPolish(course, entry) {
  polishWrites = polishWrites.then(async () => {
    const { polish = {} } = await chrome.storage.local.get('polish');
    polish[course] = { ...polish[course], ...entry };
    await chrome.storage.local.set({ polish });
  });
  return polishWrites;
}

/* ---------- tooltip ---------- */

const tooltip = $('tooltip');
function showTip(html, x, y) {
  tooltip.innerHTML = html;
  tooltip.classList.add('show');
  const r = tooltip.getBoundingClientRect();
  let left = x + 14, top = y + 14;
  if (left + r.width > innerWidth - 10) left = x - r.width - 14;
  if (top + r.height > innerHeight - 10) top = y - r.height - 14;
  tooltip.style.left = `${Math.max(8, left)}px`;
  tooltip.style.top = `${Math.max(8, top)}px`;
}
const hideTip = () => tooltip.classList.remove('show');
function bindTip(el, html) {
  const move = ev => showTip(html(), ev.clientX, ev.clientY);
  el.addEventListener('mouseenter', move);
  el.addEventListener('mousemove', move);
  el.addEventListener('mouseleave', hideTip);
  el.addEventListener('focus', () => { const r = el.getBoundingClientRect(); showTip(html(), r.left + r.width / 2, r.bottom); });
  el.addEventListener('blur', hideTip);
}

/* ---------- header ---------- */

function renderHeader() {
  const title = model ? model.termName : 'Semester calendar';
  $('termTitle').textContent = title;
  document.title = IS_DEMO ? 'Gopher Calendar · live demo' : model ? `${title} · calendar` : 'Semester calendar';

  const s = store.syncState || {};
  const line = ['canvas', 'myu'].map(k => {
    const src = s[k] || {};
    const label = k === 'canvas' ? 'Canvas' : 'MyU';
    const at = store[k]?.fetchedAt;
    if (src.status === 'running') return `<span class="src run"><b>${label}</b> ${esc(src.message || 'syncing')}…</span>`;
    if (src.status === 'error') return `<span class="src err"><b>${label}</b> ${esc(src.message)}</span>`;
    if (store.sample) return `<span class="src"><b>${label}</b> sample</span>`;
    return `<span class="src"><b>${label}</b> ${at ? `synced ${relativeAgo(at)}` : 'not synced yet'}</span>`;
  });
  $('syncLine').innerHTML = line.join('');

  const running = !!s.running;
  for (const id of ['syncBtn', 'emptySync']) {
    $(id).disabled = running;
    $(id).setAttribute('aria-busy', String(running));
    $(id).innerHTML = running ? 'Syncing…' : 'Sync<span class="long"> Canvas and MyU</span>';
  }
  $('exportBtn').disabled = !model;

  const notice = $('notice');
  if (ui.notice) {
    notice.hidden = false;
    notice.className = `notice${ui.notice.err ? ' err' : ''}`;
    notice.innerHTML = ui.notice.html;
  } else if (store.sample) {
    notice.hidden = false;
    notice.className = 'notice';
    notice.textContent = IS_DEMO
      ? 'Live demo with a sample semester. Browse both views, open any week, and try the tour in Settings. Buttons that sync, save or download are for show.'
      : 'This is a sample semester. Sync to replace it with your own classes and deadlines.';
  } else notice.hidden = true;
}

/* ---------- workload: semester matrix ---------- */

function renderMatrix() {
  const matrix = $('matrix');
  const weeks = model.weeks;
  const today = todayKey();
  const thisMonday = mondayOf(today);
  matrix.style.gridTemplateColumns = `136px repeat(${weeks.length}, minmax(52px, 1fr))`;
  matrix.style.minWidth = `${136 + weeks.length * 60}px`;
  const frag = document.createDocumentFragment();
  const div = (cls, text) => { const d = document.createElement('div'); d.className = cls; if (text != null) d.textContent = text; return d; };

  frag.append(div('corner'));
  const spans = [];
  weeks.forEach((w, i) => {
    const m = fmtMonth(w);
    if (spans.at(-1)?.m === m) spans.at(-1).count++;
    else spans.push({ m, start: i, count: 1 });
  });
  for (const s of spans) {
    const el = div('month-label', s.m);
    el.style.gridColumn = `${s.start + 2} / span ${s.count}`;
    frag.append(el);
  }
  frag.append(div('corner'));
  for (const w of weeks) {
    const el = div(`week-label${w === thisMonday ? ' current' : ''}`);
    el.innerHTML = `<span>${fmtShort(w)}<br>week</span>`;
    frag.append(el);
  }

  for (const course of model.courses) {
    const label = div('course-label');
    label.innerHTML = `<i class="dot c${course.color}"></i>${esc(course.code)}`;
    label.title = course.name;
    frag.append(label);
    weeks.forEach((w, wi) => {
      const list = deadlinesIn(model, course.code, w);
      const guess = list.some(d => d.source === 'syllabus' && !d.confirmed);
      const cell = div(`cell load${loadLevel(list)}${w === thisMonday ? ' current' : ''}${guess ? ' guess' : ''}`);
      cell.tabIndex = 0;
      cell.setAttribute('role', 'button');
      cell.setAttribute('aria-label', `${course.code}, week of ${fmtLong(w)}, ${list.length} due`);
      cell.innerHTML = `<span class="marks" aria-hidden="true">${SUIT_ORDER.filter(k => list.some(d => d.kind === k)).map(k => SYMBOLS[k]).join('')}</span>`;
      bindTip(cell, () => cellTip(course, w, list));
      cell.addEventListener('click', () => openWeek(wi, course.code));
      cell.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openWeek(wi, course.code); } });
      frag.append(cell);
    });
  }
  matrix.replaceChildren(frag);

  const und = model.undated;
  $('undated').hidden = !und.length;
  if (und.length) {
    const courses = [...new Set(und.map(u => u.course))];
    $('undatedSummary').textContent = `${und.length} Canvas item${und.length > 1 ? 's have' : ' has'} no due date yet (${courses.join(', ')})`;
    $('undatedList').innerHTML = und.map(u => `<li><b>${esc(u.course)}</b>${esc(u.title)}${u.points != null ? ` · ${u.points} pts` : ''}</li>`).join('');
  }
}

function cellTip(course, monday, list) {
  let html = `<div class="tip-title">${esc(course.code)} · ${fmtRange(monday, addDays(monday, 6))}</div>`;
  if (!list.length) return `${html}<div class="tip-line">Nothing due.</div>`;
  html += list.map(d => `<div class="tip-line"><span class="sym">${SYMBOLS[d.kind]}</span> <b>${fmtShort(d.date)}</b> · ${esc(d.title)}${d.time ? ` · ${esc(d.time)}` : ''}${d.source === 'syllabus' && !d.confirmed ? ' (syllabus)' : ''}</div>`).join('');
  if (list.some(d => d.source === 'syllabus' && !d.confirmed)) html += '<div class="tip-meta">Dates marked (syllabus) were read by AI and are not on Canvas yet.</div>';
  return html;
}

/* ---------- workload: weekly view ---------- */

function openWeek(index, course) {
  ui.layer = 'week';
  ui.weekIndex = Math.max(0, Math.min(model.weeks.length - 1, index));
  ui.focusCourse = course;
  hideTip();
  render();
  scrollTo({ top: 0, behavior: 'smooth' });
}

function renderWeek() {
  const monday = model.weeks[ui.weekIndex];
  const today = todayKey();
  $('weekTitle').textContent = fmtRange(monday, addDays(monday, 6)) + `, ${monday.slice(0, 4)}`;
  $('focusNote').textContent = ui.focusCourse ? `${ui.focusCourse} is listed first` : '';
  $('prevWeek').disabled = ui.weekIndex === 0;
  $('nextWeek').disabled = ui.weekIndex === model.weeks.length - 1;

  const grid = $('weeklyGrid');
  const frag = document.createDocumentFragment();
  frag.append(document.createElement('div'));
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  for (const d of days) {
    const h = document.createElement('div');
    h.className = `day-head${d === today ? ' today' : ''}`;
    h.innerHTML = `<span class="dow">${fmtDow(d)}</span><span class="date">${fmtShort(d)}</span>`;
    frag.append(h);
  }
  let count = 0;
  // The course you clicked leads the lanes, so it is in view without scrolling.
  const lanes = [...model.courses].sort((a, b) => (b.code === ui.focusCourse) - (a.code === ui.focusCourse));
  for (const course of lanes) {
    const focused = course.code === ui.focusCourse;
    const lab = document.createElement('div');
    lab.className = `lane-label${focused ? ' focused' : ''}`;
    lab.innerHTML = `<i class="dot c${course.color}"></i>${esc(course.code)}`;
    frag.append(lab);
    for (const d of days) {
      const cell = document.createElement('div');
      cell.className = `day-cell${focused ? ' focused' : ''}`;
      const list = model.deadlines.filter(x => x.course === course.code && x.date === d);
      count += list.length;
      for (const item of list) cell.append(itemEl(item));
      frag.append(cell);
    }
  }
  // Lanes share the window height so a whole week fits without scrolling;
  // a busy day can still grow its lane.
  const top = grid.getBoundingClientRect().top + scrollY;
  const laneH = Math.round(Math.min(94, Math.max(46, (innerHeight - top - 42 - 24) / Math.max(1, lanes.length))));
  grid.style.setProperty('--lane-h', `${laneH}px`);
  grid.replaceChildren(frag);
  $('weekEmpty').hidden = count > 0;
}

function itemEl(d) {
  const guess = d.source === 'syllabus' && !d.confirmed;
  const done = d.done || d.status === 'done' || d.status === 'graded' || d.status === 'submitted';
  // Only open real web links (Canvas pages); anything else stays a button.
  const safeUrl = /^https:\/\//i.test(d.url || '') ? d.url : null;
  const el = document.createElement(safeUrl && !guess ? 'a' : 'button');
  el.className = `item${guess ? ' guess' : ''}${done ? ' done' : ''}`;
  if (el.tagName === 'A') { el.href = safeUrl; el.target = '_blank'; el.rel = 'noopener'; } else el.type = 'button';
  const state = d.status === 'missing' ? '<span class="state missing"> · missing</span>'
    : d.status === 'submitted' ? '<span class="state"> · submitted</span>'
      : d.status === 'graded' ? '<span class="state"> · graded</span>'
        : d.done ? '<span class="state"> · done</span>' : '';
  const weekly = d.recurring ? '<span class="state"> · weekly</span>' : '';
  el.innerHTML = `<div class="item-time"><span class="sym" aria-hidden="true">${SYMBOLS[d.kind]}</span>${esc(d.time || 'time not listed')}${weekly}${state}</div><div class="item-title">${esc(d.title)}</div>`;
  el.setAttribute('aria-label', `${KIND_LABELS[d.kind]}: ${d.title}, ${d.time || 'no time'}${guess ? ', date from syllabus, unconfirmed' : ''}`);
  bindTip(el, () => {
    const lines = [
      `<div class="tip-title">${esc(d.course)} · ${fmtLong(d.date)}</div>`,
      `<div class="tip-line"><span class="sym">${SYMBOLS[d.kind]}</span> ${esc(d.title)}${d.time ? ` · ${esc(d.time)}` : ''}</div>`,
      d.points != null ? `<div class="tip-meta">${d.points} points · ${KIND_LABELS[d.kind]}</div>` : `<div class="tip-meta">${KIND_LABELS[d.kind]}</div>`,
      d.note ? `<div class="tip-meta">Syllabus: “${esc(d.note)}”</div>` : '',
      d.recurring ? '<div class="tip-meta">Part of a weekly series read from the syllabus; holidays are skipped.</div>' : '',
      guess ? '<div class="tip-meta">Read from the syllabus by AI. Click to mark it confirmed.</div>' : '',
      safeUrl && !guess ? '<div class="tip-meta">Click to open in Canvas.</div>' : '',
    ];
    return lines.join('');
  });
  if (guess || (d.source === 'syllabus' && d.confirmed)) {
    el.addEventListener('click', async () => {
      const { confirmed = {} } = await chrome.storage.local.get('confirmed');
      if (confirmed[d.id]) delete confirmed[d.id]; else confirmed[d.id] = true;
      await chrome.storage.local.set({ confirmed });
    });
  }
  return el;
}

/* ---------- class schedule ---------- */

// Hour height adapts to the window so a whole day of classes fits on screen.
const HOUR_MIN = 34, HOUR_MAX = 72;
function fitHourPx(hours, headerPx = 40) {
  const grid = $('schedGrid');
  const top = grid.getBoundingClientRect().top + scrollY;
  const avail = innerHeight - top - headerPx - 20;
  return Math.round(Math.min(HOUR_MAX, Math.max(HOUR_MIN, avail / hours)));
}

function renderSchedule() {
  const monday = model.weeks.length ? model.weeks[ui.schedIndex] : mondayOf(todayKey());
  const today = todayKey();
  const { meetings, cancelled, extra, closures } = scheduleWeek(model, monday);
  const closureOn = d => closures.find(c => c.date === d);
  const hasWeekend = [...meetings, ...cancelled].some(m => [0, 6].includes(keyToDate(m.date).getUTCDay()));
  const days = Array.from({ length: hasWeekend ? 7 : 5 }, (_, i) => addDays(monday, i));
  const isThisWeek = mondayOf(today) === monday;

  $('schedTitle').textContent = `${fmtRange(monday, days.at(-1))}, ${monday.slice(0, 4)}`;
  $('schedNote').textContent = isThisWeek ? 'This week' : '';
  $('schedPrev').disabled = ui.schedIndex <= 0;
  $('schedNext').disabled = ui.schedIndex >= model.weeks.length - 1;
  $('schedToday').hidden = isThisWeek;

  if (!model.hasMyU) {
    $('schedGrid').innerHTML = '<p class="week-empty">Sync MyU to see your class times here.</p>';
    $('schedChanges').hidden = true;
    return;
  }

  // Grid spans the whole semester's hours so the layout does not jump between weeks.
  const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const all = model.meetings.length ? model.meetings : model.classes.flatMap(c => c.rows);
  const first = Math.floor(Math.min(...all.map(m => toMin(m.start))) / 60);
  const last = Math.ceil(Math.max(...all.map(m => toMin(m.end))) / 60);
  const HOUR_PX = fitHourPx(last - first, closures.length ? 58 : 40);
  const height = (last - first) * HOUR_PX;
  const y = t => ((toMin(t) - first * 60) / 60) * HOUR_PX;
  const colorOf = code => model.courses.find(c => c.code === code)?.color ?? 6;

  const grid = $('schedGrid');
  grid.style.setProperty('--days', days.length);
  grid.style.setProperty('--hour-px', `${HOUR_PX}px`);
  const frag = document.createDocumentFragment();
  const corner = document.createElement('div'); corner.className = 'sched-corner'; frag.append(corner);
  for (const d of days) {
    const h = document.createElement('div');
    const closure = closureOn(d);
    h.className = `sched-day${d === today ? ' today' : ''}${closure ? ' closed' : ''}`;
    h.innerHTML = `<span class="dow">${fmtDow(d)}</span> <span class="date">${fmtShort(d)}</span>${closure ? `<span class="closed-label">${esc(closure.label)}</span>` : ''}`;
    frag.append(h);
  }
  const hours = document.createElement('div');
  hours.className = 'hours';
  hours.style.height = `${height}px`;
  for (let h = first; h <= last; h++) {
    const lab = document.createElement('span');
    lab.className = 'hour';
    lab.style.top = `${(h - first) * HOUR_PX}px`;
    lab.textContent = hhmmLabel(`${h}:00`).replace(':00', '');
    if (h === first) lab.classList.add('first');
    hours.append(lab);
  }
  frag.append(hours);

  for (const d of days) {
    const col = document.createElement('div');
    col.className = `sched-col${d === today ? ' today' : ''}${closureOn(d) ? ' closed' : ''}`;
    col.style.height = `${height}px`;
    if (closureOn(d)) {
      const note = document.createElement('p');
      note.className = 'closed-note';
      note.textContent = 'No classes';
      col.append(note);
    }
    const entries = [
      ...meetings.filter(m => m.date === d).map(m => ({ ...m, cancelled: false })),
      ...cancelled.filter(m => m.date === d).map(m => ({ ...m, cancelled: true })),
    ].sort((a, b) => a.start.localeCompare(b.start));
    // Side-by-side lanes when two meetings overlap.
    const lanes = [];
    for (const e of entries) {
      let lane = lanes.findIndex(end => end <= e.start);
      if (lane < 0) { lane = lanes.length; lanes.push(e.end); } else lanes[lane] = e.end;
      e.lane = lane;
    }
    for (const e of entries) {
      const overlapping = entries.filter(o => o.start < e.end && e.start < o.end);
      const width = Math.max(...overlapping.map(o => o.lane)) + 1;
      const box = document.createElement('div');
      const top = y(e.start), h = Math.max(22, y(e.end) - top - 2);
      // Three densities: code / time / room, code / time · room, or one line.
      const density = h >= 54 ? 'tall' : h >= 34 ? 'mid' : 'one';
      box.className = `meeting c${colorOf(e.course)} ${density}${e.cancelled ? ' cancelled' : ''}`;
      box.style.top = `${top + 1}px`;
      box.style.height = `${h}px`;
      if (width > 1) {
        box.style.left = `calc(${(e.lane / width) * 100}% + 4px)`;
        box.style.right = 'auto';
        box.style.width = `calc(${100 / width}% - 8px)`;
      }
      const time = `${hhmmLabel(e.start)}–${hhmmLabel(e.end)}`;
      const when = e.cancelled ? 'No class' : time;
      const where = e.cancelled ? '' : e.room;
      box.innerHTML = density === 'tall'
        ? `<div class="m-code">${esc(e.course)}</div><div class="m-meta">${esc(when)}</div><div class="m-meta">${esc(where)}</div>`
        : density === 'mid'
          ? `<div class="m-code">${esc(e.course)}</div><div class="m-meta">${esc([when, where].filter(Boolean).join(' · '))}</div>`
          : `<div class="m-code">${esc(e.course)} <span class="m-meta">${esc(e.cancelled ? 'No class' : hhmmLabel(e.start))}</span></div>`;
      box.tabIndex = 0;
      box.setAttribute('aria-label', `${e.course} ${e.cancelled ? 'no class' : ''} ${fmtDow(d)} ${time} ${e.room || ''}`);
      const cls = model.classes.find(c => c.course === e.course);
      bindTip(box, () => [
        `<div class="tip-title">${esc(e.course)} (${esc(e.section || cls?.section || '')}) ${esc(e.title || cls?.title || '')}</div>`,
        `<div class="tip-line">${e.cancelled ? 'No class listed in MyU this day' : `${esc(e.component || 'Class')} · ${esc(time)}`}</div>`,
        e.room ? `<div class="tip-line">${esc(e.room)}</div>` : '',
        cls?.rows?.[0]?.instructors ? `<div class="tip-meta">${esc(cls.rows.map(r => r.instructors).filter(Boolean).join('; '))}</div>` : '',
      ].join(''));
      col.append(box);
    }
    if (d === today) {
      const now = new Date();
      const hm = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Chicago', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
      const top = y(hm);
      if (top >= 0 && top <= height) {
        const line = document.createElement('div');
        line.className = 'now-line';
        line.style.top = `${top}px`;
        col.append(line);
      }
    }
    frag.append(col);
  }
  grid.replaceChildren(frag);

  const changes = [
    ...groupByDate(cancelled).map(([date, list]) => `<li><b>${fmtDow(date)} ${fmtShort(date)}:</b> no meeting for ${esc(list.join(', '))}</li>`),
    ...extra.map(m => `<li><b>${fmtDow(m.date)} ${fmtShort(m.date)}:</b> extra ${esc(m.course)} meeting ${hhmmLabel(m.start)}–${hhmmLabel(m.end)}${m.room ? `, ${esc(m.room)}` : ''}</li>`),
  ];
  $('schedChanges').hidden = !changes.length;
  $('schedChanges').innerHTML = changes.join('');

}

function groupByDate(list) {
  const map = new Map();
  for (const m of list) {
    if (!map.has(m.date)) map.set(m.date, []);
    if (!map.get(m.date).includes(m.course)) map.get(m.date).push(m.course);
  }
  return [...map].sort((a, b) => a[0].localeCompare(b[0]));
}

/* ---------- AI: sources → approval → reading ---------- */

const isExtensionPage = location.protocol === 'chrome-extension:';
let triaging = false, polishing = false;

// Reading approved sources is on by default and runs on this device with
// rules. An AI model (Azure OpenAI, OpenAI or Anthropic, your own key) is
// the optional second mode.
const readMode = () => (store.settings?.mode === 'ai' ? 'ai' : 'rules');
const useAI = () => readMode() === 'ai' && aiReady(aiConfig(store.settings));

function aiOn() {
  const s = store.settings || {};
  if (s.reading === false || !store.canvas || store.sample) return false;
  return readMode() === 'rules' || aiReady(aiConfig(s));
}

const triageFresh = () => store.triage?.fetchedAt === store.canvas?.fetchedAt && store.triage?.mode === readMode();

// Step 1, once per Canvas sync: pick which found files/pages are worth
// reading, from their names only.
async function runTriage() {
  if (triaging || !aiOn() || !isExtensionPage) return;
  if (triageFresh()) return;
  triaging = true;
  render();
  try {
    let t = ruleTriage(store.canvas);
    if (useAI() && await hasProviderPermission(aiConfig(store.settings))) {
      try {
        t = await aiTriage(aiConfig(store.settings), store.canvas);
      } catch (e) {
        t = { ...t, note: String(e.message || e) };
      }
    }
    await chrome.storage.local.set({ triage: { ...t, mode: readMode(), fetchedAt: store.canvas.fetchedAt, at: new Date().toISOString() } });
  } finally {
    triaging = false;
  }
}

// Data synced before holidays were supported: fetch them once and drop
// meetings MyU lists on closed days.
let closuresChecked = false;
async function ensureClosures() {
  if (closuresChecked || !isExtensionPage || !store.myu || store.sample || store.myu.closures) return;
  closuresChecked = true;
  const { myu } = store;
  const closures = await fetchClosures({ start: myu.range.start, end: addDays(myu.range.end, 10) }, 'UMNTC');
  const closed = new Set(closures.map(c => c.date));
  await chrome.storage.local.set({ myu: { ...myu, closures, meetings: myu.meetings.filter(m => !closed.has(m.date)) } });
}

// Runs after every storage change in the extension page: triage when a new
// sync landed, then read whatever is approved once nothing is waiting on the student.
function aiTick() {
  ensureClosures();
  if (!isExtensionPage || !aiOn()) return;
  if (!triageFresh()) { runTriage(); return; }
  if (!pendingPicks(store.canvas, store.triage, store.approvals).length) runPolish();
}

function renderSources() {
  const box = $('sources');
  const pending = aiOn() && triageFresh()
    ? pendingPicks(store.canvas, store.triage, store.approvals) : [];
  const show = !!(aiOn() && store.triage && (ui.showSources || (pending.length > 0 && ui.sourcesDismissed !== store.triage.at)));
  box.hidden = !show;
  if (!show) return;
  const t = store.triage;
  const approvals = store.approvals || {};
  const all = listCandidates(store.canvas);
  const nameOf = key => all.find(c => c.key === key)?.name || key.split('|')[1];
  const byCourse = new Map(model.courses.map(c => [c.code, []]));
  for (const c of all) byCourse.get(c.course)?.push(c);
  const size = b => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : b ? `${Math.max(1, Math.round(b / 1024))} KB` : '');
  const kindLabel = c => (c.kind === 'syllabus' ? 'Canvas syllabus' : c.foundIn.includes('Home page') ? 'Home page' : c.kind === 'page' ? 'Canvas page' : c.kind === 'link' ? 'outside link' : c.type.toUpperCase());

  const rows = [...byCourse].map(([course, list]) => {
    const uploads = store.uploads?.[course] || [];
    const items = list.map(c => {
      const checked = approvals[c.key] && approvals[c.key].fp === fingerprint(c) ? approvals[c.key].ok : !!t.picks[c.key];
      const why = t.dupes[c.key] ? (nameOf(t.dupes[c.key]) === c.name ? 'Another copy of the checked file' : `Same as ${esc(nameOf(t.dupes[c.key]))}`)
        : !c.readable ? manualSteps(c)
          : t.picks[c.key] ? esc(t.picks[c.key]) : `Found in ${esc(c.foundIn.join(', '))}`;
      const meta = [kindLabel(c), c.kind === 'file' ? size(c.size) : '', c.dates ? `${c.dates} dates` : ''].filter(Boolean).join(' · ');
      return `<li><label class="src-item${c.readable ? '' : ' off'}">
        <input type="checkbox" data-key="${esc(c.key)}" ${checked && c.readable ? 'checked' : ''} ${c.readable ? '' : 'disabled'}>
        <span class="src-name">${esc(c.name)}</span><span class="src-meta">${esc(meta)}</span>
        <span class="src-why">${why}</span></label></li>`;
    }).concat(uploads.map(u => `<li><label class="src-item"><input type="checkbox" checked disabled>
        <span class="src-name">${esc(u.name)}</span><span class="src-meta">added by you</span>
        <span class="src-why">Read every time</span></label></li>`)).join('');
    const empty = !list.length && !uploads.length ? '<li class="src-none">Nothing named like a syllabus or schedule was found.</li>' : '';
    return `<section class="src-course"><div class="src-head"><h3><i class="dot c${model.courses.find(x => x.code === course)?.color ?? 6}"></i>${esc(course)}</h3>
      <button class="btn quiet small" type="button" data-upload="${esc(course)}">Add a file</button>
      <input type="file" accept="application/pdf,image/*" data-course="${esc(course)}" hidden></div>
      <ul>${items}${empty}</ul></section>`;
  }).join('');

  box.innerHTML = `
    <div class="src-top">
      <div>
        <h2>Sources to read</h2>
        <p>${t.by === 'ai' ? `${esc(aiConfig(store.settings).label)} chose these from file names only` : 'Chosen by file name and how many dates each page mentions'}${t.note ? ' (the AI was unavailable)' : ''}. Nothing has been opened yet. Uncheck anything you don’t want read.</p>
      </div>
      <div class="inline">
        <button class="btn quiet" type="button" data-act="later">${pending.length ? 'Not now' : 'Close'}</button>
        <button class="btn primary" type="button" data-act="read">Read</button>
      </div>
    </div>
    <div class="src-grid">${rows}</div>`;
  updateReadCount();
}

// Sources the extension can't open itself get a link and three short steps.
const PRINT_KEY = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘P' : 'Ctrl+P';
function manualSteps(c) {
  const safe = /^https?:\/\//.test(c.url || '') ? c.url : null;
  const open = safe ? `<a href="${esc(safe)}" target="_blank" rel="noopener">Open it</a>` : 'Open it';
  const save = c.kind === 'link'
    ? `save the page as a PDF (${PRINT_KEY}, then Save as PDF)`
    : 'save it as a PDF (in Word or Google Docs: File, then Download, then PDF)';
  const where = c.kind === 'link' ? 'This lives outside Canvas. ' : 'This file type can’t be read directly. ';
  return `${where}${open}, ${save}, then click <b>Add a file</b>.`;
}

// "Read N sources" on first approval; when reviewing, only changes need saving.
function updateReadCount() {
  const btn = $('sources').querySelector('[data-act=read]');
  if (!btn) return;
  const n = $('sources').querySelectorAll('input[data-key]:checked').length;
  const approvals = store.approvals || {};
  const changed = [...$('sources').querySelectorAll('input[data-key]')].some(b => !!approvals[b.dataset.key]?.ok !== b.checked || !approvals[b.dataset.key]);
  btn.textContent = !changed ? 'Done' : n ? `Read ${n} source${n === 1 ? '' : 's'}` : 'Save choices';
}

async function saveApprovals() {
  const approvals = { ...(store.approvals || {}) };
  const all = new Map(listCandidates(store.canvas).map(c => [c.key, c]));
  for (const box of $('sources').querySelectorAll('input[data-key]')) {
    const c = all.get(box.dataset.key);
    if (c) approvals[c.key] = { ok: box.checked, fp: fingerprint(c) };
  }
  ui.showSources = false;
  await chrome.storage.local.set({ approvals });
}

async function addUpload(course, file) {
  let text = '', images = [];
  if (/pdf/.test(file.type) || /\.pdf$/i.test(file.name)) ({ text, images } = await readPdf(await file.arrayBuffer()));
  else if (/^image\//.test(file.type)) images = [await blobToDataUrl(file)];
  else return;
  const { uploads = {} } = await chrome.storage.local.get('uploads');
  uploads[course] = [...(uploads[course] || []), { id: `upload:${Date.now()}`, name: file.name, text: text.slice(0, 60000), images: images.slice(0, 4), at: new Date().toISOString() }];
  await chrome.storage.local.set({ uploads });
}

function renderAiStrip() {
  const strip = $('aiStrip');
  const entries = Object.entries(store.polish || {});
  if (!aiOn() || !$('sources').hidden) { strip.hidden = true; return; }
  const running = entries.filter(([, e]) => e.status === 'running').map(([c]) => c);
  const failed = entries.filter(([, e]) => e.status === 'error');
  const found = entries.filter(([, e]) => (e.result?.dated?.length || 0) + (e.result?.extra?.length || 0) > 0).map(([c]) => c);
  const dated = model.deadlines.filter(d => d.source === 'syllabus');
  const unconfirmed = dated.filter(d => !d.confirmed);
  const parts = [];
  if (triaging || !triageFresh()) parts.push('<b>Looking at syllabus and schedule file names…</b>');
  else if (running.length) parts.push(`<b>Reading approved sources ${useAI() ? `with ${esc(aiConfig(store.settings).label)}` : 'on this device'}</b>: ${esc(running.join(', '))}…`);
  else if (dated.length) {
    parts.push(`<b>${dated.length} date${dated.length === 1 ? '' : 's'} read from ${esc(found.join(', '))} sources</b>${unconfirmed.length ? `, dashed until you confirm ${unconfirmed.length === 1 ? 'it' : 'them'}.` : ', all confirmed.'}`);
  } else if (entries.length) parts.push('Approved sources read. Canvas already had every date.');
  else parts.push('No sources approved yet.');
  if (failed.length) parts.push(`<span class="err">${esc(failed.map(([c, e]) => `${c}: ${e.error}`).join('; '))}</span>`);
  const notes = entries.filter(([, e]) => e.result?.note).map(([c, e]) => `${c}: ${e.result.note}`);
  if (notes.length) parts.push(`<span class="err">${esc(notes.join('; '))}</span>`);
  // Only show the strip while there is something to wait for or act on;
  // reviewing sources later lives in Settings.
  const busy = triaging || !triageFresh() || running.length;
  if (!busy && !unconfirmed.length && !failed.length && !entries.some(([, e]) => e.result?.note)) { strip.hidden = true; return; }
  const actions = unconfirmed.length && !running.length ? '<button class="btn small" type="button" data-act="confirm-all">Confirm all</button>' : '';
  strip.innerHTML = `<span class="ai-text">${parts.join(' ')}</span><span class="inline">${actions}</span>`;
  strip.querySelector('.ai-text').title = strip.querySelector('.ai-text').textContent;
  strip.hidden = false;
}

// Reads a course's approved sources into plain text (plus page images of
// scanned PDFs), cached so switching modes doesn't download them again.
let sourceWrites = Promise.resolve();
async function readSources(job) {
  const cacheKey = hashInput({ src: job.approved.map(a => [a.key, fingerprint(a)]), up: job.uploads.map(u => u.id) });
  const cached = store.sourceTexts?.[job.course];
  if (cached?.key === cacheKey) return cached;
  const parts = [], images = [];
  const pages = job.approved.filter(a => a.kind === 'page');
  const failed = [];
  let pageTexts = pages.length
    ? await chrome.runtime.sendMessage({ type: 'read-pages', pages: pages.map(p => ({ courseId: job.canvasId, pageUrl: p.pageUrl })) })
    : {};
  if (!pageTexts || pageTexts.error || pageTexts.ok === false) {
    failed.push(...pages.map(p => p.name));
    pageTexts = {};
  }
  for (const src of job.approved) {
    if (src.kind === 'syllabus') parts.push({ name: 'Canvas Syllabus tab', text: store.canvas.sources[job.course].syllabusText });
    else if (src.kind === 'page') {
      const got = pageTexts[`${job.canvasId}|${src.pageUrl}`];
      if (got?.text) parts.push({ name: `Canvas page: ${src.name}`, text: got.text });
      else if (!failed.includes(src.name)) failed.push(src.name);
    } else if (src.kind === 'file') {
      await setPolish(job.course, { step: `reading ${src.name}` });
      try {
        const out = await readSyllabusFile({ url: src.url, name: src.name, type: src.type === 'pdf' ? 'application/pdf' : 'image/*' });
        parts.push({ name: src.name, text: out.text || '' });
        images.push(...out.images);
      } catch (e) {
        console.warn('[calendar] source skipped', src.name, e);
        failed.push(src.name);
      }
    }
  }
  for (const u of job.uploads) {
    parts.push({ name: `${u.name} (added by you)`, text: u.text || '' });
    images.push(...(u.images || []));
  }
  const entry = { key: cacheKey, parts, images: images.slice(0, 6), at: new Date().toISOString(), failed };
  // A source that couldn't be read (logged out, offline) is retried next time
  // instead of being remembered as empty.
  if (failed.length) return entry;
  sourceWrites = sourceWrites.then(async () => {
    const { sourceTexts = {} } = await chrome.storage.local.get('sourceTexts');
    sourceTexts[job.course] = entry;
    await chrome.storage.local.set({ sourceTexts });
  });
  await sourceWrites;
  return entry;
}

// Courses whose partly-failed read was already retried on this page load.
const retried = new Set();

function removePolish(course) {
  polishWrites = polishWrites.then(async () => {
    const { polish = {} } = await chrome.storage.local.get('polish');
    delete polish[course];
    await chrome.storage.local.set({ polish });
  });
}

async function hasProviderPermission(ai) {
  try { return await chrome.permissions.contains({ origins: providerOrigins(ai) }); } catch { return false; }
}

async function runPolish({ force = false } = {}) {
  if (polishing || !aiOn() || !isExtensionPage) return;
  let mode = useAI() ? 'ai' : 'rules';
  const ai = aiConfig(store.settings);
  if (mode === 'ai' && !(await hasProviderPermission(ai))) {
    ui.notice = { err: true, html: `Allow ${esc(ai.label)} first: open Settings and click <b>Save</b> next to your key. Until then, sources are read on this device.` };
    renderHeader();
    mode = 'rules';
  }
  polishing = true;
  try {
    const canvas = store.canvas;
    const semester = {
      start: store.myu?.range?.start || canvas.term.start,
      end: store.myu?.range?.end ? addDays(store.myu.range.end, 10) : canvas.term.end,
    };
    const jobs = canvas.courses.map(c => {
      const approved = approvedFor(canvas, store.approvals, c.code);
      const uploads = store.uploads?.[c.code] || [];
      if (!approved.length && !uploads.length) {
        // Sources were unchecked: forget what was read from them.
        if (store.polish?.[c.code]) removePolish(c.code);
        return null;
      }
      const undated = canvas.undated.filter(u => u.course === c.code);
      const items = canvas.deadlines.filter(d => d.course === c.code);
      const cls = store.myu?.classes.find(k => k.course === c.code);
      const pattern = cls ? cls.rows.map(r => `${dayNames(r.days)} ${hhmmLabel(r.start)}-${hhmmLabel(r.end)}`).join('; ') : 'unknown';
      const hash = hashInput({
        v: 4, mode, d: mode === 'ai' ? `${ai.provider}:${ai.model}` : EXTRACT_VERSION, c: c.code, semester, pattern,
        items: items.map(i => [i.id, i.title, i.date]), undated: undated.map(u => [u.id, u.title]),
        src: approved.map(a => [a.key, fingerprint(a)]), up: uploads.map(u => u.id),
        closures: (store.myu?.closures || []).map(x => x.date),
      });
      const prev = store.polish?.[c.code];
      const retry = prev?.partial && !retried.has(c.code);
      if (!force && prev?.hash === hash && prev.status !== 'running' && !retry) return null;
      retried.add(c.code);
      return { course: c.code, canvasId: canvas.sources[c.code]?.canvasId, approved, uploads, undated, items, pattern, cls, hash };
    }).filter(Boolean);

    const worker = async job => {
      await setPolish(job.course, { status: 'running', step: 'reading sources', hash: job.hash });
      try {
        const { parts, images, failed = [] } = await readSources(job);
        let result;
        if (mode === 'ai') {
          await setPolish(job.course, { step: `asking ${ai.label}${images.length ? ' (with page images)' : ''}` });
          result = await polishCourse({
            ai, course: job.course, term: semester,
            classes: store.myu?.range ? { first_day: store.myu.range.start, last_day: store.myu.range.end, no_class_days: (store.myu.closures || []).map(c => c.date) } : null,
            pattern: job.pattern, items: job.items, undated: job.undated, classInfo: job.cls, closures: store.myu?.closures || [],
            syllabusText: parts.map(p => `--- ${p.name} ---\n${p.text}`).join('\n\n'), images,
          });
          result.by = 'ai';
        } else {
          result = extractRules({
            sources: parts, items: job.items, undated: job.undated, classInfo: job.cls,
            closures: store.myu?.closures || [], term: semester,
          });
          // A scanned PDF has no text for rules to read.
          const scanned = parts.filter(p => !p.text.trim()).map(p => p.name);
          if (scanned.length && images.length) result.note = `${scanned.join(', ')} is a scanned image; choose an AI model in Settings to read it.`;
        }
        if (failed.length) result.note = `Couldn't read ${failed.join(', ')}; it will be tried again next time you open the calendar.`;
        await setPolish(job.course, { status: 'done', step: '', at: new Date().toISOString(), result, error: '', partial: failed.length > 0 });
      } catch (e) {
        await setPolish(job.course, { status: 'error', step: '', error: String(e.message || e) });
      }
    };
    // Two courses at a time keeps it quick without flooding Canvas or the API.
    const queue = [...jobs];
    await Promise.all([0, 1].map(async () => { while (queue.length) await worker(queue.shift()); }));
  } finally {
    polishing = false;
  }
}

/* ---------- render ---------- */

function render() {
  renderHeader();
  const empty = !model;
  $('emptyView').hidden = !empty;
  $('workloadView').hidden = empty || ui.view !== 'workload';
  $('classesView').hidden = empty || ui.view !== 'classes';
  document.querySelector('.switch').hidden = empty;
  for (const [id, v] of [['tabWorkload', 'workload'], ['tabClasses', 'classes']]) {
    $(id).setAttribute('aria-selected', String(ui.view === v));
    $(id).tabIndex = ui.view === v ? 0 : -1;
  }
  if (empty) return;

  if (ui.schedIndex == null) {
    ui.schedIndex = currentWeekIndex(model.weeks, todayKey());
    ui.weekIndex = ui.schedIndex;
  }
  ui.schedIndex = Math.min(ui.schedIndex, Math.max(0, model.weeks.length - 1));
  ui.weekIndex = Math.min(ui.weekIndex, Math.max(0, model.weeks.length - 1));
  if (!model.weeks.length) ui.layer = 'semester';

  if (ui.view === 'workload') {
    renderSources();
    renderAiStrip();
    $('semesterLayer').hidden = ui.layer !== 'semester';
    $('weekLayer').hidden = ui.layer !== 'week';
    if (!model.hasCanvas) {
      $('matrix').innerHTML = '<p class="week-empty">Sync Canvas to see your deadlines here.</p>';
    } else if (ui.layer === 'semester') renderMatrix();
    else renderWeek();
  } else renderSchedule();
  maybeStartTour();
}

/* ---------- actions ---------- */

function setView(v) {
  ui.view = v;
  try { localStorage.setItem('calendar-view', v); } catch {}
  hideTip();
  render();
}

function sync() {
  if (demoOnly('syncing with Canvas and MyU')) return;
  ui.notice = null;
  chrome.runtime.sendMessage({ type: 'sync', open: false });
}

async function loadSample() {
  if (demoOnly('reloading the sample')) return;
  const data = sampleData();
  await chrome.storage.local.set({ canvas: data.canvas, myu: data.myu, sample: true, polish: {}, syncState: {} });
  ui.notice = null;
}

function exportIcs() {
  if (demoOnly('downloading a calendar file')) return;
  const ics = buildIcs(model);
  const name = `${model.termName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-umn.ics`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  ui.notice = {
    html: `Saved <b>${esc(name)}</b> with ${model.meetings.length} class meetings and ${model.deadlines.length} deadlines. In Google Calendar, choose Settings, then Import, and pick that file. <a href="https://calendar.google.com/calendar/u/0/r/settings/export" target="_blank" rel="noopener">Open Google Calendar import</a> <button class="btn quiet small" type="button" data-act="dismiss">Dismiss</button>`,
  };
  renderHeader();
}

function wire() {
  $('tabWorkload').addEventListener('click', () => setView('workload'));
  $('tabClasses').addEventListener('click', () => setView('classes'));
  document.querySelector('.switch').addEventListener('keydown', ev => {
    if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
    const next = ui.view === 'workload' ? 'classes' : 'workload';
    setView(next);
    $(next === 'workload' ? 'tabWorkload' : 'tabClasses').focus();
  });
  $('syncBtn').addEventListener('click', sync);
  $('emptySync').addEventListener('click', sync);
  $('emptySample').addEventListener('click', loadSample);
  $('loadSample').addEventListener('click', loadSample);
  $('exportBtn').addEventListener('click', () => { exportIcs(); closeSettings(); });

  $('settingsBtn').addEventListener('click', () => {
    const open = $('settings').hidden;
    $('settings').hidden = !open;
    $('settingsBtn').setAttribute('aria-expanded', String(open));
    if (open) fillSettings();
  });
  $('loadSample').addEventListener('click', closeSettings);
  $('aiToggle').addEventListener('change', async ev => {
    if (demoOnly('changing settings')) { ev.target.checked = !ev.target.checked; return; }
    const settings = { ...(store.settings || {}), reading: ev.target.checked };
    await chrome.storage.local.set({ settings });
  });
  for (const radio of document.querySelectorAll('input[name=readMode]')) {
    radio.addEventListener('change', async () => {
      if (demoOnly('changing settings')) { fillSettings(); return; }
      const settings = { ...(store.settings || {}), mode: radio.value };
      await chrome.storage.local.set({ settings });
      store.settings = settings;
      fillSettings();
    });
  }
  $('aiProvider').addEventListener('change', async () => {
    if (demoOnly('changing settings')) { fillSettings(); return; }
    const settings = { ...(store.settings || {}), provider: $('aiProvider').value };
    await chrome.storage.local.set({ settings });
    store.settings = settings;
    fillSettings();
  });
  $('saveKey').addEventListener('click', async () => {
    if (demoOnly('saving an API key')) return;
    const prev = store.settings || {};
    const provider = $('aiProvider').value;
    const apiKey = $('apiKey').value.trim();
    const model = $('aiModel').value.trim();
    const settings = { ...prev, provider };
    settings[provider] = provider === 'azure'
      ? { endpoint: $('azureEndpoint').value.trim(), deployment: model || PROVIDERS.azure.defaultModel, apiKey }
      : { model: model || PROVIDERS[provider].defaultModel, apiKey };
    // The extension only talks to an AI provider after you allow it here.
    const origins = providerOrigins(aiConfig(settings));
    if (!origins.length) { $('keyStatus').textContent = 'The Azure endpoint must be an https://….azure.com address.'; return; }
    let allowed = false;
    try { allowed = await chrome.permissions.request({ origins }); } catch {}
    if (!allowed) { $('keyStatus').textContent = 'Not saved: Chrome permission to reach this provider was declined.'; return; }
    await chrome.storage.local.set({ settings });
    store.settings = settings;
    fillSettings();
    $('keyStatus').textContent = aiReady(aiConfig(settings)) ? 'Saved in this browser.' : 'Saved, but the key (or Azure endpoint) is still missing.';
  });
  $('notice').addEventListener('click', ev => {
    if (ev.target.closest('[data-act=dismiss]')) { ui.notice = null; renderHeader(); }
  });
  $('reviewSources').addEventListener('click', () => {
    if (demoOnly('reviewing syllabus sources')) return;
    ui.showSources = true;
    closeSettings();
    setView('workload');
    $('sources').scrollIntoView({ block: 'nearest' });
  });
  $('showTour').addEventListener('click', () => { closeSettings(); setView('workload'); runTour(); });
  $('clearData').addEventListener('click', async () => {
    if (demoOnly('clearing data')) return;
    await chrome.storage.local.remove(['canvas', 'myu', 'polish', 'confirmed', 'sample', 'syncState', 'triage', 'approvals', 'uploads', 'sourceTexts']);
    ui.layer = 'semester';
    ui.schedIndex = null;
  });

  $('sources').addEventListener('change', ev => {
    if (ev.target.matches('input[data-key]')) updateReadCount();
    if (ev.target.matches('input[type=file]') && ev.target.files[0]) {
      const btn = ev.target.previousElementSibling;
      btn.textContent = 'Reading file…';
      btn.disabled = true;
      addUpload(ev.target.dataset.course, ev.target.files[0]).catch(() => {
        btn.textContent = 'Couldn’t read that file';
        btn.disabled = false;
      });
    }
  });
  $('sources').addEventListener('click', ev => {
    const up = ev.target.closest('[data-upload]');
    if (up && !demoOnly('adding a file')) up.nextElementSibling.click();
    const act = ev.target.closest('[data-act]')?.dataset.act;
    if (act === 'read') saveApprovals();
    if (act === 'later') { ui.showSources = false; ui.sourcesDismissed = store.triage?.at; render(); }
  });
  $('aiStrip').addEventListener('click', async ev => {
    const act = ev.target.closest('[data-act]')?.dataset.act;
    if (act === 'confirm-all') {
      const { confirmed = {} } = await chrome.storage.local.get('confirmed');
      for (const d of model.deadlines) if (d.source === 'syllabus') confirmed[d.id] = true;
      await chrome.storage.local.set({ confirmed });
    }
  });

  $('backBtn').addEventListener('click', () => { ui.layer = 'semester'; hideTip(); render(); });
  $('prevWeek').addEventListener('click', () => { ui.weekIndex--; render(); });
  $('nextWeek').addEventListener('click', () => { ui.weekIndex++; render(); });
  $('schedPrev').addEventListener('click', () => { ui.schedIndex--; render(); });
  $('schedNext').addEventListener('click', () => { ui.schedIndex++; render(); });
  $('schedToday').addEventListener('click', () => { ui.schedIndex = currentWeekIndex(model.weeks, todayKey()); render(); });
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape' && ui.view === 'workload' && ui.layer === 'week') { ui.layer = 'semester'; render(); }
  });
  addEventListener('scroll', hideTip, { passive: true });
  let resizeTimer;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (model) render(); }, 120);
  });
}

function closeSettings() {
  $('settings').hidden = true;
  $('settingsBtn').setAttribute('aria-expanded', 'false');
}

/* ---------- first-run tour ---------- */

let tourShown = false;

function runTour() {
  tourShown = true;
  hideTip();
  const sourcesOpen = () => !$('sources').hidden;
  startTour([
    {
      target: () => document.querySelector('.switch'),
      title: 'Two views of your semester',
      body: '<b>Workload</b> puts every course against every week. Darker purple means more is due, and the symbols show what kind (♣ exam, ♠ quiz, ♦ assignment). Click a week to see its items. <b>Class schedule</b> shows where you need to be each day, from MyU.',
      before: () => setView('workload'),
    },
    {
      target: () => (sourcesOpen() ? $('sources') : $('settingsBtn')),
      title: 'You approve what gets read',
      body: 'The calendar suggests each course’s syllabus and schedule files from their names. Nothing is opened until you click <b>Read</b>, and it is read on this device. Dates it finds show dashed until you confirm them. You can review sources again from Settings.',
    },
    {
      target: () => $('syncBtn'),
      title: 'Keep it current',
      body: 'Sync again any time to pull new deadlines and class changes. To add everything to Google Calendar or Apple Calendar, open <b>Settings</b>.',
    },
  ], { onEnd: () => chrome.storage.local.set({ tour: { done: true, at: new Date().toISOString() } }) });
}

// First visit with data: wait until the AI has suggested sources (if it is
// on) so the tour can point at them.
function maybeStartTour() {
  if (tourShown || !model || store.tour?.done) return;
  if (aiOn() && (triaging || !triageFresh())) return;
  setTimeout(runTour, 300);
  tourShown = true;
}

function fillSettings() {
  const s = store.settings || {};
  const ai = aiConfig(s);
  $('aiToggle').checked = s.reading !== false;
  for (const r of document.querySelectorAll('input[name=readMode]')) r.checked = r.value === readMode();
  $('aiFields').hidden = readMode() !== 'ai';
  $('aiProvider').value = ai.provider;
  $('endpointRow').hidden = ai.provider !== 'azure';
  $('azureEndpoint').value = ai.endpoint;
  $('aiModelLabel').textContent = ai.provider === 'azure' ? 'Deployment name' : 'Model';
  $('aiModel').value = ai.model;
  $('aiModel').placeholder = PROVIDERS[ai.provider].defaultModel;
  $('apiKey').value = ai.apiKey;
  $('apiKey').placeholder = { azure: 'Key 1 from the deployment page', openai: 'sk-…', anthropic: 'sk-ant-…' }[ai.provider];
  $('keyStatus').textContent = aiReady(ai) ? 'Saved in this browser.' : `Add your ${ai.label} key to use this mode.`;
  $('reviewSources').disabled = !IS_DEMO && (!store.triage || !!store.sample);
}

wire();
await load();
aiTick();
chrome.storage.onChanged.addListener(() => setTimeout(aiTick, 150));
