// Builds the Chrome Web Store upload: dist/gopher-calendar-v<version>.zip.
// Only the files the extension runs are copied (an allowlist), so local
// secrets like extension/config.local.json can never end up in a release.
// Run: npm run package
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const ext = `${root}extension/`;
const INCLUDE = ['manifest.json', 'background.js', 'dashboard', 'lib', 'popup', 'icons', 'fonts', 'vendor'];
// Local secrets and OS/editor junk never ship.
const SKIP = /(^|\/)(\.DS_Store|Thumbs\.db|\._[^/]*|config\.[^/]*\.json|[^/]*\.(swp|map))$/;

const fail = msg => { console.error(`package: ${msg}`); process.exit(1); };
const manifest = JSON.parse(readFileSync(`${ext}manifest.json`, 'utf8'));
const { version } = JSON.parse(readFileSync(`${root}package.json`, 'utf8'));

// Release checks: these are what a store reviewer or a student would trip on.
if (manifest.version !== version) fail(`manifest.json is ${manifest.version} but package.json is ${version}`);
if (manifest.externally_connectable) fail('externally_connectable is the localhost dev bridge and must not ship');
if (manifest.key) fail('remove "key" from manifest.json; the store assigns the ID');
for (const f of ['pdf.min.mjs', 'pdf.worker.min.mjs']) {
  if (!existsSync(`${ext}vendor/${f}`)) fail(`extension/vendor/${f} is missing; run npm install && npm run vendor`);
}

const stage = `${root}dist/stage/`;
const zip = `${root}dist/gopher-calendar-v${version}.zip`;
rmSync(`${root}dist`, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
for (const entry of INCLUDE) {
  cpSync(`${ext}${entry}`, `${stage}${entry}`, { recursive: true, filter: src => !SKIP.test(src) });
}

const files = [];
const walk = dir => readdirSync(dir).forEach(n => {
  const p = `${dir}/${n}`;
  statSync(p).isDirectory() ? walk(p) : files.push(p.slice(stage.length));
});
walk(stage.replace(/\/$/, ''));
if (files.some(f => SKIP.test(f))) fail('a skipped file slipped into the package');

// Every file the manifest names must be in the package, or Chrome refuses it.
const named = [
  ...Object.values(manifest.icons || {}), ...Object.values(manifest.action?.default_icon || {}),
  manifest.background?.service_worker, manifest.action?.default_popup, manifest.options_page,
  manifest.options_ui?.page, manifest.side_panel?.default_path,
  ...(manifest.content_scripts || []).flatMap(c => [...(c.js || []), ...(c.css || [])]),
  ...(manifest.web_accessible_resources || []).flatMap(w => w.resources || []).filter(r => !r.includes('*')),
].filter(Boolean);
for (const p of named) if (!files.includes(p.replace(/^\//, ''))) fail(`manifest.json names ${p}, which is not in the package (add it to INCLUDE)`);

// -X drops macOS extra attributes; -D leaves out directory entries.
try {
  execFileSync('zip', ['-q', '-r', '-X', '-D', zip, '.'], { cwd: stage });
} catch (e) {
  rmSync(`${root}dist`, { recursive: true, force: true });
  fail(e.code === 'ENOENT' ? 'the `zip` command is not installed' : `zip failed: ${e.message}`);
}
rmSync(stage, { recursive: true, force: true });
const kb = Math.round(statSync(zip).size / 1024);
console.log(`Packaged ${files.length} files (${kb} KB) into ${zip.slice(root.length)}`);
