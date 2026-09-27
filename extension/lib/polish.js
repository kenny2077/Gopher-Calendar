// AI reading (optional mode): the student's own model provider (Azure OpenAI,
// OpenAI or Anthropic) reads the sources the student approved
// for a course (syllabus text, PDF text, page images for scans, Canvas pages,
// uploaded files) and returns
//   kinds   – better item types for the workload symbols
//   titles  – shorter titles for noisy Canvas names
//   dated   – dates for Canvas assignments that have no due date
//   extra   – graded items the syllabus lists but Canvas does not
//   recurring – repeating events ("each lab begins with a quiz"), which
//             code expands into dated items on real class days
// Runs in the dashboard page (it needs DOM, workers and pdf.js).
// Only course codes, item titles and syllabus content are sent.

import { KINDS, classify } from './classify.js';
import { expandRecurring } from './extract.js';

const MAX_TEXT = 48000;

export function hashInput(obj) {
  const s = JSON.stringify(obj);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

let pdfjsPromise;
function pdfjs() {
  pdfjsPromise ||= import('../vendor/pdf.min.mjs').then(lib => {
    lib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('vendor/pdf.worker.min.mjs');
    return lib;
  });
  return pdfjsPromise;
}

// Returns { text, images } for one syllabus file. Images are used only when
// the PDF has no text layer (a scan), or when the file itself is an image.
export async function readSyllabusFile(file, { maxPages = 12, imagePages = 4 } = {}) {
  const res = await fetch(file.url, { credentials: 'include' });
  if (!res.ok) throw new Error(`Could not download ${file.name} (${res.status})`);
  const blob = await res.blob();
  if (/^image\//.test(blob.type || file.type)) return { text: '', images: [await blobToDataUrl(blob)] };
  return readPdf(await blob.arrayBuffer(), { maxPages, imagePages });
}

export async function readPdf(buffer, { maxPages = 12, imagePages = 4 } = {}) {
  const lib = await pdfjs();
  const doc = await lib.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false }).promise;
  const pages = Math.min(doc.numPages, maxPages);
  let text = '';
  for (let i = 1; i <= pages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let line = '', lastY = null;
    for (const it of content.items) {
      const y = it.transform?.[5];
      if (lastY !== null && Math.abs(y - lastY) > 2) { text += line.trim() + '\n'; line = ''; }
      line += it.str + (it.hasEOL ? '\n' : ' ');
      lastY = y;
    }
    text += line.trim() + '\n\n';
  }
  const images = [];
  if (text.replace(/\s/g, '').length < 200) {
    for (let i = 1; i <= Math.min(doc.numPages, imagePages); i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 1.4 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width; canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      images.push(canvas.toDataURL('image/jpeg', 0.82));
    }
  }
  return { text: text.trim(), images };
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

const KIND_ENUM = KINDS;

// Same JSON shape for every provider (arrays, not maps, so it also works as a
// strict JSON schema).
export const RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['kinds', 'titles', 'dated', 'extra', 'recurring'],
  properties: {
    kinds: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'kind'], properties: { id: { type: 'string' }, kind: { type: 'string', enum: KIND_ENUM } } } },
    titles: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'title'], properties: { id: { type: 'string' }, title: { type: 'string' } } } },
    dated: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'date', 'time', 'evidence'], properties: { id: { type: 'string' }, date: { type: 'string' }, time: { type: 'string' }, evidence: { type: 'string' } } } },
    extra: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title', 'kind', 'date', 'time', 'evidence'], properties: { title: { type: 'string' }, kind: { type: 'string', enum: KIND_ENUM }, date: { type: 'string' }, time: { type: 'string' }, evidence: { type: 'string' } } } },
    recurring: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['title', 'kind', 'weekday', 'time', 'first_date', 'last_date', 'skip_dates', 'evidence'],
        properties: {
          title: { type: 'string' }, kind: { type: 'string', enum: KIND_ENUM },
          weekday: { type: 'string', enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
          time: { type: 'string' }, first_date: { type: 'string' }, last_date: { type: 'string' },
          skip_dates: { type: 'array', items: { type: 'string' } }, evidence: { type: 'string' },
        },
      },
    },
  },
};

