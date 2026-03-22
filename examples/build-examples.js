/**
 * Build example .pwa.zip files into examples/basic/
 *
 * Run: node examples/build-examples.js
 */
import { zipSync, strToU8 } from 'fflate';
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { resolve } from 'path';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// ---------------------------------------------------------------------------
// Counter app
// ---------------------------------------------------------------------------

const counterHtml = /* html */`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Counter</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div class="app">
    <h1>Counter</h1>
    <img src="clock.svg" alt="clock" style="display:block;margin:0 auto .5rem" />
    <p id="count" class="count">0</p>
    <div class="buttons">
      <button id="dec">−</button>
      <button id="inc">＋</button>
      <button id="reset">Reset</button>
    </div>
    <p class="nav"><a href="history.html">📖 History of counting</a></p>
  </div>
  <script src="app.js"></script>
</body>
</html>
`;

const counterCss = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: system-ui, sans-serif;
  background: #f0f4f8;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
}

.app {
  background: #fff;
  border-radius: 16px;
  padding: 2rem 3rem;
  box-shadow: 0 4px 24px rgba(0,0,0,.10);
  text-align: center;
}

h1 { font-size: 1.4rem; color: #555; margin-bottom: 1rem; }

.count {
  font-size: 5rem;
  font-weight: 700;
  color: #2563eb;
  line-height: 1;
  margin-bottom: 1.5rem;
  min-width: 3ch;
}

.buttons { display: flex; gap: .75rem; justify-content: center; }

.nav { margin-top: 1.5rem; }
.nav a { color: #2563eb; font-size: .9rem; text-decoration: none; }
.nav a:hover { text-decoration: underline; }

button {
  font-size: 1.5rem;
  padding: .4rem 1.2rem;
  border: none;
  border-radius: 8px;
  background: #2563eb;
  color: #fff;
  cursor: pointer;
  transition: background .15s;
}
button:hover { background: #1d4ed8; }
button#reset { font-size: 1rem; background: #64748b; }
button#reset:hover { background: #475569; }
`;

const counterJs = `
let count = 0;
const el = document.getElementById('count');

document.getElementById('inc').addEventListener('click', () => {
  count++;
  el.textContent = count;
});
document.getElementById('dec').addEventListener('click', () => {
  count--;
  el.textContent = count;
});
document.getElementById('reset').addEventListener('click', () => {
  count = 0;
  el.textContent = count;
});
`;

const historyHtml = /* html */`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>History of Counting</title>
  <link rel="stylesheet" href="style.css" />
  <style>
    .article { max-width: 480px; text-align: left; }
    .article h1 { font-size: 1.4rem; margin-bottom: 1.2rem; }
    .article h2 { font-size: 1rem; color: #2563eb; margin: 1.2rem 0 .4rem; }
    .article p  { font-size: .92rem; line-height: 1.6; color: #334155; }
    .article ul { font-size: .92rem; line-height: 1.8; color: #334155; padding-left: 1.2rem; }
  </style>
</head>
<body>
  <div class="app article">
    <h1>📖 History of the Counter</h1>

    <h2>Tally marks (~40,000 BC)</h2>
    <p>The earliest counting tool was the human hand, quickly followed by tally marks scratched
    on bone. The <em>Lebombo bone</em> (~43,000 BC) and the <em>Ishango bone</em> (~20,000 BC)
    are among the oldest known counting artifacts.</p>

    <h2>Abacus (~2,700 BC)</h2>
    <p>Sumerian merchants used counting boards with grooves and pebbles. The familiar bead-frame
    abacus appeared in China around 200 BC and is still in use today.</p>

    <h2>Mechanical counter (17th century)</h2>
    <p>Blaise Pascal built the <em>Pascaline</em> in 1642 — a gear-driven adding machine. Its
    odometer-style digit wheels are the direct ancestor of every physical tally counter.</p>

    <h2>Tally counter (19th century)</h2>
    <p>The handheld clicker counter was patented in the 1800s and became standard equipment for
    census workers, sports officials, and factory floor supervisors worldwide.</p>

    <h2>Digital counters (20th century)</h2>
    <ul>
      <li>1940s — vacuum-tube decade counters in lab instruments.</li>
      <li>1960s — transistor &amp; IC counters replace tubes.</li>
      <li>1970s — 7-segment LED displays make the count visible.</li>
      <li>1990s — software counters replace hardware for most use cases.</li>
    </ul>

    <h2>This counter (today)</h2>
    <p>You are running a counter PWA served entirely from a ZIP archive in memory, intercepted
    by a Service Worker, with zero server round-trips. Peak human achievement.</p>

    <p class="nav" style="margin-top:1.8rem"><a href="index.html">← Back to counter</a></p>
  </div>
</body>
</html>
`;

const clockSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="120" height="120">
  <circle cx="50" cy="50" r="46" fill="#fff" stroke="#2563eb" stroke-width="4"/>
  <circle cx="50" cy="50" r="3" fill="#1e293b"/>
  <!-- hour marks -->
  <line x1="50" y1="10" x2="50" y2="18" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
  <line x1="50" y1="82" x2="50" y2="90" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
  <line x1="10" y1="50" x2="18" y2="50" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
  <line x1="82" y1="50" x2="90" y2="50" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
  <!-- hour hand (pointing ~10 o'clock) -->
  <line x1="50" y1="50" x2="30" y2="28" stroke="#1e293b" stroke-width="4" stroke-linecap="round"/>
  <!-- minute hand (pointing ~2 o'clock) -->
  <line x1="50" y1="50" x2="68" y2="22" stroke="#2563eb" stroke-width="3" stroke-linecap="round"/>
  <!-- second hand -->
  <line x1="50" y1="50" x2="54" y2="75" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/>
</svg>`;

const counterZip = zipSync({
  'index.html':   strToU8(counterHtml),
  'history.html': strToU8(historyHtml),
  'style.css':    strToU8(counterCss),
  'app.js':       strToU8(counterJs),
  'clock.svg':    strToU8(clockSvg),
});

// ---------------------------------------------------------------------------
// Write output
// ---------------------------------------------------------------------------

const outDir = resolve(__dirname, 'basic');
mkdirSync(outDir, { recursive: true });

writeFileSync(resolve(outDir, 'counter.pwa.zip'), counterZip);
console.log('Built: examples/basic/counter.pwa.zip');
