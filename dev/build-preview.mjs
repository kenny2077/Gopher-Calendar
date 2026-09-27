// Writes dev/preview.html from the real dashboard.html with the chrome shim.
import { readFileSync, writeFileSync } from 'node:fs';
const src = readFileSync(new URL('../extension/dashboard/dashboard.html', import.meta.url), 'utf8');
const out = src
  .replace('href="dashboard.css"', 'href="../extension/dashboard/dashboard.css"')
  .replace('href="../icons/icon-32.png"', 'href="../extension/icons/icon-32.png"')
  .replace('<script type="module" src="dashboard.js"></script>',
    '<script src="chrome-shim.js"></script>\n<script type="module" src="../extension/dashboard/dashboard.js"></script>');
writeFileSync(new URL('./preview.html', import.meta.url), out);
console.log('dev/preview.html written');
