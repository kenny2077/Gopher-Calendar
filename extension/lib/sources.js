// Which syllabus/schedule sources get read, decided in two steps:
//   1. triage – pick at most 3 per course and mark duplicates, from names,
//      types, sizes and dates only (no file content leaves the browser);
//   2. approval – the student confirms the picks once. Approvals are
//      remembered per source until the file changes.

import { callModel } from './polish.js';

export const MAX_PER_COURSE = 3;
const KB = 1024;

export const sourceKey = (course, id) => `${course}|${id}`;
export const fingerprint = c => `${c.size || 0}|${c.updatedAt || ''}`;

// All candidates as a flat list with their keys.
export function listCandidates(canvas) {
  const out = [];
  for (const [course, s] of Object.entries(canvas?.sources || {})) {
    for (const c of s.candidates) out.push({ ...c, course, canvasId: s.canvasId, key: sourceKey(course, c.id) });
  }
  return out;
}

// "Syllabus (2).pdf", "syllabus.PDF" and "Syllabus" name the same document.
const baseName = name => String(name || '').toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/\s*\(\d+\)\s*$/, '').replace(/[^a-z0-9]+/g, ' ').trim();

// Rule-based triage, used without a key or when the AI call fails.
export function ruleTriage(canvas) {
  const picks = {}, dupes = {};
  for (const [course, s] of Object.entries(canvas?.sources || {})) {
    const readable = s.candidates.filter(c => c.readable);
    // Same-looking files: keep the newest.
    // Same-looking files ("Syllabus.pdf" vs "Math_4242_Syllabus (2).pdf"):
    // one name's words all appear in the other. Keep the newest.
    const kept = [];
    const words = c => new Set(baseName(c.name).split(' ').filter(Boolean));
    const sameDoc = (a, b) => { const A = words(a), B = words(b); const [x, y] = A.size <= B.size ? [A, B] : [B, A]; return x.size > 0 && [...x].every(w => y.has(w)); };
    for (const c of readable.filter(x => x.kind === 'file')) {
      const i = kept.findIndex(k => sameDoc(k, c));
      if (i < 0) { kept.push(c); continue; }
      const [keep, drop] = (c.updatedAt || '') > (kept[i].updatedAt || '') ? [c, kept[i]] : [kept[i], c];
      kept[i] = keep;
      dupes[sourceKey(course, drop.id)] = sourceKey(course, keep.id);
    }
    // A short Syllabus tab that only links a PDF adds nothing.
    const syl = readable.find(c => c.kind === 'syllabus');
    const linkedPdf = readable.find(c => c.kind === 'file' && c.foundIn.includes('linked from Syllabus tab'));
    if (syl && linkedPdf && (s.syllabusText || '').length < 600) dupes[sourceKey(course, syl.id)] = sourceKey(course, linkedPdf.id);

    const score = c => (/schedule|calendar|timeline|dates/i.test(c.name) ? 3 : 0)
      + (c.dates >= 8 ? 3 : c.dates >= 3 ? 1 : 0)
      + (c.kind === 'syllabus' ? 2.5 : /syllab/i.test(c.name) ? 2 : 0)
      + (c.foundIn.includes('linked from Syllabus tab') ? 1 : 0);
    readable
      .filter(c => !dupes[sourceKey(course, c.id)])
      .sort((a, b) => score(b) - score(a))
      .slice(0, MAX_PER_COURSE)
      .forEach(c => {
        picks[sourceKey(course, c.id)] = c.foundIn.includes('Home page') ? `Course home page with ${c.dates} dates`
          : c.kind === 'syllabus' ? 'The course syllabus in Canvas'
          : /schedule|calendar|timeline|dates/i.test(c.name) ? 'Name suggests a schedule' : 'Looks like the syllabus';
      });
  }
  return { picks, dupes, by: 'rules' };
}

