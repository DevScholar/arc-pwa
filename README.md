# ArcPWA

⚠️ This project is in Alpha stage and breaking changes may occur.

ArcPWA (Archivable PWA) is a modern alternative to the deprecated Web Bundles specification, allowing for users to distribute PWA apps as a compressed file offline.

# Browser extension

For opening `.pwa.zip` files directly in the browser (without embedding), see [ArcPWA Extension](https://github.com/DevScholar/arc-pwa-ext).

# Usage

## Embedding a PWA in a webpage

## Step 1 — Create a .pwa.zip

Zip the **root** of your built PWA (the folder that contains `index.html`):

```bash
# e.g. your build output is in dist/
cd my-app/dist
zip -r ../my-app.pwa.zip .
```

`index.html` must be at the top level of the zip. That's it.

## Step 2 — Add to your Vite project

```bash
npm install @devscholar/arc-pwa
```

`index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>My App</title>
  <script type="module" src="./main.js"></script>
</head>
<body>
  <arc-pwa archive="my-app.pwa.zip" style="width:100%;height:100vh;display:block"></arc-pwa>
</body>
</html>
```

`main.js`:

```js
import '@devscholar/arc-pwa';
```

Put `my-app.pwa.zip` in the same folder as `index.html`. Vite copies `arc-pwa-sw.js` to your output automatically — no extra config needed.

## Requirements

- Chrome 80+, Firefox 116+, Safari 16.4+
- Page served over **HTTPS** or **localhost** (Not required by the ArcPWA Extension)


## Development

```bash
npm install
node examples/build-examples.js   # build example ZIPs
npm run dev                        # Vite dev server → http://localhost:3000/examples/basic/
npm run build                      # production build → dist/
npm run typecheck
```

## License

MIT
