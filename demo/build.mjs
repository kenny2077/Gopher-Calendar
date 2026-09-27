// Builds the static demo for GitHub Pages into _site/: the real calendar page
// and libraries from extension/, plus a demo shim and the sample semester.
// Run: npm run build:demo
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const out = new URL('_site/', root);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

for (const dir of ['dashboard', 'lib', 'fonts', 'icons']) {
  cpSync(new URL(`extension/${dir}`, root), new URL(dir, out), { recursive: true });
}
// pdf.js is only needed for reading syllabi, which the demo never does.
cpSync(new URL('demo/demo-shim.js', root), new URL('demo-shim.js', out));
cpSync(new URL('demo/seed.js', root), new URL('lib/demo-seed.js', out));

const page = readFileSync(new URL('extension/dashboard/dashboard.html', root), 'utf8')
  .replace('<title>Semester calendar</title>', '<title>Gopher Calendar · live demo</title>\n<meta name="description" content="Canvas deadlines and MyU classes in one semester calendar. A live demo with a sample semester.">')
  .replace('href="../icons/icon-32.png"', 'href="icons/icon-32.png"')
  .replace('href="dashboard.css"', 'href="dashboard/dashboard.css"')
  .replace('<script type="module" src="dashboard.js"></script>',
    '<script src="demo-shim.js"></script>\n<script type="module">\n  await import("./lib/demo-seed.js");\n  await import("./dashboard/dashboard.js");\n</script>');
writeFileSync(new URL('index.html', out), page);
writeFileSync(new URL('.nojekyll', out), '');
console.log('Demo built in _site/');
