// Builds what the dashboard draws from stored sync data + AI polish results.

import { WEIGHTS, KINDS, cleanTitle } from './classify.js';
import { addDays, keyToDate, mondayOf, mondaysBetween } from './time.js';
import { sameItem } from './sources.js';

export const COURSE_COLORS = 7; // matches .c0 … .c6 in dashboard.css

export function buildModel({ canvas, myu, polish = {}, confirmed = {} }) {
  const courseMap = new Map();
  const touch = (code, patch) => courseMap.set(code, { code, name: '', section: '', ...courseMap.get(code), ...patch });
  for (const c of canvas?.courses || []) touch(c.code, { name: c.name, section: c.section, canvasId: c.canvasId });
  for (const c of myu?.classes || []) touch(c.course, { name: courseMap.get(c.course)?.name || c.title, section: c.section, classNbr: c.classNbr });
  const courses = [...courseMap.values()].sort((a, b) => a.code.localeCompare(b.code));
  courses.forEach((c, i) => { c.color = i % COURSE_COLORS; });

  const deadlines = [];
  const datedIds = new Set();
  for (const d of canvas?.deadlines || []) {
    const p = polish[d.course]?.result;
    deadlines.push({
      ...d,
      kind: KINDS.includes(p?.kinds?.[d.id]) ? p.kinds[d.id] : d.kind,
      title: p?.titles?.[d.id] ? cleanTitle(p.titles[d.id], d.course) : d.title,
    });
  }
  const undatedById = new Map((canvas?.undated || []).map(u => [u.id, u]));
  for (const [course, entry] of Object.entries(polish)) {
    const r = entry?.result;
    if (!r) continue;
    for (const g of r.dated || []) {
      const u = undatedById.get(g.id);
      if (!u || datedIds.has(g.id)) continue;
      datedIds.add(g.id);
      deadlines.push({
        ...u, source: 'syllabus', kind: KINDS.includes(r.kinds?.[g.id]) ? r.kinds[g.id] : u.kind,
        title: r.titles?.[g.id] ? cleanTitle(r.titles[g.id], course) : u.title, date: g.date, time: g.time || '', dueAt: null,
        status: 'todo', done: false, confirmed: !!confirmed[g.id], note: g.evidence || '', recurring: !!g.recurring,
      });
    }
    (r.extra || []).forEach((x, i) => {
      // Ids come from the item itself, so a confirmation stays with its item
      // even when a re-read returns items in another order.
      const slug = String(x.title).toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const id = x.recurring ? `syllabus:${course}:${slug}` : `syllabus:${course}:${slug}:${x.date}`;
      // The model already sees Canvas items; this second check catches a
      // repeat it missed (same item within a day, e.g. "HW 3" vs "Homework 3").
      const near = d => d.course === course && Math.abs(keyToDate(d.date) - keyToDate(x.date)) <= 864e5;
      if (deadlines.some(d => near(d) && sameItem(d.title, x.title))) return;
      deadlines.push({
        id, source: 'syllabus', kind: KINDS.includes(x.kind) ? x.kind : 'assignment', course,
        title: cleanTitle(x.title, course), date: x.date, time: x.time || '', dueAt: null,
        points: null, status: 'todo', done: false, confirmed: !!confirmed[id], note: x.evidence || '', url: null, recurring: !!x.recurring,
      });
    });
  }
  deadlines.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  const undated = [...undatedById.values()].filter(u => !datedIds.has(u.id));

  // Semester span: MyU class dates when known, stretched to cover every deadline
  // that falls inside the Canvas term.
  const termStart = canvas?.term?.start, termEnd = canvas?.term?.end;
  const inTerm = deadlines.filter(d => (!termStart || d.date >= termStart) && (!termEnd || d.date <= termEnd));
  const firstDue = inTerm[0]?.date, lastDue = inTerm[inTerm.length - 1]?.date;
  const start = [myu?.range?.start, firstDue].filter(Boolean).sort()[0];
  const end = [myu?.range?.end, lastDue].filter(Boolean).sort().pop();
  const weeks = start && end ? mondaysBetween(start, end) : [];

  return {
    termName: prettyTerm(canvas?.term?.name),
    courses, deadlines: inTerm, undated, weeks,
    meetings: myu?.meetings || [],
    closures: myu?.closures || [],
    classes: (myu?.classes || []).map(c => withObservedDays(c, myu.meetings || [])).sort((a, b) => a.course.localeCompare(b.course)),
    hasCanvas: !!canvas, hasMyU: !!myu,
  };
}