const SYSTEM = `You organise a university student's course deadlines for a calendar.
You receive one course: its Canvas items (some without due dates), its class meeting pattern, the semester dates, holidays, and syllabus content (text and/or page images).
Return one JSON object with these arrays (use [] when empty, "" for an unknown time):
- kinds: [{ id, kind }] for Canvas items whose type differs from the "kind" given. project = project, presentation, talk; milestone = report, peer review, beta, final deliverable; participation = attendance or participation credit.
- titles: [{ id, title }] only for titles you actually shortened or clarified (max 40 chars, no course code, keep numbering like "HW 3").
- dated: [{ id, date, time, evidence }] for ids in "undated" that have ONE specific date in the syllabus ("Midterm 1 is Friday, October 9").
- extra: [{ title, kind, date, time, evidence }] for one-time graded items with a specific date that are missing from both Canvas lists, e.g. an exam only named in the syllabus. Never repeat an existing item.
- recurring: [{ title, kind, weekday, time, first_date, last_date, skip_dates, evidence }] for anything that repeats on a schedule.

Recurring events matter most. Syllabi often describe a repeating event without listing its dates: "each lab session except the first week begins with a short quiz", "homework is due every Monday in class", "a reading response before each Tuesday lecture". Infer these even when no date is written:
- title is the base name without a number ("Quiz", "HW", "Reading response"); the calendar numbers them 1, 2, 3… in date order and matches them to Canvas items with those numbers.
- weekday is the day it happens. For "each lab" or "each discussion", use the day of the class meeting that happens once a week (usually the lab or discussion section).
- first_date is the first occurrence (apply rules like "except the first week" or "starting week 3"); last_date is the last occurrence, no later than classes.last_day unless the syllabus says otherwise.
- skip_dates lists dates the syllabus says are skipped (exam weeks, "no quiz on midterm days"). University holidays in classes.no_class_days are skipped automatically; you do not need to list them.
- Do not also list recurring occurrences in dated or extra.

General rules:
- Every date must fall inside the semester range and be written YYYY-MM-DD. Times are America/Chicago like "9:05am"; use the class start time for "in class" items.
- evidence quotes or paraphrases the syllabus in at most 15 words.
- Only report what the syllabus supports; skip anything you would have to guess.`;

export async function polishCourse({ ai, course, term, classes, pattern, items, undated, syllabusText, images = [], classInfo = null, closures = [] }) {
  const payload = {
    course, semester: term, classes: classes || null, class_meetings: pattern,
    items: items.map(d => ({ id: d.id, title: d.rawTitle || d.title, kind: d.kind, date: d.date })),
    undated: undated.map(u => ({ id: u.id, title: u.rawTitle || u.title, kind: u.kind, points: u.points })),
  };
  const text = `${JSON.stringify(payload)}\n\nSYLLABUS:\n${(syllabusText || '(no syllabus text; see images if any)').slice(0, MAX_TEXT)}`;
  const answer = await callModel(ai, { system: SYSTEM, text, images: images.slice(0, 6) });
  const result = validate(parseJson(answer), { term, items, undated });
  // Repeating events are expanded by code, so dates always land on real class
  // days and skip holidays, whatever the model wrote.
  const usedIds = new Set(result.dated.map(d => d.id));
  for (const series of result.recurring) {
    expandRecurring(series, { undated, items, classInfo, closures, dated: result.dated, extra: result.extra, usedIds });
  }
  return result;
}

// Models occasionally wrap JSON in prose or a code fence.
function parseJson(text) {
  const t = String(text || '').trim();
  try { return JSON.parse(t); } catch {}
  const m = t.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  throw new Error('The model did not return JSON.');
}

/* ---------- providers ---------- */

export const PROVIDERS = {
  azure: { label: 'Azure OpenAI', defaultModel: 'gpt-6-luna' },
  openai: { label: 'OpenAI', defaultModel: 'gpt-6-luna' },
  anthropic: { label: 'Anthropic (Claude)', defaultModel: 'claude-sonnet-5' },
};

// Settings: { provider, azure: {endpoint, deployment, apiKey}, openai: {apiKey, model}, anthropic: {apiKey, model} }
export function aiConfig(settings = {}) {
  const provider = PROVIDERS[settings.provider] ? settings.provider : 'azure';
  const p = settings[provider] || {};
  return {
    provider,
    label: PROVIDERS[provider].label,
    apiKey: p.apiKey || '',
    endpoint: provider === 'azure' ? p.endpoint || '' : '',
    model: (provider === 'azure' ? p.deployment : p.model) || PROVIDERS[provider].defaultModel,
    deployment: provider === 'azure' ? p.deployment || PROVIDERS.azure.defaultModel : undefined,
  };
}

