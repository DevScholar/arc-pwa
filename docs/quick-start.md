# Quick Start

Get a PWA running from a ZIP archive in under five minutes.

## 1. Install

```bash
npm install @devscholar/arc-pwa
```

## 2. Package your PWA

Zip up your build output. The archive must have an `index.html` at its root.

```bash
# From your dist/ folder:
zip -r my-app.pwa.zip .
```

Or use Node.js:

```js
import { zipSync, strToU8 } from 'fflate';
import { readFileSync, writeFileSync } from 'fs';

const zip = zipSync({
  'index.html': new Uint8Array(readFileSync('dist/index.html')),
  'app.js':     new Uint8Array(readFileSync('dist/app.js')),
});
writeFileSync('my-app.pwa.zip', zip);
```

## 3. Add the element

**With a bundler (Vite, webpack, etc.) — recommended:**

```js
// main.js / main.ts
import '@devscholar/arc-pwa'; // registers <arc-pwa> as a side effect
```

```html
<arc-pwa archive="my-app.pwa.zip" src="index.html" style="width:100%;height:600px"></arc-pwa>
```

The bundler automatically copies `arc-pwa-sw.js` alongside your output bundle — no extra configuration needed.

**Via CDN (no bundler):**

Download `arc-pwa-sw.js` from the package and host it yourself (the SW must be same-origin). Then tell the library where to find it before the element connects:

```html
<script type="module">
  import { configure } from 'https://cdn.jsdelivr.net/npm/@devscholar/arc-pwa/dist/arc-pwa.js';
  configure({ swUrl: '/static/arc-pwa-sw.js' });
</script>

<arc-pwa archive="my-app.pwa.zip" src="index.html" style="width:100%;height:600px"></arc-pwa>
```

## 4. React to load events

```js
const pwa = document.querySelector('arc-pwa');

pwa.addEventListener('load', () => {
  console.log('App is running!');
});

pwa.addEventListener('error', (e) => {
  console.error('Failed to load:', e.message);
});
```

## 5. Read and write files at runtime

```js
pwa.addEventListener('load', async () => {
  const fs = pwa.fs;

  // Read a file from the archive
  const config = await fs.readFile('/config.json', 'utf-8');

  // Write a file (visible to the running app on next fetch)
  await fs.writeFile('/user-data.json', JSON.stringify({ name: 'Alice' }));

  // List all files
  console.log(fs.listFiles());

  // Export the modified archive as a ZIP for download
  const blob = new Blob([fs.exportZip()], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  // attach url to an <a download="..."> element
});
```

## Requirements

- Chrome 80+, Firefox 116+, or Safari 16.4+ (ES module Service Worker support)
- Page must be served over **HTTPS** or **localhost**

## Next steps

- See [README](../README.md) for the full API reference
- Multiple `<arc-pwa>` elements can run on the same page simultaneously — each is isolated
