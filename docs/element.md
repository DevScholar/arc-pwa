# `<arc-pwa>` Element API

The `<arc-pwa>` custom element loads a PWA from a ZIP archive and renders it inside an iframe. Its interface is modelled after `<iframe>`.

## Registration

The element registers itself when the module is imported. With a bundler:

```js
import '@devscholar/arc-pwa';
```

For CDN usage, the Service Worker must be same-origin. Host `arc-pwa-sw.js` yourself and call `configure()` before the first element connects:

```js
import { configure } from 'https://cdn.jsdelivr.net/npm/@devscholar/arc-pwa/dist/arc-pwa.js';
configure({ swUrl: '/static/arc-pwa-sw.js' });
```

## Attributes

| Attribute | Required | Default | Description |
|-----------|----------|---------|-------------|
| `archive` | ✓ | — | URL to the `.pwa.zip` file |
| `src` | | `index.html` | Entry-point path within the archive |

Changing either attribute on a connected element reloads the archive.

```html
<arc-pwa archive="app.pwa.zip" src="index.html" style="width:100%;height:500px"></arc-pwa>
```

## Properties

### `fs`

Type: `ArcFS | null`

An [`ArcFS`](fs.md) instance for reading and writing files inside the running archive. Available after the `load` event fires; `null` before that.

```js
pwa.addEventListener('load', async () => {
  const config = await pwa.fs.readFile('/config.json', 'utf-8');
});
```

### `contentWindow`

Type: `WindowProxy | null`

The `contentWindow` of the inner `<iframe>`. Use this to post messages to the running app.

```js
pwa.addEventListener('load', () => {
  pwa.contentWindow.postMessage({ type: 'ping' }, '*');
});
```

## Events

### `load`

Fires when the archive has been fetched, decompressed, registered with the Service Worker, and the iframe has been pointed at the entry URL.

```js
pwa.addEventListener('load', () => {
  console.log('App is running');
  console.log(pwa.fs.listFiles());
});
```

### `error`

Fires as an `ErrorEvent` if any step fails (network error, invalid ZIP, SW registration failure, etc.).

```js
pwa.addEventListener('error', (e) => {
  console.error(e.message);  // human-readable description
  console.error(e.error);    // original Error object
});
```

## Multiple instances

Any number of `<arc-pwa>` elements can run on the same page at the same time. Each element gets its own `instanceId` and an isolated file map in the Service Worker — they cannot access each other's files.

```html
<arc-pwa archive="todo.pwa.zip"    style="width:50%;height:400px;float:left"></arc-pwa>
<arc-pwa archive="calendar.pwa.zip" style="width:50%;height:400px;float:left"></arc-pwa>
```

## Sandbox

The inner iframe is created with the following `sandbox` attribute:

```
allow-scripts allow-same-origin allow-forms allow-popups
```

`allow-same-origin` is required so the SW can intercept the iframe's requests (both must share the same origin). `allow-scripts` lets the app run JavaScript.

## Navigation & routing

The Service Worker handles all requests within the virtual scope, so client-side navigation and `fetch()` calls from inside the iframe work normally. If a path is not found in the archive, the SW falls back to `/index.html`, which means SPA frameworks (React Router, Vue Router, etc.) work out of the box.

Fallback resolution order:

1. Exact path match
2. `{path}/index.html` (directory index)
3. `{path}.html` (extension-less pretty URLs)
4. `/index.html` (SPA fallback)
