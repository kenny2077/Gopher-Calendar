// Runs INSIDE a www.myu.umn.edu tab via chrome.scripting.executeScript, so it
// must stay self-contained: no imports, no references to outer scope.
// Reads the same IScript pages MyU's own "Class Schedule" panel renders:
//   UM_SSS_ACAD_SCHEDULE&effdt=YYYY-MM-DD  -> one week of meetings
//   UM_SSS_CLASS_DETAIL&STRM&CLASS_NBR      -> meeting pattern + date range
// Requests are sequential with a pause between them.

export async function collectMyU(opts = {}) {
  const BASE = 'https://www.myu.umn.edu/psp/psprd/EMPLOYEE/CAMP/s/WEBLIB_IS_DS.ISCRIPT1.FieldFormula.IScript_DrawSection?group=UM_SSS';
  const gapMs = opts.gapMs ?? 250;
  const maxWeeks = opts.maxWeeks ?? 22;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const report = message => {
    try { globalThis.chrome?.runtime?.sendMessage?.({ type: 'progress', source: 'myu', message }); } catch {}
  };
  class LoginRequired extends Error {}

  const pad = n => String(n).padStart(2, '0');
  const keyOf = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const addDays = (key, n) => { const d = new Date(`${key}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return keyOf(d); };
  const mondayOf = key => addDays(key, -((new Date(`${key}T12:00:00Z`).getUTCDay() + 6) % 7));
  const clean = s => String(s || '').replace(/\s+/g, ' ').trim();

  async function getDoc(url) {
    let res;
    try {
      res = await fetch(url, { credentials: 'include' });
    } catch {
      throw new LoginRequired(); // cross-origin redirect to the login page
    }
    if (/login\.umn\.edu|signon/i.test(res.url)) throw new LoginRequired();
    if (!res.ok) throw new Error(`MyU answered ${res.status}`);
    const html = await res.text();
    await sleep(gapMs);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    if (doc.querySelector('input[type=password]') || /Sign In|Web Login Service/i.test(doc.title || '')) throw new LoginRequired();
    return doc;
  }

  // MyU writes data-fulldate by incrementing the day number, so the Thursday
  // of the week of Sep 28 arrives as 20260931. Date.UTC normalises overflow.
  function fullDateKey(raw) {
    const m = String(raw || '').match(/^(\d{4})(\d{2})(\d{2})$/);
    if (!m) return null;
    return keyOf(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)));
  }

  // "11:15 - 12:30 PM" (start meridiem omitted) -> ["11:15", "12:30"]
  function parseRange(text) {
    const m = String(text).match(/(\d{1,2}):(\d{2})\s*(AM|PM)?\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!m) return null;
    const to24 = (h, ap) => (h % 12) + (/pm/i.test(ap) ? 12 : 0);
    const end = to24(+m[4], m[6]) * 60 + +m[5];
    let start = to24(+m[1], m[3] || m[6]) * 60 + +m[2];
    if (!m[3] && start > end) start -= 12 * 60;
    const hhmm = mins => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
    return [hhmm(start), hhmm(end)];
  }

  function parseCourseName(text) {
    const m = clean(text).match(/^([A-Z]{2,6})\s+(\d{4}[A-Z]?)\s*\(([^)]+)\)\s*(.*)$/);
    return m ? { code: `${m[1]} ${m[2]}`, section: m[3], title: m[4] } : { code: clean(text), section: '', title: '' };
  }

  function parseWeek(doc) {
    const meetings = [];
    for (const el of doc.querySelectorAll('.myu_calendar-class')) {
      if (el.classList.contains('no-class')) continue;
      const detailsEl = el.querySelector('.myu_calendar-class-details');
      const parts = (detailsEl ? detailsEl.innerHTML : '')
        .split(/<br\s*\/?>/i)
        .map(s => clean(s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')))
        .filter(Boolean);
      const timeIdx = parts.findIndex(p => /\d{1,2}:\d{2}/.test(p));
      const range = timeIdx >= 0 ? parseRange(parts[timeIdx]) : null;
      const name = parseCourseName(el.querySelector('.myu_calendar-class-name')?.textContent);
      const date = fullDateKey(el.getAttribute('data-fulldate'));
      if (!date || !range) continue;
      meetings.push({
        classNbr: clean(el.getAttribute('data-class-nbr')),
        strm: clean(el.getAttribute('data-strm')),
        institution: clean(el.getAttribute('data-institution')) || 'UMNTC',
        ...name,
        component: timeIdx > 0 ? parts[0] : '',
        date, start: range[0], end: range[1],
        room: parts[timeIdx + 1] || '',
      });
    }
    return meetings;
  }

  const DAY_TOKENS = { Su: 0, M: 1, Tu: 2, T: 2, W: 3, Th: 4, F: 5, Sa: 6 };
  function parseDetail(doc) {
    const rows = [];
    for (const tr of doc.querySelectorAll('tr')) {
      const cell = th => tr.querySelector(`[data-th="${th}"]`);
      const dt = cell('Days and Times');
      if (!dt) continue;
      const text = clean(dt.textContent);
      const firstDigit = text.search(/\d/);
      const dayPart = firstDigit >= 0 ? text.slice(0, firstDigit) : text;
      // Positional pattern like "M-W-F--" or "-T-Th---" (Tuesday is "T").
      const days = (dayPart.match(/Su|Sa|Th|Tu|T|M|W|F/g) || []).map(t => DAY_TOKENS[t]);
      const range = parseRange(text);
      const dates = clean(cell('Meeting Dates')?.textContent).match(/(\d{2})\/(\d{2})\/(\d{4})/g) || [];
      const toKey = s => `${s.slice(6)}-${s.slice(0, 2)}-${s.slice(3, 5)}`;
      rows.push({
        days,
        raw: text,
        start: range ? range[0] : null,
        end: range ? range[1] : null,
        room: clean(cell('Room')?.textContent),
        instructors: clean(cell('Instructors')?.textContent),
        startDate: dates[0] ? toKey(dates[0]) : null,
        endDate: dates[1] ? toKey(dates[1]) : null,
      });
    }
    return rows.filter(r => r.days.length && r.start);
  }

  const weekUrl = key => `${BASE}&section=UM_SSS_ACAD_SCHEDULE&pslnk=1&cmd=smartnav&effdt=${key}`;
  const detailUrl = (strm, nbr, inst) =>
    `${BASE}&section=UM_SSS_CLASS_DETAIL&cmd=smartnav&STRM=${strm}&CLASS_NBR=${nbr}&INSTITUTION=${inst === 'UMNRO' ? 'UMNTC&CAMPUS=UMNRO' : inst}`;

  try {
    const today = opts.today || keyOf(new Date());
    const anchors = [today, addDays(today, 7), addDays(today, 14), ...(opts.anchorHints || [])];
    const weeks = {};
    let sample = [];
    for (const a of anchors) {
      const monday = mondayOf(a);
      report(`Reading week of ${monday}`);
      weeks[monday] = parseWeek(await getDoc(weekUrl(monday)));
      if (weeks[monday].length) { sample = weeks[monday]; break; }
    }
    if (!sample.length) return { ok: false, error: 'NO_CLASSES', message: 'MyU shows no classes with set times for the coming weeks.' };

    const classes = new Map();
    for (const m of sample) if (!classes.has(m.classNbr)) classes.set(m.classNbr, m);

    const details = [];
    for (const m of classes.values()) {
      report(`Reading ${m.code} details`);
      const rows = parseDetail(await getDoc(detailUrl(m.strm, m.classNbr, m.institution)));
      details.push({
        classNbr: m.classNbr, strm: m.strm, code: m.code, section: m.section,
        title: m.title, component: m.component, rows,
      });
    }

    const starts = details.flatMap(d => d.rows.map(r => r.startDate)).filter(Boolean).sort();
    const ends = details.flatMap(d => d.rows.map(r => r.endDate)).filter(Boolean).sort();
    const first = starts[0] || mondayOf(today);
    const last = ends[ends.length - 1] || addDays(first, 7 * 15);

    let scanned = 0;
    for (let k = mondayOf(first); k <= last && scanned < maxWeeks; k = addDays(k, 7), scanned++) {
      if (weeks[k]) continue;
      report(`Reading week of ${k}`);
      weeks[k] = parseWeek(await getDoc(weekUrl(k)));
    }

    // Classes that didn't meet in the sample week (second-half courses,
    // every-other-week labs) still need their meeting pattern.
    const known = new Set(details.map(d => d.classNbr));
    const later = new Map();
    for (const m of Object.values(weeks).flat()) if (!known.has(m.classNbr) && !later.has(m.classNbr)) later.set(m.classNbr, m);
    for (const m of [...later.values()].slice(0, 8)) {
      report(`Reading ${m.code} details`);
      const rows = parseDetail(await getDoc(detailUrl(m.strm, m.classNbr, m.institution)));
      details.push({ classNbr: m.classNbr, strm: m.strm, code: m.code, section: m.section, title: m.title, component: m.component, rows });
    }

    return {
      ok: true,
      fetchedAt: new Date().toISOString(),
      strm: sample[0].strm,
      range: { start: first, end: last },
      classes: details,
      meetings: Object.keys(weeks).sort().flatMap(k => weeks[k]),
      weeksScanned: Object.keys(weeks).length,
    };
  } catch (e) {
    if (e instanceof LoginRequired) return { ok: false, error: 'LOGIN_REQUIRED', message: 'Log in to MyU, then sync again.' };
    return { ok: false, error: 'FAILED', message: String(e && e.message || e) };
  }
}