const TRIAGE_SYSTEM = `You help a university student's calendar decide which course files to read for due dates.
You only see names, types, sizes and dates of files and pages, never their content.
Return JSON only: {"picks":[{"key":"<key>","reason":"<max 10 words>"}],"duplicates":[{"key":"<key>","same_as":"<key>"}]}
Rules:
- At most ${MAX_PER_COURSE} picks per course. Prefer the syllabus and anything named like a schedule, calendar or course outline.
- Skip lecture slides, readings, handouts, solutions and anything unrelated to dates.
- When two entries are the same document (a copy with "(2)", an older version, or a short Syllabus tab that only links a PDF), pick the newer or fuller one and list the other in duplicates.
- Courses with many undated items need the most help; always pick something for them if anything is readable.
- "dates" is how many dates a page's text mentions. A Home page or page with many dates is usually the week-by-week schedule; pick it.
- Only use keys from the input. Never pick entries with readable:false.`;

const TRIAGE_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['picks', 'duplicates'],
  properties: {
    picks: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['key', 'reason'], properties: { key: { type: 'string' }, reason: { type: 'string' } } } },
    duplicates: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['key', 'same_as'], properties: { key: { type: 'string' }, same_as: { type: 'string' } } } },
  },
};

export async function aiTriage(ai, canvas) {
  const all = listCandidates(canvas);
  if (!all.length) return { picks: {}, dupes: {}, by: 'ai' };
  const undated = {};
  for (const u of canvas.undated || []) undated[u.course] = (undated[u.course] || 0) + 1;
  const courses = Object.keys(canvas.sources).map(course => ({
    course,
    undated_items: undated[course] || 0,
    syllabus_tab_chars: canvas.sources[course].syllabusText.length,
    candidates: all.filter(c => c.course === course).map(c => ({
      key: c.key, name: c.name, kind: c.kind, type: c.type,
      size_kb: c.kind === 'file' && c.size ? Math.round(c.size / KB) : null, dates: c.dates ?? null, updated: c.updatedAt || null,
      found_in: c.foundIn, readable: c.readable,
    })),
  }));
  const raw = JSON.parse(await callModel(ai, { system: TRIAGE_SYSTEM, text: JSON.stringify({ courses }), schema: TRIAGE_SCHEMA }) || '{}');
  return validateTriage(raw, all);
}

export function validateTriage(raw, all) {
  const byKey = new Map(all.map(c => [c.key, c]));
  const picks = {}, dupes = {}, perCourse = {};
  for (const d of raw.duplicates || []) {
    if (byKey.has(d.key) && byKey.has(d.same_as) && d.key !== d.same_as) dupes[d.key] = d.same_as;
  }
  for (const p of raw.picks || []) {
    const c = byKey.get(p.key);
    if (!c || !c.readable || dupes[p.key]) continue;
    if ((perCourse[c.course] = (perCourse[c.course] || 0) + 1) > MAX_PER_COURSE) continue;
    picks[p.key] = String(p.reason || '').slice(0, 80) || 'Likely has dates';
  }
  return { picks, dupes, by: 'ai' };
}

// Picks the student has not answered yet, or whose file changed since.
export function pendingPicks(canvas, triage, approvals = {}) {
  if (!triage) return [];
  return listCandidates(canvas).filter(c => triage.picks[c.key] && approvals[c.key]?.fp !== fingerprint(c));
}

export function approvedFor(canvas, approvals = {}, course) {
  return listCandidates(canvas).filter(c => c.course === course && c.readable
    && approvals[c.key]?.ok && approvals[c.key].fp === fingerprint(c));
}

// Two titles name the same item when their numbers match and most words overlap.
export function sameItem(a, b) {
  const norm = t => String(t || '').toLowerCase().replace(/homework/g, 'hw')
    .replace(/([a-z])(\d)/g, '$1 $2').replace(/[^a-z0-9]+/g, ' ').trim();
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  // Numbers must agree ("Quiz 2" is not "Quiz 3"), but extra numbers in a
  // longer title are fine ("A3" is "A3: 3D Visualization").
  const nums = t => t.split(' ').filter(w => /^\d+$/.test(w));
  const [nx, ny] = [nums(x), nums(y)];
  const [small, big] = nx.length <= ny.length ? [nx, ny] : [ny, nx];
  if (!small.every(n => big.includes(n)) || (!small.length && big.length)) return false;
  const A = new Set(x.split(' ')), B = new Set(y.split(' '));
  const inter = [...A].filter(w => B.has(w)).length;
  return inter / Math.min(A.size, B.size) >= 0.8 || inter / new Set([...A, ...B]).size >= 0.5;
}