export const aiReady = ai => !!(ai.apiKey && (ai.provider !== 'azure' || ai.endpoint));

// "https://x.services.ai.azure.com", ".../openai/v1" or ".../openai/v1/responses"
// all become the Responses URL. Only https Azure hosts are accepted, so a
// changed setting can't send your key and syllabus somewhere else.
export function azureResponsesUrl(endpoint) {
  let base = String(endpoint || '').trim().replace(/\/+$/, '').replace(/\/responses$/, '');
  let url;
  try { url = new URL(base); } catch { throw new Error('The Azure endpoint is not a valid URL.'); }
  if (url.protocol !== 'https:' || !/\.(services\.ai|openai|cognitiveservices)\.azure\.com$/.test(url.hostname)) {
    throw new Error('The Azure endpoint must be an https://….azure.com address.');
  }
  if (!/\/openai\/v1$/.test(base)) base = `${url.origin}/openai/v1`;
  return `${base}/responses`;
}

// Host permission each provider needs; requested when the student saves a key.
export function providerOrigins(ai) {
  if (ai.provider === 'openai') return ['https://api.openai.com/*'];
  if (ai.provider === 'anthropic') return ['https://api.anthropic.com/*'];
  try { return [`${new URL(azureResponsesUrl(ai.endpoint)).origin}/*`]; } catch { return []; }
}

async function failure(res, label) {
  let msg = '';
  try { const b = JSON.parse(await res.text()); msg = b.error?.message || b.message || ''; } catch {}
  if (res.status === 401 || res.status === 403) return new Error(`${label} rejected the API key.`);
  if (res.status === 404) return new Error(`${label} does not know that model or deployment.${msg ? ` ${msg.slice(0, 100)}` : ''}`);
  if (res.status === 429) return new Error(`${label} rate limit hit; try again in a minute.`);
  return new Error(`${label} answered ${res.status}${msg ? `: ${msg.slice(0, 140)}` : ''}`);
}

// One call to the chosen provider; returns the model's JSON text.
export async function callModel(ai, { system, text, images = [], schema = RESULT_SCHEMA }) {
  if (ai.provider === 'openai') return callOpenAI(ai, { system, text, images, schema });
  if (ai.provider === 'anthropic') return callAnthropic(ai, { system, text, images, schema });
  return callAzure(ai, { system, text, images, schema });
}

async function callAzure(ai, { system, text, images, schema }) {
  const input = [{ role: 'user', content: [{ type: 'input_text', text }, ...images.map(image_url => ({ type: 'input_image', image_url }))] }];
  // Strict structured output keeps kinds and weekdays inside their enums.
  const request = { model: ai.deployment, instructions: system, input, text: { format: { type: 'json_schema', name: 'calendar_result', strict: true, schema } }, reasoning: { effort: 'low' } };
  const send = body => fetch(azureResponsesUrl(ai.endpoint), {
    method: 'POST',
    headers: { 'api-key': ai.apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let res = await send(request);
  if (res.status === 400) {
    // Some deployments reject the reasoning setting; retry once without it.
    const detail = await res.clone().text();
    if (/reasoning/i.test(detail)) { delete request.reasoning; res = await send(request); }
  }
  if (!res.ok) throw await failure(res, 'Azure');
  const body = await res.json();
  return body.output_text
    ?? (body.output || []).flatMap(o => o.content || []).filter(c => c.type === 'output_text').map(c => c.text).join('');
}

// OpenAI Chat Completions with strict structured outputs (same schema as Claude).
async function callOpenAI(ai, { system, text, images, schema }) {
  const content = [{ type: 'text', text }, ...images.map(url => ({ type: 'image_url', image_url: { url } }))];
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${ai.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: ai.model,
      response_format: { type: 'json_schema', json_schema: { name: 'calendar_result', strict: true, schema } },
      messages: [{ role: 'system', content: system }, { role: 'user', content }],
    }),
  });
  if (!res.ok) throw await failure(res, 'OpenAI');
  const body = await res.json();
  return body.choices?.[0]?.message?.content || '';
}

