import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from 'linkedom';
import { collectCanvas } from '../extension/lib/canvas-collect.js';
import { collectMyU } from '../extension/lib/myu-collect.js';
import { normalizeCanvas, normalizeMyU } from '../extension/lib/normalize.js';
import { buildModel, scheduleWeek, loadLevel, deadlinesIn } from '../extension/lib/model.js';
import { buildIcs } from '../extension/lib/ics.js';
import { validate } from '../extension/lib/polish.js';
import { classify, cleanTitle } from '../extension/lib/classify.js';
import { dateKey, timeLabel, mondayOf } from '../extension/lib/time.js';
import { canvasRoutes } from './fixtures/canvas.js';
import { weekHtml, emptyWeekHtml, detailHtml } from './fixtures/myu.js';

globalThis.DOMParser = DOMParser;
globalThis.location = { origin: 'https://canvas.umn.edu' };

async function fixtures() {
  globalThis.fetch = async url => canvasRoutes(String(url));
  const canvasRaw = await collectCanvas({ gapMs: 0, now: '2026-09-26T17:00:00Z' });
  globalThis.fetch = async url => {
    url = String(url);
    const eff = url.match(/effdt=(\d{4})-(\d{2})-(\d{2})/);
    const body = eff
      ? (eff.slice(1).join('') < '20260907' || eff.slice(1).join('') > '20261214'
        ? emptyWeekHtml
        : weekHtml(eff.slice(1).join(''), { skipDays: eff.slice(1).join('') === '20261123' ? [3, 4] : [] }))
      : detailHtml(url.match(/CLASS_NBR=(\d+)/)[1]);
    return { ok: true, status: 200, url: 'https://www.myu.umn.edu/x', text: async () => body };
  };
  const myuRaw = await collectMyU({ gapMs: 0, today: '2026-09-26' });
  return { canvas: normalizeCanvas(canvasRaw), myu: normalizeMyU(myuRaw) };
}

test('time: UTC due dates land on the Chicago day', () => {
  assert.equal(dateKey('2026-10-08T04:59:59Z'), '2026-10-07');
  assert.equal(timeLabel('2026-10-08T04:59:59Z'), '11:59pm');
  assert.equal(timeLabel('2026-09-28T19:00:00Z'), '2:00pm');
  assert.equal(mondayOf('2026-09-26'), '2026-09-21');
});

test('classify + clean titles', () => {
  assert.equal(classify('Participation "Introduction"'), 'participation');
  assert.equal(classify('Midterm 1'), 'exam');
  assert.equal(classify('Quiz 3'), 'quiz');
  assert.equal(classify('FP4: Final Deliverables'), 'project');
  assert.equal(classify('Brush: Program'), 'assignment');
  assert.equal(cleanTitle('Participation "LLMs and Agents"'), 'Participation — LLMs and Agents');
  assert.equal(cleanTitle('Brush: Program'), 'Brush — Program');
});

test('normalize: drops announcements and class sessions, keeps status', async () => {
  const { canvas } = await fixtures();
  assert.deepEqual(canvas.courses.map(c => c.code), ['CSCI 4821', 'MATH 4242']);
  assert.equal(canvas.courses[1].name, 'Applied Linear Algebra');
  const titles = canvas.deadlines.map(d => d.title);
  assert.ok(!titles.some(t => /Class|Office hours/.test(t)));
  const intro = canvas.deadlines.find(d => d.title === 'Participation — Introduction');
  assert.deepEqual([intro.kind, intro.status, intro.date, intro.time], ['participation', 'done', '2026-09-10', '11:15am']);
  const setup = canvas.deadlines.find(d => /Set Up/.test(d.title));
  assert.deepEqual([setup.date, setup.time, setup.status], ['2026-10-07', '11:59pm', 'submitted']);
  // Dated assignment missing from the planner is still included.
  assert.ok(canvas.deadlines.some(d => d.course === 'MATH 4242' && d.title === 'Quiz 1'));
  assert.deepEqual(canvas.undated.map(u => u.title), ['HW 1', 'Midterm 1']);
  assert.equal(canvas.term.start, '2026-08-10');
});

