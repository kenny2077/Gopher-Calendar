// Runs INSIDE a canvas.umn.edu tab via chrome.scripting.executeScript, so it
// must stay self-contained: no imports, no references to outer scope.
// It only sends GET requests with the student's existing session, one at a
// time, and returns raw-but-trimmed JSON for normalize.js.

export async function collectCanvas(opts = {}) {
  const gapMs = opts.gapMs ?? 150;
  const now = opts.now ? new Date(opts.now) : new Date();
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const report = message => {
    try { globalThis.chrome?.runtime?.sendMessage?.({ type: 'progress', source: 'canvas', message }); } catch {}
  };

  class LoginRequired extends Error {}
  class Forbidden extends Error {}

  async function get(path) {
    let res;
    try {
      res = await fetch(path, { headers: { Accept: 'application/json' }, credentials: 'include' });
    } catch {
      throw new LoginRequired();
    }
    if (/login\.umn\.edu/.test(res.url)) throw new LoginRequired();
    if (res.status === 401) {
      // Canvas says "unauthenticated" when the session is gone and
      // "unauthorized" when a course hides that tab from students.
      const why = await res.text();
      if (/unauthenticated/i.test(why)) throw new LoginRequired();
      throw new Forbidden(path);
    }
    if (!res.ok) throw new Error(`Canvas answered ${res.status} for ${path.split('?')[0]}`);
    const text = await res.text();
    const body = JSON.parse(text.replace(/^while\(1\);/, ''));
    const next = (res.headers.get('link') || '').split(',').find(p => p.includes('rel="next"'));
    await sleep(gapMs);
    return { body, next: next ? next.match(/<([^>]+)>/)[1] : null };
  }

  async function getAll(path, maxPages = 8) {
    const out = [];
    let url = path;
    for (let i = 0; url && i < maxPages; i++) {
      const { body, next } = await get(url);
      out.push(...body);
      url = next;
    }
    return out;
  }

  const parse = html => new DOMParser().parseFromString(`<!doctype html><html><body>${html}</body></html>`, 'text/html');

  function htmlToText(html) {
    if (!html) return '';
    const doc = parse(html);
    doc.querySelectorAll('script,style').forEach(n => n.remove());
    doc.querySelectorAll('br,p,div,li,tr,h1,h2,h3,h4,h5,h6').forEach(n => n.append('\n'));
    doc.querySelectorAll('td,th').forEach(n => n.append(' '));
    return (doc.body?.textContent || '').replace(/[ \t ]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
  }

  function fileLinks(html) {
    if (!html) return [];
    const doc = parse(html);
    const seen = new Map();
    for (const a of doc.querySelectorAll('a[href]')) {
      const m = a.getAttribute('href').match(/\/files\/(\d+)/);
      if (m && !seen.has(m[1])) seen.set(m[1], (a.textContent || '').trim());
    }
    return [...seen].map(([id, label]) => ({ id, label }));
  }

  // Names that usually hold dates. Everything else (slides, readings,
  // solutions) is ignored. Discovery reads names and sizes only.
  const NAME_RE = /syllab|schedule|calendar|outline|course info|timeline|important dates|due dates|course plan|agenda/i;
  const typeOf = (ct = '', name = '') =>
    /pdf/.test(ct) || /\.pdf$/i.test(name) ? 'pdf'
      : /^image\//.test(ct) ? 'image'
        : /word|officedocument/.test(ct) || /\.docx?$/i.test(name) ? 'docx' : 'other';

  // How many dates a text mentions ("Sept. 9", "Oct 12", "10/12"). Only this
  // count is used to rank sources; the text itself is not sent anywhere yet.
  const DATE_RE = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+\d{1,2}(?!\d)|\b\d{1,2}\/\d{1,2}(?!\d)/gi;
  const countDates = text => (String(text || '').match(DATE_RE) || []).length;

  async function optional(fn) {
    try { return await fn(); } catch (e) { if (e instanceof LoginRequired) throw e; return null; }
  }

  async function discover(c) {
    const found = new Map();
    const add = (id, info, where) => {
      const cur = found.get(id) || { id, foundIn: [], ...info };
      if (!cur.foundIn.includes(where)) cur.foundIn.push(where);
      found.set(id, cur);
    };
    const fileInfo = f => {
      const type = typeOf(f['content-type'], f.display_name);
      return {
        kind: 'file', name: f.display_name, type, size: f.size, updatedAt: f.updated_at || f.modified_at || null,
        url: f.url, readable: (type === 'pdf' || type === 'image') && f.size < 15e6,
      };
    };

    const syllabusText = htmlToText(c.syllabus_body).slice(0, 60000);
    if (syllabusText.length > 40) {
      add('syllabus', { kind: 'syllabus', name: 'Syllabus tab', type: 'html', size: syllabusText.length, dates: countDates(syllabusText), readable: true }, 'Syllabus tab');
    }

    const files = await optional(() => getAll(`/api/v1/courses/${c.id}/files?per_page=100&sort=updated_at&order=desc`, 2)) || [];
    const byId = new Map(files.map(f => [String(f.id), f]));
    let lookups = 0;
    const fileById = async id => byId.get(String(id))
      || (lookups++ < 4 ? await optional(async () => (await get(`/api/v1/courses/${c.id}/files/${id}`)).body) : null);

    for (const link of fileLinks(c.syllabus_body).slice(0, 5)) {
      const f = await fileById(link.id);
      if (f) add(`file:${f.id}`, fileInfo(f), 'linked from Syllabus tab');
    }
    for (const f of files) if (NAME_RE.test(f.display_name)) add(`file:${f.id}`, fileInfo(f), 'Files');

    const modules = await optional(() => getAll(`/api/v1/courses/${c.id}/modules?include[]=items&per_page=50`, 2)) || [];
    for (const m of modules) {
      for (const it of m.items || []) {
        if (!NAME_RE.test(it.title || '')) continue;
        if (it.type === 'File') {
          const f = await fileById(it.content_id);
          if (f) add(`file:${f.id}`, fileInfo(f), 'Modules');
        } else if (it.type === 'Page') {
          add(`page:${it.page_url}`, { kind: 'page', name: it.title, type: 'html', pageUrl: it.page_url, readable: true }, 'Modules');
        } else if (it.type === 'ExternalUrl') {
          add(`link:${it.external_url}`, { kind: 'link', name: it.title, type: 'link', url: it.external_url, readable: false }, 'Modules');
        }
      }
    }

    const pages = await optional(() => getAll(`/api/v1/courses/${c.id}/pages?per_page=100&sort=updated_at&order=desc`, 1)) || [];
    for (const p of pages) {
      if (NAME_RE.test(p.title || '')) {
        add(`page:${p.url}`, { kind: 'page', name: p.title, type: 'html', pageUrl: p.url, updatedAt: p.updated_at, readable: true }, 'Pages');
      }
    }
    // Many courses keep their week-by-week schedule on the Home page (a Canvas
    // page whose title is just the course name), not in the Syllabus tab.
    const front = await optional(async () => (await get(`/api/v1/courses/${c.id}/front_page`)).body);
    if (front && front.url) {
      const text = htmlToText(front.body || '');
      const dates = countDates(text);
      if (dates >= 3 || /schedule|due|week\s*\d/i.test(text)) {
        add(`page:${front.url}`, {
          kind: 'page', name: front.title || 'Home page', type: 'html', pageUrl: front.url,
          updatedAt: front.updated_at, size: text.length, dates, readable: true,
        }, 'Home page');
      }
      for (const link of fileLinks(front.body).slice(0, 3)) {
        const f = await fileById(link.id);
        if (f && NAME_RE.test(`${f.display_name} ${link.label}`)) add(`file:${f.id}`, fileInfo(f), 'linked from Home page');
      }
    }
    return { syllabusText, candidates: [...found.values()].slice(0, 25) };
  }

  try {
    report('Reading your courses');
    const courses = await getAll('/api/v1/courses?enrollment_state=active&include[]=term&include[]=syllabus_body&per_page=50');

    // The current term: a real (non-default) term that has not ended yet and
    // has started or starts within 45 days. Pick the one with the most courses.
    const soon = new Date(now.getTime() + 45 * 864e5);
    const terms = new Map();
    for (const c of courses) {
      const t = c.term;
      if (!t || !t.start_at || !t.end_at || /default/i.test(t.name || '')) continue;
      if (new Date(t.end_at) < now || new Date(t.start_at) > soon) continue;
      const entry = terms.get(t.id) || { term: t, count: 0 };
      entry.count++;
      terms.set(t.id, entry);
    }
    const pick = [...terms.values()].sort((a, b) => b.count - a.count)[0];
    if (!pick) return { ok: false, error: 'NO_TERM', message: 'No active term found in Canvas.' };
    const term = { id: pick.term.id, name: pick.term.name, start: pick.term.start_at, end: pick.term.end_at };
    const termCourses = courses.filter(c => c.term && c.term.id === term.id);

    report('Reading your planner');
    const planner = await getAll(
      `/api/v1/planner/items?start_date=${encodeURIComponent(term.start)}&end_date=${encodeURIComponent(term.end)}&per_page=100`,
    );

    const assignments = {};
    const sources = {};
    for (const c of termCourses) {
      report(`Reading ${c.course_code}`);
      const list = await getAll(`/api/v1/courses/${c.id}/assignments?per_page=100&order_by=due_at`);
      assignments[c.id] = list.map(a => ({
        id: a.id, name: a.name, due_at: a.due_at, points_possible: a.points_possible,
        submission_types: a.submission_types, html_url: a.html_url, published: a.published,
        is_quiz_assignment: a.is_quiz_assignment,
        quiz_id: a.quiz_id ?? null, discussion_topic_id: a.discussion_topic?.id ?? null,
      }));

      report(`Looking for ${c.course_code} syllabus and schedule files`);
      sources[c.id] = await discover(c);
    }

    return {
      ok: true,
      origin: location.origin,
      fetchedAt: new Date().toISOString(),
      term,
      courses: termCourses.map(c => ({ id: c.id, course_code: c.course_code, name: c.name, time_zone: c.time_zone })),
      planner: planner.map(i => ({
        plannable_type: i.plannable_type,
        plannable_id: i.plannable_id,
        course_id: i.course_id,
        context_name: i.context_name,
        plannable_date: i.plannable_date,
        html_url: i.html_url,
        plannable: i.plannable && {
          title: i.plannable.title, due_at: i.plannable.due_at, todo_date: i.plannable.todo_date,
          start_at: i.plannable.start_at, end_at: i.plannable.end_at, all_day: i.plannable.all_day,
          points_possible: i.plannable.points_possible, location_name: i.plannable.location_name,
          assignment_id: i.plannable.assignment_id ?? null,
        },
        submissions: i.submissions || null,
        marked_complete: !!(i.planner_override && i.planner_override.marked_complete),
      })),
      assignments,
      sources,
    };
  } catch (e) {
    if (e instanceof LoginRequired) return { ok: false, error: 'LOGIN_REQUIRED', message: 'Log in to Canvas, then sync again.' };
    return { ok: false, error: 'FAILED', message: String(e && e.message || e) };
  }
}

// Reads the text of Canvas pages the student approved. Runs inside a
// canvas.umn.edu tab, self-contained like collectCanvas.
export async function readCanvasPages({ pages = [] } = {}) {
  const out = {};
  for (const { courseId, pageUrl } of pages.slice(0, 12)) {
    try {
      const res = await fetch(`/api/v1/courses/${courseId}/pages/${encodeURIComponent(pageUrl)}`, { headers: { Accept: 'application/json' }, credentials: 'include' });
      if (!res.ok) { out[`${courseId}|${pageUrl}`] = { error: `Canvas answered ${res.status}` }; continue; }
      const body = JSON.parse((await res.text()).replace(/^while\(1\);/, ''));
      const doc = new DOMParser().parseFromString(`<!doctype html><html><body>${body.body || ''}</body></html>`, 'text/html');
      doc.querySelectorAll('br,p,div,li,tr,h1,h2,h3,h4,h5,h6').forEach(n => n.append('\n'));
      doc.querySelectorAll('td,th').forEach(n => n.append(' | '));
      out[`${courseId}|${pageUrl}`] = { text: (doc.body?.textContent || '').replace(/[ \t\u00a0]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim().slice(0, 40000) };
      await new Promise(r => setTimeout(r, 150));
    } catch (e) {
      out[`${courseId}|${pageUrl}`] = { error: String(e.message || e) };
    }
  }
  return out;
}
