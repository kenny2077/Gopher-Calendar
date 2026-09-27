// Service worker: runs the collectors inside Canvas / MyU tabs (so requests
// carry the student's own session), normalises the results into storage, and
// opens the calendar page when a sync finishes.

import { collectCanvas, readCanvasPages } from './lib/canvas-collect.js';
import { collectMyU } from './lib/myu-collect.js';
import { normalizeCanvas, normalizeMyU } from './lib/normalize.js';
import { todayKey, addDays } from './lib/time.js';
import { fetchClosures } from './lib/closures.js';

const SITES = {
  canvas: { home: 'https://canvas.umn.edu/', match: 'https://canvas.umn.edu/*', host: 'canvas.umn.edu', label: 'Canvas' },
  myu: { home: 'https://www.myu.umn.edu/psp/psprd/EMPLOYEE/EMPL/h/?tab=DEFAULT', match: 'https://www.myu.umn.edu/*', host: 'www.myu.umn.edu', label: 'MyU' },
};
const DASHBOARD = chrome.runtime.getURL('dashboard/dashboard.html');

// Fill AI settings on install/update from config.local.json (gitignored).
// Older versions stored DeepSeek fields; those are dropped.
chrome.runtime.onInstalled.addListener(async () => {
  const { settings: old = {} } = await chrome.storage.local.get('settings');
  let cfg = {};
  try { cfg = await (await fetch(chrome.runtime.getURL('config.local.json'))).json(); } catch {}
  const settings = {
    reading: old.reading ?? true,
    mode: old.mode || 'rules', // rules on this device by default; 'ai' uses the provider below
    provider: old.provider || cfg.provider || 'azure',
    azure: {
      endpoint: old.azure?.endpoint || cfg.azureEndpoint || '',
      deployment: old.azure?.deployment || cfg.azureDeployment || 'gpt-6-luna',
      apiKey: old.azure?.apiKey || cfg.azureApiKey || '',
    },
    openai: { model: old.openai?.model || cfg.openaiModel || 'gpt-6-luna', apiKey: old.openai?.apiKey || cfg.openaiApiKey || '' },
    anthropic: { model: old.anthropic?.model || cfg.anthropicModel || 'claude-sonnet-5', apiKey: old.anthropic?.apiKey || cfg.anthropicApiKey || '' },
  };
  await chrome.storage.local.set({ settings });
});

// Canvas and MyU report progress at the same time, so writes are queued to
// keep one from overwriting the other.
let syncWrites = Promise.resolve();
function setSync(patch) {
  syncWrites = syncWrites.then(() => applySync(patch), () => applySync(patch));
  return syncWrites;
}

async function applySync(patch) {
  const { syncState = {} } = await chrome.storage.local.get('syncState');
  const next = { ...syncState, ...patch };
  for (const k of ['canvas', 'myu']) if (patch[k]) next[k] = { ...syncState[k], ...patch[k] };
  await chrome.storage.local.set({ syncState: next });
}

// Wait until the tab stops navigating (SSO bounces through several pages).
async function waitSettled(tabId, timeoutMs = 30000) {
  const t0 = Date.now();
  let lastUrl = '', stable = 0;
  while (Date.now() - t0 < timeoutMs) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === 'complete' && tab.url === lastUrl) {
      if (++stable >= 3) return tab;
    } else stable = 0;
    lastUrl = tab.url;
    await new Promise(r => setTimeout(r, 400));
  }
  return chrome.tabs.get(tabId);
}

async function runInSite(key, func, args) {
  const site = SITES[key];
  let tab = null, created = false, keepOpen = false;
  try {
    [tab] = await chrome.tabs.query({ url: site.match });
    if (!tab) {
      tab = await chrome.tabs.create({ url: site.home, active: false });
      created = true;
    }
    tab = await waitSettled(tab.id);
    if (new URL(tab.url).host !== site.host) {
      // Bounced to the university login page: show it so the student can sign in.
      keepOpen = true;
      await chrome.tabs.update(tab.id, { active: true });
      return { ok: false, error: 'LOGIN_REQUIRED', message: `Log in to ${site.label} in the tab that just opened, then sync again.` };
    }
    const [{ result } = {}] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func, args: [args] });
    if (result?.error === 'LOGIN_REQUIRED') {
      keepOpen = true;
      await chrome.tabs.update(tab.id, { active: true, url: site.home });
      return { ...result, message: `Log in to ${site.label} in the tab that just opened, then sync again.` };
    }
    return result || { ok: false, error: 'FAILED', message: `${site.label} did not return anything.` };
  } catch (e) {
    // Offline, the tab was closed, or Chrome showed an error page.
    return { ok: false, error: 'FAILED', message: `Couldn't reach ${site.label}. Check your connection and sync again.` };
  } finally {
    if (created && !keepOpen && tab) chrome.tabs.remove(tab.id).catch(() => {});
  }
}

async function syncCanvas() {
  await setSync({ canvas: { status: 'running', message: 'Opening Canvas' } });
  const raw = await runInSite('canvas', collectCanvas, { gapMs: 150 });
  if (!raw.ok) return setSync({ canvas: { status: 'error', message: raw.message } });
  const canvas = normalizeCanvas(raw);
  await chrome.storage.local.set({ canvas });
  await setSync({
    canvas: {
      status: 'ok', at: raw.fetchedAt,
      message: `${canvas.deadlines.length} deadlines from ${canvas.courses.length} courses`,
    },
  });
  return canvas;
}

