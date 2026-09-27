// Rules-only syllabus reading: finds due dates in approved source text on
// this device, with no AI and no network. Returns the same shape as the AI
// path (polish.js), so the rest of the calendar treats both alike:
//   { kinds, titles, dated: [{ id, date, time, evidence }], extra: [{ title, kind, date, time, evidence }] }
//
// How it reads a source:
//   1. Split into lines (PDF lines, or table rows joined with " | ").
//   2. Find graded items on each line ("HW 3", "Quiz 2", "Midterm", "FP1", "Final exam").
//   3. Give each item the date on its line, or the date of the table row it
//      sits under ("Wed, Sept. 9 | … | A0 due").
//   4. Match items to Canvas assignments that have no due date; anything else
//      with an explicit date becomes a new item, unless Canvas already has it.
//   5. A few common weekly rules ("each lab except the first week begins with
//      a quiz") date numbered Canvas items that are still undated.

import { classify } from './classify.js';
import { sameItem } from './sources.js';
import { addDays, hhmmLabel, keyToDate } from './time.js';

// Bump when the rules change so saved results are recomputed.
export const EXTRACT_VERSION = 'rules-3';

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const DAYS = { sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6 };

// Whole month names or their usual abbreviations only, so words like
// "separate 2" or "decide 3" are not read as dates.
const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?(?![a-z])';
const DATE_RES = [
  // "Sept. 9", "October 12th", "Dec 19"
  new RegExp(`\\b${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?!\\d)`, 'gi'),
  // "9/14", "10/9/2026"
  /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?!\d)/g,
];

const GENERIC_RE = /\b(project\s+(?:proposal|report|presentation)|final\s+(?:project|report|presentation)|peer\s+review)\b/gi;

