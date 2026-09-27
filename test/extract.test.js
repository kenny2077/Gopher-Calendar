import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractRules, findDates, findItems } from '../extension/lib/extract.js';

const term = { start: '2026-09-08', end: '2026-12-26' };
const mathClass = {
  course: 'MATH 4242',
  rows: [
    { days: [1, 3, 5], start: '09:05', end: '09:55', startDate: '2026-09-08', endDate: '2026-12-16' },
    { days: [4], start: '09:05', end: '09:55', startDate: '2026-09-08', endDate: '2026-12-16' },
  ],
};
const u = (id, title) => ({ id, title, rawTitle: title, course: 'MATH 4242' });

test('dates: month names, slashes, ordinals, years from the term', () => {
  const keys = l => findDates(l, term).map(d => d.key);
  assert.deepEqual(keys('HW 1 hard copy due Monday 9/14 in class.'), ['2026-09-14']);
  assert.deepEqual(keys('Final exam Saturday, December 19th, 10:30AM-12:30PM.'), ['2026-12-19']);
  assert.deepEqual(keys('Wed, Sept. 9 | Mechanics'), ['2026-09-09']);
  assert.deepEqual(keys('Room 3/115 and 9/31'), [], 'room numbers and impossible dates are ignored');
});

test('items: numbered work, exams, project milestones', () => {
  const titles = l => findItems(l).map(i => i.title);
  assert.deepEqual(titles('Hw0 due (Tues, Sep 15)'), ['HW 0']);
  assert.deepEqual(titles('Midterm 1 Friday 10/9 in class'), ['Midterm 1']);
  assert.deepEqual(titles('FP1: Project Proposal due'), ['FP1']);
  assert.deepEqual(titles('Final exam Saturday'), ['Final Exam']);
});

test('MATH 4242 style: explicit HW dates, exams, and the weekly quiz rule', () => {
  const text = [
    'Homework: HW 1 hard copy due Monday 9/14 in class.',
    'HW 2 hard copy due Monday 9/21 at the beginning of class.',
    'Midterm 1 Friday 10/9 in class. Midterm 2 Friday 11/13 in class.',
    'Final exam Saturday, December 19th, 10:30AM-12:30PM.',
    'Each lab session except the first week begins with a short quiz.',
  ].join('\n');
  const undated = [u('h1', 'HW 1'), u('h2', 'HW 2'), u('m1', 'Midterm 1'), u('m2', 'Midterm 2'), u('f', 'Final Exam'), u('q1', 'Quiz 1'), u('q2', 'Quiz 2')];
  const r = extractRules({ sources: [{ name: 'syllabus.pdf', text }], undated, classInfo: mathClass, term });
  const by = Object.fromEntries(r.dated.map(d => [d.id, [d.date, d.time]]));
  assert.deepEqual(by.h1, ['2026-09-14', '9:05am']);
  assert.deepEqual(by.h2, ['2026-09-21', '9:05am']);
  assert.deepEqual(by.m1, ['2026-10-09', '9:05am']);
  assert.deepEqual(by.m2, ['2026-11-13', '9:05am']);
  assert.deepEqual(by.f, ['2026-12-19', '10:30am']);
  assert.deepEqual(by.q1, ['2026-09-17', '9:05am'], 'first Thursday lab after week 1');
  assert.deepEqual(by.q2, ['2026-09-24', '9:05am']);
  // The rest of the weekly quizzes are added as a series (Thursdays through Dec 10).
  assert.deepEqual(r.extra.map(x => x.title), ['Quiz 3', 'Quiz 4', 'Quiz 5', 'Quiz 6', 'Quiz 7', 'Quiz 8', 'Quiz 9', 'Quiz 10', 'Quiz 11', 'Quiz 12', 'Quiz 13']);
  assert.ok(r.extra.every(x => x.recurring && x.kind === 'quiz' && new Date(`${x.date}T12:00:00Z`).getUTCDay() === 4));
});

test('CSCI 5521 style schedule: new items, skipping what Canvas has', () => {
  const text = [
    'Homeworks are due at 11:59 PM CDT.',
    'Week 2 Hw0 due (Tues, Sep 15)',
    'Week 4 Quiz 1 Thurs Oct 1',
    'Week 5 Hw1 due (Wed, Oct 7)',
    'Week 7 Hw2 due (Wed, Oct 21)',
    'Week 8 Midterm Thurs Oct 29,',
    'due in 48 hours',
    'Week 9 Lecture: Decision trees',
  ].join('\n');
  const r = extractRules({
    sources: [{ name: 'Schedule.pdf', text }],
    items: [{ title: 'HW1', rawTitle: 'HW1', date: '2026-10-07' }],
    undated: [{ id: 'hw0', title: 'HW0', rawTitle: 'HW0' }],
    term,
  });
  assert.deepEqual(r.dated, [{ id: 'hw0', date: '2026-09-15', time: '11:59pm', evidence: 'Week 2 Hw0 due (Tues, Sep 15)' }]);
  assert.deepEqual(r.extra.map(x => [x.title, x.date, x.time]), [
    ['Quiz 1', '2026-10-01', ''], ['HW 2', '2026-10-21', '11:59pm'], ['Midterm', '2026-10-31', ''],
  ]);
});

test('table rows: a due item takes the date of its row', () => {
  const text = 'Wed, Sept. 9 | Mechanics | Read the syllabus\nMon, Dec. 14 | Final presentations | FP4 slides due 11:59am';
  const r = extractRules({ sources: [{ name: 'Home page', text }], term });
  assert.deepEqual(r.extra.map(x => [x.title, x.date, x.time]), [['FP4', '2026-12-14', '11:59am']]);
});

test('weekly quiz series skips holidays and is not invented from vague mentions', () => {
  const closures = [{ date: '2026-11-26' }];
  const r = extractRules({
    sources: [{ name: 's', text: 'Each lab session, except during the first week of classes, will\nbegin with a short quiz.' }],
    undated: [], classInfo: mathClass, closures, term,
  });
  assert.ok(!r.extra.some(x => x.date === '2026-11-26'), 'Thanksgiving skipped');
  assert.equal(r.extra.length, 12);
  const vague = extractRules({ sources: [{ name: 's', text: 'Quizzes are held each Thursday, and sometimes in class.' }], undated: [], classInfo: mathClass, term });
  assert.equal(vague.extra.length, 0, 'no series without a clear "begins with a quiz" / "weekly quiz"');
});

test('lecture topics that mention an item without a deadline are ignored', () => {
  const r = extractRules({ sources: [{ name: 's', text: 'Oct 5 | Lecture: how to approach HW 3' }], term });
  assert.equal(r.extra.length, 0);
});

test('ordinary words starting like a month are not dates', () => {
  assert.deepEqual(findDates('Project 2 due: submit a separate 2 page report', term), []);
  assert.deepEqual(findDates('decide 3 of the novel 4 junior 1 options', term), []);
  assert.deepEqual(findDates('due September 28 or Sept. 29 or Dec 2', term).map(d => d.key), ['2026-09-28', '2026-09-29', '2026-12-02']);
});