// Anthropic Messages API, called directly from the extension page (raw HTTP:
// the extension has no build step to bundle the SDK). Structured outputs keep
// the answer on the schema.
async function callAnthropic(ai, { system, text, images, schema }) {
  const imageBlocks = images.map(url => {
    const m = String(url).match(/^data:(image\/[\w+.-]+);base64,(.*)$/);
    return m ? { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } } : null;
  }).filter(Boolean);
  // Opus 5 and Fable can decline some requests; for those, let the API re-run
  // a declined request on its recommended fallback model.
  const fallbackCapable = /opus-5|fable/.test(ai.model);
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ai.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
      ...(fallbackCapable ? { 'anthropic-beta': 'server-side-fallback-2026-07-01' } : {}),
    },
    body: JSON.stringify({
      model: ai.model,
      max_tokens: 16000,
      system,
      ...(fallbackCapable ? { fallbacks: 'default' } : {}),
      output_config: { format: { type: 'json_schema', schema } },
      messages: [{ role: 'user', content: [...imageBlocks, { type: 'text', text }] }],
    }),
  });
  if (!res.ok) throw await failure(res, 'Anthropic');
  const body = await res.json();
  if (body.stop_reason === 'refusal') throw new Error('Claude declined to read this syllabus.');
  if (body.stop_reason === 'max_tokens') throw new Error('Claude ran out of room before finishing; try again.');
  return (body.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
}

// Keep only well-formed answers that refer to real items and real dates.
// Accepts the array shape above and the older map shape for kinds/titles.
export function validate(raw, { term, items, undated }) {
  const ids = new Set([...items, ...undated].map(x => x.id));
  const undatedIds = new Set(undated.map(u => u.id));
  const isDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '') && d >= term.start && d <= term.end;
  const isTime = t => /^\d{1,2}:\d{2}(am|pm)$/.test(t || '');
  const words = s => String(s || '').slice(0, 120);
  const pairs = (v, key) => (Array.isArray(v) ? v.map(x => [x?.id, x?.[key]]) : Object.entries(v || {}));

  const kinds = {};
  for (const [id, k] of pairs(raw.kinds, 'kind')) if (ids.has(id) && KINDS.includes(k)) kinds[id] = k;
  const titles = {};
  for (const [id, t] of pairs(raw.titles, 'title')) if (ids.has(id) && typeof t === 'string' && t.trim()) titles[id] = t.trim().slice(0, 60);
  const dated = (raw.dated || [])
    .filter(g => undatedIds.has(g.id) && isDate(g.date))
    .map(g => ({ id: g.id, date: g.date, time: isTime(g.time) ? g.time : '', evidence: words(g.evidence) }));
  const existing = new Set(items.map(i => `${i.date}|${String(i.title).toLowerCase()}`));
  const extra = (raw.extra || [])
    .filter(x => x && typeof x.title === 'string' && isDate(x.date) && !existing.has(`${x.date}|${x.title.toLowerCase()}`))
    .slice(0, 40)
    .map(x => ({ title: x.title.slice(0, 80), kind: KINDS.includes(x.kind) ? x.kind : 'assignment', date: x.date, time: isTime(x.time) ? x.time : '', evidence: words(x.evidence) }));
  const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const recurring = (raw.recurring || [])
    .filter(r => r && typeof r.title === 'string' && r.title.trim() && DAYS.includes(String(r.weekday).toLowerCase()) && isDate(r.first_date) && isDate(r.last_date) && r.first_date <= r.last_date)
    .slice(0, 6)
    .map(r => ({
      // The title decides the kind ("Quiz" is a quiz), whatever the model said.
      title: r.title.trim().slice(0, 40), kind: classify(r.title) !== 'assignment' ? classify(r.title) : (['assignment', 'participation'].includes(r.kind) ? r.kind : 'assignment'),
      weekday: String(r.weekday).toLowerCase(), time: isTime(r.time) ? r.time : '',
      first_date: r.first_date, last_date: r.last_date,
      skip_dates: (r.skip_dates || []).filter(isDate), evidence: `Repeats weekly: ${words(r.evidence)}`,
    }));
  return { kinds, titles, dated, extra, recurring };
}