test('model: weeks follow MyU dates, polish fills undated items', async () => {
  const { canvas, myu } = await fixtures();
  const polish = {
    'MATH 4242': {
      result: {
        kinds: {}, titles: {},
        dated: [{ id: 'canvas:assignment:1', date: '2026-09-14', time: '9:05am', evidence: 'due every Monday' }],
        extra: [{ title: 'Quiz 2', kind: 'quiz', date: '2026-09-24', time: '9:05am', evidence: 'Thursday quiz' }],
      },
    },
  };
  const m = buildModel({ canvas, myu, polish });
  assert.equal(m.weeks[0], '2026-09-07');
  assert.equal(m.weeks.at(-1), '2026-12-14');
  const hw1 = m.deadlines.find(d => d.id === 'canvas:assignment:1');
  assert.deepEqual([hw1.source, hw1.confirmed, hw1.date], ['syllabus', false, '2026-09-14']);
  assert.deepEqual(m.undated.map(u => u.title), ['Midterm 1']);
  assert.ok(m.deadlines.some(d => d.title === 'Quiz 2' && d.source === 'syllabus'));
  assert.ok(loadLevel(deadlinesIn(m, 'MATH 4242', '2026-09-14')) >= 1);
});

test('schedule: Thanksgiving gap shows as cancelled meetings', async () => {
  const { canvas, myu } = await fixtures();
  const m = buildModel({ canvas, myu });
  const wk = scheduleWeek(m, '2026-11-23');
  assert.ok(wk.cancelled.some(c => c.course === 'MATH 4242' && c.date === '2026-11-26'));
  assert.equal(wk.extra.length, 0);
  const normal = scheduleWeek(m, '2026-09-28');
  assert.equal(normal.cancelled.length, 0);
  assert.equal(normal.meetings.length, 8);
});

test('ics: valid calendar with Chicago times and folded lines', async () => {
  const { canvas, myu } = await fixtures();
  const ics = buildIcs(buildModel({ canvas, myu }), { stamp: new Date('2026-09-26T00:00:00Z') });
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /END:VCALENDAR\r\n$/);
  assert.match(ics, /DTSTART;TZID=America\/Chicago:20260928T090500/);
  assert.match(ics, /DTEND;TZID=America\/Chicago:20261007T235900/);
  assert.ok(ics.split('\r\n').every(l => new TextEncoder().encode(l).length <= 75));
  assert.equal(ics.match(/BEGIN:VEVENT/g).length, ics.match(/END:VEVENT/g).length);
});

test('polish validation drops invented ids and out-of-term dates', () => {
  const term = { start: '2026-09-08', end: '2026-12-23' };
  const items = [{ id: 'a', title: 'HW 1', date: '2026-09-14' }];
  const undated = [{ id: 'u1', title: 'HW 2' }];
  const out = validate({
    kinds: { a: 'quiz', ghost: 'exam', u1: 'banana' },
    titles: { a: 'Homework 1' },
    dated: [{ id: 'u1', date: '2026-09-21', time: '9:05am' }, { id: 'u1', date: '2027-03-01' }, { id: 'zzz', date: '2026-09-21' }],
    extra: [{ title: 'HW 1', date: '2026-09-14' }, { title: 'Quiz 1', kind: 'quiz', date: '2026-09-17', time: 'soon' }],
  }, { term, items, undated });
  assert.deepEqual(out.kinds, { a: 'quiz' });
  assert.deepEqual(out.dated, [{ id: 'u1', date: '2026-09-21', time: '9:05am', evidence: '' }]);
  assert.deepEqual(out.extra.map(x => [x.title, x.time]), [['Quiz 1', '']]);
});

test('Azure provider: Responses API request shape and output parsing', async () => {
  const { callModel } = await import('../extension/lib/polish.js');
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    if (calls.length === 1) return { ok: false, status: 400, clone: () => ({ text: async () => 'Unsupported parameter: reasoning.effort' }) };
    return {
      ok: true, status: 200,
      json: async () => ({ output: [{ type: 'reasoning' }, { type: 'message', content: [{ type: 'output_text', text: '{"dated":[]}' }] }] }),
    };
  };
  const out = await callModel(
    { provider: 'azure', endpoint: 'https://r.services.ai.azure.com/openai/v1/responses', deployment: 'gpt-6-luna', apiKey: 'k' },
    { system: 'Return JSON.', text: 'hello', images: ['data:image/jpeg;base64,AAA'] },
  );
  assert.equal(out, '{"dated":[]}');
  assert.equal(calls[0].url, 'https://r.services.ai.azure.com/openai/v1/responses');
  assert.equal(calls[0].body.text.format.type, 'json_schema');
  assert.equal(calls[0].init.headers['api-key'], 'k');
  assert.equal(calls[0].body.model, 'gpt-6-luna');
  assert.deepEqual(calls[0].body.input[0].content.map(c => c.type), ['input_text', 'input_image']);
  assert.ok(calls[0].body.reasoning && !calls[1].body.reasoning, 'retried without reasoning after a 400 about it');
});

