import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from 'linkedom';
import { collectCanvas } from '../extension/lib/canvas-collect.js';
import { normalizeCanvas } from '../extension/lib/normalize.js';
import {
  ruleTriage, validateTriage, listCandidates, pendingPicks, approvedFor, fingerprint, sameItem, MAX_PER_COURSE,
} from '../extension/lib/sources.js';
import { canvasRoutes } from './fixtures/canvas.js';

globalThis.DOMParser = DOMParser;
globalThis.location = { origin: 'https://canvas.umn.edu' };

async function canvas() {
  globalThis.fetch = async url => canvasRoutes(String(url));
  return normalizeCanvas(await collectCanvas({ gapMs: 0, now: '2026-09-26T17:00:00Z' }));
}

test('rule triage keeps the newest syllabus copy and the schedule page', async () => {
  const c = await canvas();
  const t = ruleTriage(c);
  const picked = Object.keys(t.picks).sort();
  assert.ok(picked.includes('MATH 4242|file:778'), 'newer "(2)" copy picked');
  assert.equal(t.dupes['MATH 4242|file:777'], 'MATH 4242|file:778');
  assert.ok(picked.includes('MATH 4242|page:course-schedule'));
  assert.ok(!picked.some(k => k.includes('link:')), 'outside links are never picked');
  assert.ok(picked.filter(k => k.startsWith('MATH')).length <= MAX_PER_COURSE);
});

test('AI triage answers are limited to real, readable keys', async () => {
  const c = await canvas();
  const all = listCandidates(c);
  const t = validateTriage({
    picks: [
      { key: 'MATH 4242|file:778', reason: 'Newest syllabus' },
      { key: 'MATH 4242|link:https://math.umn.edu/4242/schedule', reason: 'website' },
      { key: 'MATH 4242|file:999', reason: 'made up' },
      { key: 'MATH 4242|file:777', reason: 'dup' },
    ],
    duplicates: [{ key: 'MATH 4242|file:777', same_as: 'MATH 4242|file:778' }],
  }, all);
  assert.deepEqual(Object.keys(t.picks), ['MATH 4242|file:778']);
  assert.equal(t.dupes['MATH 4242|file:777'], 'MATH 4242|file:778');
});

test('approvals are remembered until the file changes', async () => {
  const c = await canvas();
  const t = ruleTriage(c);
  assert.ok(pendingPicks(c, t, {}).length > 0);
  const approvals = Object.fromEntries(listCandidates(c).map(x => [x.key, { ok: !!t.picks[x.key], fp: fingerprint(x) }]));
  assert.equal(pendingPicks(c, t, approvals).length, 0);
  assert.deepEqual(approvedFor(c, approvals, 'MATH 4242').map(x => x.id).sort(), Object.keys(t.picks).filter(k => k.startsWith('MATH')).map(k => k.split('|')[1]).sort());
  // The PDF is replaced on Canvas: ask again for that one only.
  c.sources['MATH 4242'].candidates.find(x => x.id === 'file:778').updatedAt = '2026-10-01T00:00:00Z';
  assert.deepEqual(pendingPicks(c, t, approvals).map(x => x.id), ['file:778']);
});

test('duplicate titles', () => {
  assert.ok(sameItem('HW 3', 'Homework 3'));
  assert.ok(sameItem('Quiz 2', 'quiz 2'));
  assert.ok(!sameItem('Quiz 2', 'Quiz 3'));
  assert.ok(sameItem('Midterm 1', 'Midterm 1 (in class)'));
  assert.ok(!sameItem('Midterm 1', 'Final Exam'));
});
