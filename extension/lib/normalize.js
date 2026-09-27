// Turns raw collector output into the app's own model. Pure functions only,
// so they run in the service worker and in tests.
//
// Deadline  { id, source, kind, course, title, rawTitle, date, time, dueAt,
//             points, status, done, url, confirmed, note }
// ClassInfo { classNbr, course, section, title, component, rows[] }
// Meeting   { id, classNbr, course, section, title, component, date, start, end, room }

import { classify, cleanTitle, isSessionEvent } from './classify.js';
import { dateKey, timeLabel } from './time.js';

export function courseCodeOf(text) {
  const m = String(text || '').match(/\b([A-Z]{2,6})\s?(\d{4}[A-Z]?)\b/);
  return m ? `${m[1]} ${m[2]}` : null;
}

function sectionOf(text) {
  const m = String(text || '').match(/\(([^)]+)\)/);
  return m ? m[1] : '';
}

function statusOf(sub, done) {
  if (done) return 'done';
  if (!sub) return 'todo';
  if (sub.excused) return 'done';
  if (sub.graded) return 'graded';
  if (sub.submitted) return 'submitted';
  if (sub.missing) return 'missing';
  return 'todo';
}

export function normalizeCanvas(raw) {
  const courses = raw.courses
    .map(c => ({
      canvasId: c.id,
      code: courseCodeOf(c.course_code) || courseCodeOf(c.name) || c.course_code,
      section: sectionOf(c.course_code),
      name: String(c.name || '').replace(/^[A-Z]{2,6}\s?\d{4}[A-Z]?\s*(\([^)]*\))?\s*/, '').replace(/\s*\((Fall|Spring|Summer)[^)]*\)\s*$/i, ''),
    }))
    .sort((a, b) => a.code.localeCompare(b.code));
  const byId = new Map(courses.map(c => [c.canvasId, c]));

  const deadlines = [];
  const seen = new Set();

  for (const item of raw.planner) {
    const course = byId.get(item.course_id);
    const p = item.plannable || {};
    if (!course || !p.title) continue;
    const type = item.plannable_type;
    if (type === 'announcement' || type === 'planner_note') continue;
    if (type === 'calendar_event' && isSessionEvent(p.title)) continue;

    const when = p.due_at || p.todo_date || (type === 'calendar_event' ? p.start_at : null) || item.plannable_date;
    if (!when) continue;
    const kind = type === 'calendar_event' ? (classify(p.title) === 'assignment' ? 'milestone' : classify(p.title)) : classify(p.title, type);
    const id = `canvas:${type}:${item.plannable_id}`;
    seen.add(`${type}:${item.plannable_id}`);
    // Graded quizzes and discussions are also assignments with their own id.
    if (p.assignment_id) seen.add(`assignment:${p.assignment_id}`);
    deadlines.push({
      id, source: 'canvas', kind, course: course.code,
      title: cleanTitle(p.title, course.code), rawTitle: p.title,
      date: dateKey(when), time: p.all_day ? '' : timeLabel(when), dueAt: when,
      points: p.points_possible ?? null,
      status: statusOf(item.submissions, item.marked_complete),
      done: !!item.marked_complete,
      url: item.html_url ? raw.origin + item.html_url : null,
      confirmed: true,
    });
  }

  const undated = [];
  for (const [cid, list] of Object.entries(raw.assignments || {})) {
    const course = byId.get(Number(cid)) || byId.get(cid);
    if (!course) continue;
    for (const a of list) {
      if (a.published === false) continue;
      const kind = classify(a.name, a.is_quiz_assignment ? 'quiz' : 'assignment');
      if (!a.due_at) {
        undated.push({
          id: `canvas:assignment:${a.id}`, course: course.code, kind,
          title: cleanTitle(a.name, course.code), rawTitle: a.name, points: a.points_possible ?? null,
          url: a.html_url || null,
        });
      } else if (!seen.has(`assignment:${a.id}`)
        && !(a.quiz_id && seen.has(`quiz:${a.quiz_id}`))
        && !(a.discussion_topic_id && seen.has(`discussion_topic:${a.discussion_topic_id}`))) {
        seen.add(`assignment:${a.id}`);
        deadlines.push({
          id: `canvas:assignment:${a.id}`, source: 'canvas', kind, course: course.code,
          title: cleanTitle(a.name, course.code), rawTitle: a.name,
          date: dateKey(a.due_at), time: timeLabel(a.due_at), dueAt: a.due_at,
          points: a.points_possible ?? null, status: 'todo', done: false,
          url: a.html_url || null, confirmed: true,
        });
      }
    }
  }

  // Syllabus text and candidate files/pages per course, found by name only.
  // Nothing here has been sent anywhere; the student approves what gets read.
  const sources = {};
  for (const c of courses) {
    const s = raw.sources?.[c.canvasId];
    if (s) sources[c.code] = { canvasId: c.canvasId, syllabusText: s.syllabusText || '', candidates: s.candidates || [] };
  }

  deadlines.sort((a, b) => (a.dueAt || a.date).localeCompare(b.dueAt || b.date));
  return {
    fetchedAt: raw.fetchedAt,
    term: { name: raw.term.name, start: dateKey(raw.term.start), end: dateKey(raw.term.end) },
    courses, deadlines, undated, sources,
  };
}

export function normalizeMyU(raw) {
  const classes = raw.classes.map(c => ({
    classNbr: c.classNbr, course: c.code, section: c.section, title: c.title,
    component: c.component, rows: c.rows,
  })).sort((a, b) => a.course.localeCompare(b.course));

  // MyU still lists meetings on holidays; drop them.
  const closures = raw.closures || [];
  const closed = new Set(closures.map(c => c.date));
  const seen = new Set();
  const meetings = [];
  for (const m of raw.meetings) {
    const id = `myu:${m.classNbr}:${m.date}:${m.start}`;
    if (seen.has(id) || closed.has(m.date)) continue;
    seen.add(id);
    meetings.push({
      id, classNbr: m.classNbr, course: m.code, section: m.section, title: m.title,
      component: m.component, date: m.date, start: m.start, end: m.end, room: m.room,
    });
  }
  meetings.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  return { fetchedAt: raw.fetchedAt, strm: raw.strm, range: raw.range, classes, meetings, closures };
}