test('holidays: academic calendar closures drop MyU meetings and label the day', async () => {
  const { closuresFrom } = await import('../extension/lib/closures.js');
  const feed = { dates: [
    { campus: 'Twin Cities', date: '2026-11-26', categories: ['University closed', 'No classes'], description: 'University closed (Thanksgiving)' },
    { campus: 'Twin Cities', date: '2026-11-27', categories: ['University closed', 'No classes'], description: 'University closed' },
    { campus: 'Duluth', date: '2026-11-25', categories: ['No classes'], description: 'Duluth only' },
    { campus: 'Twin Cities', date: '2026-10-01', categories: ['Registration'], description: 'Not a closure' },
  ] };
  const closures = closuresFrom(feed, { institution: 'UMNTC', start: '2026-09-08', end: '2026-12-26' });
  assert.deepEqual(closures.map(c => c.date), ['2026-11-26', '2026-11-27']);

  // MyU lists every meeting that week (as the real site does); closures remove Thu/Fri.
  globalThis.fetch = async url => {
    url = String(url);
    const eff = url.match(/effdt=(\d{4})-(\d{2})-(\d{2})/);
    const k = eff && eff.slice(1).join('');
    const body = eff ? (k < '20260907' || k > '20261214' ? emptyWeekHtml : weekHtml(k)) : detailHtml(url.match(/CLASS_NBR=(\d+)/)[1]);
    return { ok: true, status: 200, url: 'https://www.myu.umn.edu/x', text: async () => body };
  };
  const raw = await collectMyU({ gapMs: 0, today: '2026-09-26' });
  const myu = normalizeMyU({ ...raw, closures });
  assert.ok(!myu.meetings.some(m => m.date === '2026-11-26' || m.date === '2026-11-27'));
  const m = buildModel({ myu });
  const wk = scheduleWeek(m, '2026-11-23');
  assert.deepEqual(wk.closures.map(c => c.label), ['University closed (Thanksgiving)', 'University closed']);
  assert.equal(wk.cancelled.length, 0, 'closed days are not reported as cancelled classes');
});

test('AI recurring events are expanded by code into real class days', async () => {
  const { polishCourse } = await import('../extension/lib/polish.js');
  globalThis.fetch = async () => ({
    ok: true, status: 200,
    json: async () => ({ output_text: JSON.stringify({
      kinds: [], titles: [], dated: [], extra: [],
      recurring: [{ title: 'Quiz', kind: 'quiz', weekday: 'Thursday', time: '', first_date: '2026-09-17', last_date: '2026-12-10', skip_dates: ['2026-10-29'], evidence: 'each lab begins with a quiz' }],
    }) }),
  });
  const cls = { rows: [{ days: [4], start: '09:05', end: '09:55', startDate: '2026-09-08', endDate: '2026-12-16' }] };
  const r = await polishCourse({
    ai: { provider: 'azure', endpoint: 'https://r.services.ai.azure.com', deployment: 'd', apiKey: 'k' },
    course: 'MATH 4242', term: { start: '2026-09-08', end: '2026-12-26' }, pattern: 'Thu 9:05am',
    items: [{ id: 'c1', title: 'Quiz 1', date: '2026-09-17' }],
    undated: [{ id: 'u2', title: 'Quiz 2' }],
    syllabusText: 'x', classInfo: cls, closures: [{ date: '2026-11-26' }],
  });
  assert.deepEqual(r.dated.map(d => [d.id, d.date, d.time]), [['u2', '2026-09-24', '9:05am']]);
  const dates = r.extra.map(x => x.date);
  assert.ok(!dates.includes('2026-09-17'), 'Quiz 1 already on Canvas');
  assert.ok(!dates.includes('2026-10-29') && !dates.includes('2026-11-26'), 'skip date and holiday removed');
  assert.equal(r.extra[0].title, 'Quiz 3');
  assert.ok(r.extra.every(x => x.recurring));
});