// "2026 Fall (08/10/2026-01/06/2027)" -> "Fall 2026"
function prettyTerm(name) {
  const base = String(name || '').replace(/\s*\(.*\)\s*$/, '').trim();
  const m = base.match(/^(\d{4})\s+(Spring|Summer|Fall|Winter)$/i);
  return m ? `${m[2]} ${m[1]}` : base || 'This semester';
}

// The weekly scans are the ground truth for when a class meets. Add weekdays
// that show up at least twice at a row's start time and belong to no other
// row, so a mis-read pattern string never hides a regular meeting.
function withObservedDays(cls, meetings) {
  const mine = meetings.filter(m => m.course === cls.course);
  if (!mine.length) return cls;
  const rows = cls.rows.map(r => {
    const counts = new Map();
    for (const m of mine) {
      if (m.start !== r.start) continue;
      const day = new Date(`${m.date}T12:00:00Z`).getUTCDay();
      counts.set(day, (counts.get(day) || 0) + 1);
    }
    const taken = new Set(cls.rows.filter(o => o !== r).flatMap(o => o.days));
    const extra = [...counts].filter(([d, n]) => n >= 2 && !r.days.includes(d) && !taken.has(d)).map(([d]) => d);
    return extra.length ? { ...r, days: [...r.days, ...extra].sort() } : r;
  });
  return { ...cls, rows };
}

export function deadlinesIn(model, course, monday) {
  const sunday = addDays(monday, 6);
  return model.deadlines.filter(d => d.course === course && d.date >= monday && d.date <= sunday);
}

export function loadLevel(list) {
  const s = list.reduce((n, d) => n + (WEIGHTS[d.kind] || 1), 0);
  return s === 0 ? 0 : s <= 1.6 ? 1 : s <= 3.4 ? 2 : s <= 5.8 ? 3 : 4;
}

// Meetings a class should have in a week according to its MyU pattern,
// compared with what MyU actually lists, so breaks and extra sessions show.
export function scheduleWeek(model, monday) {
  const sunday = addDays(monday, 6);
  const actual = model.meetings.filter(m => m.date >= monday && m.date <= sunday);
  const have = new Set(actual.map(m => `${m.course}|${m.date}|${m.start}`));
  const expected = [];
  for (const cls of model.classes) {
    for (const r of cls.rows) {
      for (const day of r.days) {
        const date = addDays(monday, (day + 6) % 7);
        if ((r.startDate && date < r.startDate) || (r.endDate && date > r.endDate)) continue;
        expected.push({ course: cls.course, date, start: r.start, end: r.end, room: r.room });
      }
    }
  }
  const closures = (model.closures || []).filter(c => c.date >= monday && c.date <= sunday);
  const closed = new Set(closures.map(c => c.date));
  const want = new Set(expected.map(e => `${e.course}|${e.date}|${e.start}`));
  const cancelled = model.meetings.length
    ? expected.filter(e => !closed.has(e.date) && !have.has(`${e.course}|${e.date}|${e.start}`)) : [];
  const extra = actual.filter(m => !want.has(`${m.course}|${m.date}|${m.start}`));
  return { meetings: actual, cancelled, extra, closures };
}

// "Mon Wed Fri · 9:05–9:55am" for a class detail row.
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const dayNames = days => days.map(d => DAY_NAMES[d]).join(' ');

export function currentWeekIndex(weeks, today) {
  const monday = mondayOf(today);
  const i = weeks.indexOf(monday);
  if (i >= 0) return i;
  return today < (weeks[0] || '') ? 0 : Math.max(0, weeks.length - 1);
}

