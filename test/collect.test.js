import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from 'linkedom';
import { collectMyU } from '../extension/lib/myu-collect.js';
import { collectCanvas } from '../extension/lib/canvas-collect.js';
import { weekHtml, emptyWeekHtml, detailHtml } from './fixtures/myu.js';
import { canvasRoutes } from './fixtures/canvas.js';

globalThis.DOMParser = DOMParser;

function mockFetch(handler) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || 'GET' });
    return handler(String(url));
  };
  return calls;
}

const html = (body, url = 'https://www.myu.umn.edu/x') => ({ ok: true, status: 200, url, text: async () => body, headers: new Map() });

test('MyU: reads pattern, fixes overflowed dates, finds holiday gaps', async () => {
  const calls = mockFetch(url => {
    const eff = url.match(/effdt=(\d{4})-(\d{2})-(\d{2})/);
    if (eff) {
      const monday = eff.slice(1).join('');
      if (monday < '20260907' || monday > '20261214') return html(emptyWeekHtml);
      return html(weekHtml(monday, { skipDays: monday === '20261123' ? [3, 4] : [] }));
    }
    const nbr = url.match(/CLASS_NBR=(\d+)/)[1];
    return html(detailHtml(nbr));
  });

  const r = await collectMyU({ gapMs: 0, today: '2026-09-26' });
  assert.equal(r.ok, true, r.message);
  assert.deepEqual(r.range, { start: '2026-09-08', end: '2026-12-16' });
  assert.equal(r.classes.length, 3);

  const math = r.classes.find(c => c.code === 'MATH 4242');
  assert.equal(math.rows.length, 2, 'both MWF and Th rows kept');
  assert.deepEqual(math.rows.map(x => x.days), [[1, 3, 5], [4]]);
  const genaiRow = r.classes.find(c => c.code === 'CSCI 4821').rows[0];
  assert.equal(genaiRow.start, '11:15');
  assert.deepEqual(genaiRow.days, [2, 4], 'Tuesday written as "T" in "-T-Th---"');

  // Week of Sep 28: Thu arrives as 20260931, Fri as 20260932.
  const thu = r.meetings.filter(m => m.date === '2026-10-01');
  assert.ok(thu.length > 0, 'overflowed Thursday normalised to Oct 1');
  assert.ok(!r.meetings.some(m => m.date.endsWith('-31') && m.date.startsWith('2026-09')));
  const genai = r.meetings.find(m => m.code === 'CSCI 4821');
  assert.deepEqual([genai.start, genai.end, genai.room], ['11:15', '12:30', 'Hall C 130']);

  // Every request is a GET, and the scan stays small.
  assert.ok(calls.every(c => c.method === 'GET'));
  assert.ok(calls.length <= 25, `made ${calls.length} requests`);
});

test('MyU: login redirect is reported, not thrown', async () => {
  mockFetch(() => { throw new TypeError('Failed to fetch'); });
  const r = await collectMyU({ gapMs: 0, today: '2026-09-26' });
  assert.deepEqual([r.ok, r.error], [false, 'LOGIN_REQUIRED']);
});

test('Canvas: picks the current term, pages the planner, lists undated work', async () => {
  const calls = mockFetch(canvasRoutes);
  globalThis.location = { origin: 'https://canvas.umn.edu' };
  const r = await collectCanvas({ gapMs: 0, now: '2026-09-26T17:00:00Z' });
  assert.equal(r.ok, true, r.message);
  assert.equal(r.term.name, '2026 Fall (08/10/2026-01/06/2027)');
  assert.deepEqual(r.courses.map(c => c.course_code).sort(), ['CSCI 4821 (001)', 'MATH 4242 (010)']);
  assert.equal(r.planner.length, 4, 'both planner pages read');
  assert.equal(r.assignments[1002].filter(a => !a.due_at).length, 2);
  const math = r.sources[1002];
  assert.match(math.syllabusText, /Homework is due every Monday/);
  const byId = Object.fromEntries(math.candidates.map(c => [c.id, c]));
  assert.deepEqual(byId['file:777'].foundIn, ['linked from Syllabus tab', 'Files']);
  assert.ok(byId['file:778'], 'syllabus copy found in Files by name');
  assert.ok(!byId['file:779'], 'slides are ignored');
  assert.deepEqual(byId['page:course-schedule'].foundIn, ['Modules', 'Pages']);
  assert.equal(byId['link:https://math.umn.edu/4242/schedule'].readable, false);
  // A course that hides its Files tab is skipped, not treated as logged out,
  // and its schedule on the Home page is still found.
  const home = r.sources[1001].candidates;
  assert.deepEqual(home.map(c => [c.id, c.foundIn[0], c.dates]), [['page:csci-4821-fall-2026', 'Home page', 3]]);
  assert.ok(calls.every(c => c.method === 'GET'));
});