test('providers: OpenAI and Anthropic request shapes', async () => {
  const { callModel, RESULT_SCHEMA, PROVIDERS, aiConfig } = await import('../extension/lib/polish.js');
  assert.equal(PROVIDERS.openai.defaultModel, 'gpt-6-luna');
  assert.equal(PROVIDERS.anthropic.defaultModel, 'claude-sonnet-5');
  assert.equal(aiConfig({ provider: 'anthropic', anthropic: { apiKey: 'k' } }).model, 'claude-sonnet-5');
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, headers: init.headers, body: JSON.parse(init.body) });
    return url.includes('openai')
      ? { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '{"a":1}' } }] }) }
      : { ok: true, status: 200, json: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{"b":2}' }] }) };
  };
  const img = 'data:image/jpeg;base64,AAAA';
  assert.equal(await callModel({ provider: 'openai', model: 'm', apiKey: 'k' }, { system: 's', text: 't', images: [img] }), '{"a":1}');
  assert.equal(calls[0].url, 'https://api.openai.com/v1/chat/completions');
  assert.equal(calls[0].headers.Authorization, 'Bearer k');
  assert.equal(calls[0].body.response_format.type, 'json_schema');
  assert.equal(calls[0].body.response_format.json_schema.strict, true);
  assert.equal(calls[0].body.messages[1].content[1].type, 'image_url');

  assert.equal(await callModel({ provider: 'anthropic', model: 'claude-opus-5', apiKey: 'k' }, { system: 's', text: 't', images: [img] }), '{"b":2}');
  const a = calls[1];
  assert.equal(a.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(a.headers['x-api-key'], 'k');
  assert.equal(a.headers['anthropic-version'], '2023-06-01');
  assert.equal(a.headers['anthropic-dangerous-direct-browser-access'], 'true');
  assert.deepEqual(a.body.output_config.format, { type: 'json_schema', schema: RESULT_SCHEMA });
  assert.equal(a.body.fallbacks, 'default', 'Opus 5 gets server-side fallbacks');
  await callModel({ provider: 'anthropic', model: 'claude-sonnet-5', apiKey: 'k' }, { system: 's', text: 't' });
  assert.equal(calls[2].body.model, 'claude-sonnet-5');
  assert.equal(calls[2].body.fallbacks, undefined, 'no fallbacks field for Sonnet 5');
  assert.deepEqual(a.body.messages[0].content[0], { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA' } });
});

test('graded quizzes and discussions are not listed twice', async () => {
  const raw = {
    origin: 'https://canvas.umn.edu', fetchedAt: '2026-09-26T00:00:00Z',
    term: { name: '2026 Fall', start: '2026-08-11T04:59:00Z', end: '2027-01-07T04:59:00Z' },
    courses: [{ id: 1, course_code: 'CSCI 1000 (001)', name: 'CSCI 1000 (001) Test' }],
    planner: [
      { plannable_type: 'quiz', plannable_id: 77, course_id: 1, plannable: { title: 'Quiz 1', due_at: '2026-10-01T15:00:00Z', assignment_id: 500 } },
      { plannable_type: 'discussion_topic', plannable_id: 88, course_id: 1, plannable: { title: 'Forum 1', todo_date: '2026-10-02T15:00:00Z' } },
    ],
    assignments: { 1: [
      { id: 500, name: 'Quiz 1', due_at: '2026-10-01T15:00:00Z', quiz_id: 77, published: true },
      { id: 501, name: 'Forum 1', due_at: '2026-10-02T15:00:00Z', discussion_topic_id: 88, published: true },
    ] },
    sources: {},
  };
  const c = normalizeCanvas(raw);
  assert.deepEqual(c.deadlines.map(d => d.title).sort(), ['Forum 1', 'Quiz 1']);
});

test('ics: all-day Canvas items export as all-day events', () => {
  const ics = buildIcs({ termName: 'Fall 2026', meetings: [], deadlines: [
    { id: 'a', kind: 'milestone', course: 'X 1', title: 'Reading day', date: '2026-10-05', time: '', dueAt: '2026-10-05T05:00:00Z' },
  ] });
  assert.match(ics, /DTSTART;VALUE=DATE:20261005/);
});