async function syncMyU(hints) {
  await setSync({ myu: { status: 'running', message: 'Opening MyU' } });
  const raw = await runInSite('myu', collectMyU, { gapMs: 250, today: todayKey(), anchorHints: hints });
  if (!raw.ok) return setSync({ myu: { status: 'error', message: raw.message } });
  // Holidays come from the public UMN academic calendar, not from MyU.
  raw.closures = await fetchClosures({ start: raw.range.start, end: addDays(raw.range.end, 10) }, raw.meetings[0]?.institution);
  const myu = normalizeMyU(raw);
  await chrome.storage.local.set({ myu });
  await setSync({
    myu: { status: 'ok', at: raw.fetchedAt, message: `${myu.classes.length} classes, ${myu.meetings.length} meetings` },
  });
  return myu;
}

async function openDashboard() {
  const [tab] = await chrome.tabs.query({ url: DASHBOARD });
  if (tab) {
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: DASHBOARD });
  }
}

let running = null;
async function sync(sources = ['canvas', 'myu'], { open = true } = {}) {
  if (running) return running;
  running = (async () => {
    await setSync({ running: true, startedAt: new Date().toISOString() });
    // Real data replaces the sample semester entirely, never mixes with it.
    const { sample } = await chrome.storage.local.get('sample');
    if (sample) await chrome.storage.local.remove(['canvas', 'myu', 'polish', 'confirmed', 'sample', 'triage', 'approvals', 'uploads']);
    try {
      const { canvas: prev } = await chrome.storage.local.get('canvas');
      const hints = prev?.term?.start ? [prev.term.start] : [];
      // Canvas and MyU are separate sites, so they can load side by side.
      await Promise.allSettled([
        sources.includes('canvas') ? syncCanvas() : null,
        sources.includes('myu') ? syncMyU(hints) : null,
      ]);
    } finally {
      await setSync({ running: false, finishedAt: new Date().toISOString() });
      running = null;
    }
    const { syncState } = await chrome.storage.local.get('syncState');
    const anyOk = sources.some(s => syncState?.[s]?.status === 'ok');
    if (open && anyOk) await openDashboard();
  })();
  return running;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return false;
  if (msg?.type === 'sync') {
    sync(msg.sources, { open: msg.open !== false });
    sendResponse({ started: true });
  } else if (msg?.type === 'open-dashboard') {
    openDashboard().then(() => sendResponse({ ok: true }));
    return true;
  } else if (msg?.type === 'read-pages' && sender.url?.startsWith(DASHBOARD)) {
    // Approved Canvas pages are read inside a Canvas tab, like the sync.
    runInSite('canvas', readCanvasPages, { pages: msg.pages || [] })
      .then(sendResponse, e => sendResponse({ error: String(e.message || e) }));
    return true;
  } else if (msg?.type === 'progress' && ['canvas', 'myu'].includes(msg.source)) {
    setSync({ [msg.source]: { status: 'running', message: msg.message } });
  }
  return false;
});

// Development bridge. It is inactive in the published extension, which has no
// externally_connectable entry. To preview your own synced data on
// localhost:5178, add that entry to your local manifest.json (never commit it).
// The bridge never exposes settings (API keys) or cached syllabus text.
const STORAGE_KEYS = ['canvas', 'myu', 'polish', 'confirmed', 'sample', 'syncState', 'triage', 'approvals', 'uploads', 'tour'];
const DEV_ORIGINS = ['http://localhost:5178', 'http://127.0.0.1:5178'];
chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  if (!DEV_ORIGINS.includes(sender.origin)) return false;
  const keys = k => [].concat(k ?? STORAGE_KEYS).filter(x => STORAGE_KEYS.includes(x));
  if (msg?.type === 'sync') {
    sync(msg.sources, { open: !!msg.open });
    sendResponse({ started: true });
  } else if (msg?.type === 'storage-get') {
    chrome.storage.local.get(keys(msg.keys)).then(sendResponse);
    return true;
  } else if (msg?.type === 'storage-set') {
    const patch = Object.fromEntries(Object.entries(msg.data || {}).filter(([k]) => STORAGE_KEYS.includes(k)));
    chrome.storage.local.set(patch).then(() => sendResponse({ ok: true }));
    return true;
  } else if (msg?.type === 'storage-remove') {
    chrome.storage.local.remove(keys(msg.keys)).then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});

chrome.runtime.onConnectExternal.addListener(port => {
  if (!DEV_ORIGINS.includes(port.sender?.origin)) { port.disconnect(); return; }
  const forward = changes => {
    const picked = Object.fromEntries(Object.entries(changes).filter(([k]) => STORAGE_KEYS.includes(k)));
    try {
      if (Object.keys(picked).length) port.postMessage({ type: 'changed', keys: Object.keys(picked) });
    } catch {
      chrome.storage.onChanged.removeListener(forward);
    }
  };
  chrome.storage.onChanged.addListener(forward);
  port.onDisconnect.addListener(() => {
    // Reading lastError marks it handled; a preview tab going into the
    // back/forward cache closes the port and is not an error.
    void chrome.runtime.lastError;
    chrome.storage.onChanged.removeListener(forward);
  });
});
