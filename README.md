# ArcPWA

⚠️ This project is in Pre-Alpha stage. Except breaking changes.

ArcPWA (short for Archivable PWA) runs a PWA directly from a ZIP archive, serving as a modern alternative to Web Bundles.

```html
<arc-pwa archive="my-app.pwa.zip" src="index.html" style="width:100%;height:600px"></arc-pwa>
```

## How it works

1. The `<arc-pwa>` element fetches and decompresses the ZIP into memory with [fflate](https://github.com/101arrowz/fflate).
2. A Service Worker is automatically registered. It intercepts requests under a virtual URL prefix and serves files from the in-memory archive.
3. An `<iframe>` is created pointing at the virtual entry URL. The app runs exactly as it would from a real server — relative imports, CSS, images and all.

Nothing is written to disk or IndexedDB. All file data lives in memory.

## Requirements

- Chrome 80+, Firefox 116+, Safari 16.4+ (ES module Service Worker support)
- Page must be served over **HTTPS** or **localhost**

## Install

```bash
npm install @devscholar/arc-pwa
```

## Usage

**With a bundler (Vite, webpack, etc.):**

```js
import '@devscholar/arc-pwa'; // registers <arc-pwa> as a side effect
```

```html
<arc-pwa archive="app.pwa.zip" src="index.html" style="width:100%;height:500px"></arc-pwa>

<script type="module">
  const pwa = document.querySelector('arc-pwa');
  pwa.addEventListener('load', () => console.log('Running!', pwa.contentWindow));
  pwa.addEventListener('error', (e) => console.error('Failed:', e.message));
</script>
```

The bundler copies `arc-pwa-sw.js` next to your output automatically via the `new URL(...)` pattern.

**Via CDN (no bundler):**

The Service Worker must be same-origin — download `arc-pwa-sw.js` and host it yourself, then call `configure()` before any element connects:

```html
<script type="module">
  import { configure } from 'https://cdn.jsdelivr.net/npm/@devscholar/arc-pwa/dist/arc-pwa.js';
  configure({ swUrl: '/static/arc-pwa-sw.js' });
</script>
```

## Documentation

- [Quick Start](docs/quick-start.md)
- [Element API — `<arc-pwa>`](docs/element.md)
- [File System API — `ArcFS`](docs/fs.md)

## Development

```bash
npm install
node examples/build-examples.js   # build example ZIPs
npm run dev                        # Vite dev server → http://localhost:3000/examples/basic/
npm run build                      # production build → dist/
npm run typecheck
```

## Architecture

```
Browser page
│
├── <arc-pwa> element
│   ├── fetches & decompresses .pwa.zip with fflate (in memory)
│   ├── registers arc-pwa-sw.js as an ES module Service Worker
│   ├── sends file map to SW via MessageChannel
│   └── creates <iframe src="/{scope}__arc_pwa__/{instanceId}/index.html">
│
└── arc-pwa-sw.js  (Service Worker)
    ├── intercepts fetch for /{scope}__arc_pwa__/{instanceId}/*
    ├── looks up file in its in-memory instance map
    └── returns Response with correct Content-Type
```

Multiple `<arc-pwa>` elements can run simultaneously — each has its own `instanceId` and isolated file map.

## Browser extension (planned)

See [arc-pwa-ext](https://github.com/DevScholar/arc-pwa-ext) for details.

## License

MIT
