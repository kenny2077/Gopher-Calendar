import { relativeAgo } from '../lib/time.js';

const $ = id => document.getElementById(id);

async function render() {
  const { syncState = {}, canvas, myu, sample } = await chrome.storage.local.get(['syncState', 'canvas', 'myu', 'sample']);
  for (const [key, data, idle] of [['canvas', canvas, 'deadlines'], ['myu', myu, 'class times']]) {
    const s = syncState[key] || {};
    const el = $(`src-${key}`).querySelector('.state');
    el.className = 'state';
    if (s.status === 'running') { el.classList.add('run'); el.textContent = `${s.message || 'syncing'}…`; }
    else if (s.status === 'error') { el.classList.add('err'); el.textContent = s.message; }
    else if (data && !sample) { el.classList.add('ok'); el.textContent = `synced ${relativeAgo(data.fetchedAt)}`; }
    else el.textContent = idle;
  }
  $('sync').disabled = !!syncState.running;
  $('sync').textContent = syncState.running ? 'Syncing…' : 'Sync and open calendar';
}

$('sync').addEventListener('click', () => chrome.runtime.sendMessage({ type: 'sync', open: true }));
$('open').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'open-dashboard' });
  window.close();
});
chrome.storage.onChanged.addListener(render);
render();
