// chrome.* stand-in so the dashboard runs on localhost.
// With ?ext=<extension id> it talks to the installed extension through its
// localhost bridge (real synced data). Without it, data lives in localStorage.
(() => {
  const extId = new URLSearchParams(location.search).get('ext');
  const listeners = [];
  const emit = keys => setTimeout(() => listeners.forEach(fn => fn(Object.fromEntries(keys.map(k => [k, {}])), 'local')), 0);
  const runtime = {
    getURL: p => new URL(`../extension/${p}`, location.href).href,
    sendMessage: async msg => extId ? window.__realChrome.runtime.sendMessage(extId, msg) : console.log('[preview] message', msg),
  };
  let local;
  if (extId) {
    const real = window.chrome;
    window.__realChrome = real;
    const send = msg => new Promise(res => real.runtime.sendMessage(extId, msg, reply => { void real.runtime.lastError; res(reply); }));
    local = {
      get: keys => send({ type: 'storage-get', keys }),
      set: data => send({ type: 'storage-set', data }),
      remove: keys => send({ type: 'storage-remove', keys }),
    };
    const port = real.runtime.connect(extId);
    port.onMessage.addListener(m => m.type === 'changed' && emit(m.keys));
    // Close the port before the page is cached so Chrome doesn't log an error.
    addEventListener('pagehide', () => port.disconnect());
  } else {
    const KEY = 'umn-cal-preview';
    const read = () => JSON.parse(localStorage.getItem(KEY) || '{}');
    const write = (d, keys) => { localStorage.setItem(KEY, JSON.stringify(d)); emit(keys); };
    const pick = (d, keys) => keys == null ? d : Object.fromEntries([].concat(keys).filter(k => k in d).map(k => [k, d[k]]));
    local = {
      get: async keys => structuredClone(pick(read(), keys)),
      set: async obj => { const d = read(); Object.assign(d, structuredClone(obj)); write(d, Object.keys(obj)); },
      remove: async keys => { const d = read(); [].concat(keys).forEach(k => delete d[k]); write(d, [].concat(keys)); },
    };
  }
  window.chrome = { storage: { local, onChanged: { addListener: fn => listeners.push(fn) } }, runtime };
})();
