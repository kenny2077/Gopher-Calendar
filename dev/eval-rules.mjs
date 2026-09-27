// Scores the rules-only reader against the dates you confirmed from the
// Azure run. Uses private fixtures captured from your real courses
// (test/fixtures/private, gitignored). Run: node dev/eval-rules.mjs
import { readFileSync, existsSync } from 'node:fs';
import { extractRules } from '../extension/lib/extract.js';
import { sameItem } from '../extension/lib/sources.js';
import { addDays, keyToDate } from '../extension/lib/time.js';

const dir = new URL('../test/fixtures/private/', import.meta.url);
if (!existsSync(new URL('snapshot-ai.json', dir))) { console.log('No private fixtures; nothing to score.'); process.exit(0); }
const snap = JSON.parse(readFileSync(new URL('snapshot-ai.json', dir)));
const texts = JSON.parse(readFileSync(new URL('source-texts.json', dir))).sourceTexts;
for (const [course, ups] of Object.entries(snap.uploads || {})) {
  if (!texts[course]) texts[course] = { parts: ups.map(u => ({ name: u.name, text: u.text || '' })) };
}

const term = { start: snap.myu.range.start, end: addDays(snap.myu.range.end, 10) };
const days = (a, b) => Math.abs(keyToDate(a) - keyToDate(b)) / 864e5;
const undatedById = Object.fromEntries(snap.canvas.undated.map(u => [u.id, u]));
let totalGold = 0, totalFound = 0, totalRight = 0;

for (const course of Object.keys(texts).sort()) {
  const gold = snap.polish?.[course]?.result || { dated: [], extra: [] };
  const goldItems = [
    ...gold.dated.map(g => ({ title: undatedById[g.id]?.title || g.id, id: g.id, date: g.date })),
    ...gold.extra.map(x => ({ title: x.title, date: x.date })),
  ];
  const r = extractRules({
    sources: texts[course].parts,
    items: snap.canvas.deadlines.filter(d => d.course === course),
    undated: snap.canvas.undated.filter(u => u.course === course),
    classInfo: snap.myu.classes.find(c => c.course === course),
    closures: snap.myu.closures || [],
    term,
  });
  const found = [
    ...r.dated.map(g => ({ title: undatedById[g.id]?.title || g.id, id: g.id, date: g.date, evidence: g.evidence })),
    ...r.extra.map(x => ({ title: x.title, date: x.date, evidence: x.evidence })),
  ];
  const matches = g => f => (g.id && f.id ? g.id === f.id : sameItem(g.title, f.title));
  const right = found.filter(f => goldItems.some(g => matches(g)(f) && days(g.date, f.date) <= 1));
  const missed = goldItems.filter(g => !found.some(f => matches(g)(f) && days(g.date, f.date) <= 1));
  const wrong = found.filter(f => !right.includes(f));
  totalGold += goldItems.length; totalFound += found.length; totalRight += right.length;
  console.log(`\n${course}: AI found ${goldItems.length}, rules found ${found.length}, agree on ${right.length}`);
  for (const m of missed) console.log(`  missed  ${m.title} ${m.date}`);
  for (const w of wrong) console.log(`  extra   ${w.title} ${w.date}  «${w.evidence}»`);
}
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : 'n/a');
console.log(`\nOverall: rules found ${totalRight} of the ${totalGold} AI dates (${pct(totalRight, totalGold)}); ${totalFound - totalRight} rules-only results (${pct(totalRight, totalFound)} agree).`);
