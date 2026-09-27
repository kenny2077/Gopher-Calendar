// chrome.* stand-in for the public demo. Storage lives in memory and starts
// with the sample semester; only the "tour seen" flag is remembered between
// visits. Nothing here talks to Canvas, MyU or any AI provider.
window.__GOPHER_DEMO__ = true;
(() => {
  const TOUR_KEY = 'gopher-demo-tour';
  const data = {};
  const listeners = [];
  const emit = keys => setTimeout(() => listeners.forEach(fn => fn(Object.fromEntries(keys.map(k => [k, {}])), 'local')), 0);
  const pick = keys => (keys == null ? { ...data } : Object.fromEntries([].concat(keys).filter(k => k in data).map(k => [k, data[k]])));
  try { if (localStorage.getItem(TOUR_KEY)) data.tour = { done: true }; } catch {}
  window.chrome = {
    storage: {
      local: {
        get: async keys => structuredClone(pick(keys)),
        set: async obj => {
          Object.assign(data, structuredClone(obj));
          if (obj.tour) { try { localStorage.setItem(TOUR_KEY, '1'); } catch {} }
          emit(Object.keys(obj));
        },
        remove: async keys => { [].concat(keys).forEach(k => delete data[k]); emit([].concat(keys)); },
      },
      onChanged: { addListener: fn => listeners.push(fn) },
    },
    runtime: {
      getURL: p => new URL(p, location.href).href,
      sendMessage: async () => ({}),
    },
  };
})();