// Graded items. Order matters: the first pattern that matches a span wins.
const ITEM_RES = [
  [/\bfinal\s+exam(?:ination)?\b/gi, () => 'Final Exam', 'exam'],
  [/\bmid-?term(?:\s+exam)?\s*#?\s*(\d+)\b/gi, m => `Midterm ${m[1]}`, 'exam'],
  [/\bmid-?term(?:\s+exam)?\b/gi, () => 'Midterm', 'exam'],
  [/\bexam\s*#?\s*(\d+)\b/gi, m => `Exam ${m[1]}`, 'exam'],
  [/\bquiz\s*#?\s*(\d+)\b/gi, m => `Quiz ${m[1]}`, 'quiz'],
  [/\b(?:hw|homework|problem\s+set|ps)\s*#?\s*(\d+)\b/gi, m => `HW ${m[1]}`, 'assignment'],
  [/\bassignment\s*#?\s*(\d+)\b/gi, m => `Assignment ${m[1]}`, 'assignment'],
  [/\blab\s*#?\s*(\d+)\b/gi, m => `Lab ${m[1]}`, 'assignment'],
  [/\b(FP|A|P)(\d{1,2})\b/g, m => `${m[1]}${m[2]}`, m => (m[1] === 'FP' ? 'project' : 'assignment')],
  [GENERIC_RE, m => m[1].replace(/\b\w/g, c => c.toUpperCase()), 'project'],
];

const DUE_WORDS = /\b(due|submit|submission|deadline|turn\s+in|hand\s+in|in class|exam|quiz|midterm)\b/i;

export function toLines(text) {
  return String(text || '')
    .split(/\n+/)
    .map(l => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

// All dates on a line, with their positions, resolved into the term.
export function findDates(line, term) {
  const out = [];
  for (const re of DATE_RES) {
    re.lastIndex = 0;
    for (let m; (m = re.exec(line));) {
      let month, day, year;
      if (/[a-z]/i.test(m[1])) { month = MONTHS[m[1].toLowerCase().slice(0, m[1].toLowerCase().startsWith('sept') ? 4 : 3)]; day = +m[2]; }
      else { month = +m[1]; day = +m[2]; year = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : undefined; }
      if (!month || month > 12 || !day || day > 31) continue;
      const key = resolveYear(month, day, year, term);
      if (key) out.push({ key, index: m.index, text: m[0] });
    }
  }
  return out.sort((a, b) => a.index - b.index);
}

function resolveYear(month, day, year, term) {
  const pad = n => String(n).padStart(2, '0');
  const years = year ? [year] : [+term.start.slice(0, 4), +term.start.slice(0, 4) + 1];
  const lo = addDays(term.start, -21), hi = addDays(term.end, 21);
  for (const y of years) {
    const key = `${y}-${pad(month)}-${pad(day)}`;
    const d = keyToDate(key);
    if (d.getUTCMonth() + 1 !== month) continue; // e.g. Sep 31
    if (key >= lo && key <= hi) return key;
  }
  return null;
}

export function findItems(line) {
  const found = [];
  const taken = [];
  for (const [re, name, kind] of ITEM_RES) {
    re.lastIndex = 0;
    for (let m; (m = re.exec(line));) {
      const span = [m.index, m.index + m[0].length];
      if (taken.some(([a, b]) => span[0] < b && a < span[1])) continue;
      taken.push(span);
      found.push({ title: name(m), kind: typeof kind === 'function' ? kind(m) : kind, index: m.index, generic: re === GENERIC_RE });
    }
  }
  // "FP1: Project Proposal" is one item: drop generic project words when a
  // numbered item shares the line.
  const numbered = found.some(f => /\d/.test(f.title));
  return found.filter(f => !(numbered && f.generic)).sort((a, b) => a.index - b.index);
}

// "11:59pm", "10:30AM-12:30PM", "11:59 PM CDT"
function findTime(line) {
  const m = line.match(/\b(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?\b/i);
  if (!m) return '';
  return `${+m[1]}:${m[2] || '00'}${m[3].toLowerCase()}m`;
}

// A course-wide rule like "homeworks are due at 11:59 PM".
function defaultDueTime(lines) {
  for (const l of lines) {
    const m = l.match(/\b(?:all\s+)?(?:assignments?|homeworks?|hw)\b.{0,30}\bdue\b.{0,15}?\b(\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?)/i);
    if (m) return findTime(m[1]);
  }
  return '';
}

const clip = s => (s.length > 90 ? `${s.slice(0, 87)}…` : s);

// Candidate (item, date) pairs from one source's lines.
export function scanLines(lines, term) {
  const hits = [];
  let rowDate = null; // date of the table row / schedule block we are in
  for (const [li, line] of lines.entries()) {
    const dates = findDates(line, term);
    // A wrapped PDF line can carry the rest of the sentence ("… Oct 29," / "due in 48 hours").
    const tail = /^\W*(due|with|and|,)/i.test(lines[li + 1] || '') ? ` ${lines[li + 1]}` : '';
    const items = findItems(line);
    // A line that starts with a date opens a new schedule row.
    if (dates.length && dates[0].index < 25) rowDate = dates[0];
    if (!items.length) continue;
    items.forEach((it, i) => {
      // Each item owns the text up to the next item: "Midterm 1 Friday 10/9 …
      // Midterm 2 Friday 11/13" gives each midterm its own date.
      const next = items[i + 1]?.index ?? Infinity;
      const prev = i > 0 ? items[i - 1].index : -1;
      // "HW 5, assigned Monday 10/5, due Monday 10/12": the date after "due" wins.
      const seg = line.slice(it.index, next === Infinity ? undefined : next);
      const dueAt = seg.search(/\bdue\b/i);
      let date = (dueAt >= 0 && dates.find(d => d.index > it.index + dueAt && d.index < next))
        || dates.find(d => d.index > it.index && d.index < next)
        || [...dates].reverse().find(d => d.index < it.index && d.index > prev)
        || (items.length === 1 ? dates[0] : null);
      let how = 'same line';
      if (!date && rowDate && /\bdue\b|\bsubmit/i.test(line)) {
        date = rowDate;
        how = 'table row';
      }
      if (!date) return;
      // Lecture topics mention items ("Intro to HW 1", "A1 assigned") without a
      // deadline; the item's own part of the line needs a due word, unless it
      // is an exam or quiz that simply happens that day.
      const own = how === 'table row' ? line : seg;
      if (!DUE_WORDS.test(own) && !['quiz', 'exam'].includes(it.kind)) return;
      // "due in 48 hours" moves the deadline past the listed day.
      const window = `${line}${tail}`.match(/\bdue\s+(?:with)?in\s+(\d+)\s*(?:hours|hrs|h)\b/i);
      const dateKey = window ? addDays(date.key, Math.round(+window[1] / 24)) : date.key;
      hits.push({ ...it, date: dateKey, time: findTime(line.slice(it.index, next)) || (items.length === 1 ? findTime(line) : ''), how, line: `${line}${tail}`, evidence: clip(line) });
    });
  }
  return hits;
}

// "Each lab session except the first week begins with a short quiz."
function weeklyRules(lines) {
  const rules = [];
  // Sentences often wrap across two PDF lines.
  const windows = lines.map((l, i) => (lines[i + 1] ? `${l} ${lines[i + 1]}` : l));
  for (const l of windows) {
    const m = l.match(/\b(?:each|every)\s+(monday|tuesday|wednesday|thursday|friday|lab|discussion|recitation|class|lecture)\b.{0,80}?\b(quiz(?:zes)?|homework|hw)\b/i)
      || l.match(/\b(quiz(?:zes)?|homework|hw)\b.{0,60}?\b(?:each|every)\s+(monday|tuesday|wednesday|thursday|friday|lab|discussion|recitation|class|lecture)\b/i);
    if (!m) continue;
    const [when, what] = /quiz|homework|hw/i.test(m[1]) ? [m[2], m[1]] : [m[1], m[2]];
    rules.push({
      when: when.toLowerCase(),
      kind: /quiz/i.test(what) ? 'quiz' : 'assignment',
      certain: /\b(begins?|starts?|opens?)\s+with\s+(a\s+)?(short\s+)?quiz|\bweekly\s+quiz|\bquiz\s+(every|each)\b/i.test(l),
      skipFirstWeek: /except\s+(?:during\s+|in\s+)?(?:the\s+)?first\s+week|starting\s+(?:in\s+)?week\s*2/i.test(l),
      evidence: clip(l),
    });
  }
  // One rule per kind. Sentences about the same series add up: one says
  // "each lab", another "except the first week", a third "begins with a quiz".
  const byKind = new Map();
  for (const r of rules) {
    const cur = byKind.get(r.kind);
    if (!cur) { byKind.set(r.kind, { ...r }); continue; }
    cur.skipFirstWeek ||= r.skipFirstWeek;
    cur.certain ||= r.certain;
    if (r.skipFirstWeek && r.certain) cur.evidence = r.evidence;
  }
  return [...byKind.values()];
}

// Which weekday a rule means: a named day, or the meeting row of a class
// that meets once a week (labs and discussions usually do).
function ruleWeekday(rule, classInfo) {
  const named = DAYS[rule.when.slice(0, 3)];
  if (named !== undefined && /day$/.test(rule.when)) return { day: named, start: null };
  const rows = classInfo?.rows || [];
  const row = /lab|discussion|recitation/.test(rule.when)
    ? rows.find(r => r.days.length === 1) || rows.at(-1)
    : rows[0];
  return row ? { day: row.days[0], start: row.start } : null;
}

function classStart(classInfo, dateKey) {
  const day = keyToDate(dateKey).getUTCDay();
  const row = (classInfo?.rows || []).find(r => r.days.includes(day));
  return row ? hhmmLabel(row.start) : '';
}

const numberOf = t => (String(t).match(/\d+/) || [])[0];

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// Turns one repeating event into dated items: "Quiz" every Thursday from
// first_date to last_date becomes Quiz 1, Quiz 2, … on each class day,
// skipping university closures and skip_dates. Canvas items that already
// exist (dated or not) keep their identity; only missing numbers are added,
// and only when createNew is true.
//   series: { title, kind, weekday (0-6 or name), first_date, last_date, time, skip_dates, evidence }
export function expandRecurring(series, { undated = [], items = [], classInfo = null, closures = [], dated, extra, usedIds, createNew = true }) {
  const day = typeof series.weekday === 'number' ? series.weekday : WEEKDAYS.indexOf(String(series.weekday).toLowerCase());
  if (day < 0 || !series.first_date || !series.last_date) return;
  const skip = new Set([...closures.map(c => c.date), ...(series.skip_dates || [])]);
  const slots = [];
  let d = series.first_date;
  while (keyToDate(d).getUTCDay() !== day) d = addDays(d, 1);
  for (let guard = 0; d <= series.last_date && guard < 40; d = addDays(d, 7), guard++) if (!skip.has(d)) slots.push(d);
  const base = String(series.title).replace(/\s*\d+\s*$/, '').trim() || 'Item';
  const taken = new Set([...dated.map(g => g.id), ...(usedIds || [])]);
  slots.forEach((date, i) => {
    const title = `${base} ${i + 1}`;
    const time = series.time || classStart(classInfo, date);
    const u = undated.find(x => !taken.has(x.id) && sameItem(x.rawTitle || x.title, title));
    if (u) {
      taken.add(u.id);
      usedIds?.add(u.id);
      dated.push({ id: u.id, date, time, evidence: series.evidence, recurring: true });
      return;
    }
    if (!createNew) return;
    if (items.some(x => sameItem(x.rawTitle || x.title, title))) return; // Canvas already has it
    if (extra.some(x => sameItem(x.title, title))) return;
    extra.push({ title, kind: series.kind || kindOf(title), date, time, evidence: series.evidence, recurring: true });
  });
}
const kindOf = title => classify(title);

// Main entry. sources: [{ name, text }]; items: Canvas items with dates;
// undated: Canvas items without dates; classInfo: MyU rows for the course;
// closures: [{ date }] no-class days; term: { start, end } for years/ranges.
export function extractRules({ sources, items = [], undated = [], classInfo = null, closures = [], term }) {
  const allLines = sources.flatMap(s => toLines(s.text));
  const hits = sources.flatMap(s => scanLines(toLines(s.text), term));
  const dueTime = defaultDueTime(allLines);

  const dated = [];
  const usedIds = new Set();
  const extra = [];
  const keep = [];
  // Earliest mention wins for each item title (schedules repeat items).
  for (const h of hits) {
    if (keep.some(k => sameItem(k.title, h.title))) continue;
    keep.push(h);
  }

  for (const h of keep) {
    const inClass = /\bin[- ]class\b|\b(beginning|start) of (the )?(class|lecture)|during (our |the )?(regular |normal )?(class|lecture)/i;
    const time = h.time || (inClass.test(h.line) ? classStart(classInfo, h.date) : '')
      || (h.kind === 'assignment' ? dueTime : '') || '';
    const match = undated.find(u => !usedIds.has(u.id) && sameItem(u.rawTitle || u.title, h.title));
    if (match) {
      usedIds.add(match.id);
      dated.push({ id: match.id, date: h.date, time, evidence: h.evidence });
      continue;
    }
    // Already on Canvas (same item within a few days)? Then it's not new.
    const near = d => Math.abs(keyToDate(d.date) - keyToDate(h.date)) <= 3 * 864e5;
    if (items.some(d => near(d) && sameItem(d.rawTitle || d.title, h.title))) continue;
    extra.push({ title: h.title, kind: h.kind || kindOf(h.title), date: h.date, time, evidence: h.evidence });
  }

  // Weekly rules become a series ("Quiz 1, Quiz 2, …" every lab day). Only
  // clear quiz rules create new items; other rules just date Canvas items.
  for (const rule of weeklyRules(allLines)) {
    const slot = ruleWeekday(rule, classInfo);
    if (!slot) continue;
    const firstDay = classInfo?.rows?.[0]?.startDate || term.start;
    let first = firstDay;
    while (keyToDate(first).getUTCDay() !== slot.day) first = addDays(first, 1);
    if (rule.skipFirstWeek) first = addDays(first, 7);
    expandRecurring({
      title: rule.kind === 'quiz' ? 'Quiz' : 'HW', kind: rule.kind, weekday: slot.day,
      first_date: first, last_date: classInfo?.rows?.[0]?.endDate || term.end,
      time: '', evidence: `Weekly rule: ${rule.evidence}`,
    }, { undated, items, classInfo, closures, dated, extra, usedIds, createNew: rule.kind === 'quiz' && rule.certain });
  }

  // "The two midterm exams … October 9th" next to "Midterm 1 … October 9th":
  // an unnumbered mention on the same day as a numbered item is the same thing.
  const base = t => String(t).toLowerCase().replace(/\d+/g, '').replace(/\s+/g, ' ').trim();
  const titleOf = g => undated.find(u => u.id === g.id)?.title || '';
  const numberedDays = [...dated.map(g => ({ title: titleOf(g), date: g.date })), ...extra, ...items.map(d => ({ title: d.title, date: d.date }))]
    .filter(x => numberOf(x.title));
  const finalExtra = extra.filter(x => numberOf(x.title)
    || !numberedDays.some(n => base(n.title).startsWith(base(x.title).split(' ')[0]) && Math.abs(keyToDate(n.date) - keyToDate(x.date)) <= 864e5));

  return { kinds: {}, titles: {}, dated, extra: finalExtra, by: 'rules', version: EXTRACT_VERSION };
}
