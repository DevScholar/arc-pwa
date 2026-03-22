# `ArcFS` — File System API

`ArcFS` is a Node `fs`-like API for reading and writing files inside a running archive. It is available as the `fs` property on `<arc-pwa>` after the `load` event fires.

All operations work against an **in-memory** copy of the archive. Every method has both a synchronous and an async form. Reads are identical in both forms. For writes, the sync form updates the in-memory Map immediately and syncs to the Service Worker in the background (fire-and-forget); the async form awaits the SW sync before resolving.

Nothing is persisted to disk or IndexedDB.

> **Memory note:** The decompressed archive is stored twice — once on the page side (this `ArcFS` instance) for synchronous reads, and once inside the Service Worker for serving iframe requests. A 10 MB decompressed archive therefore occupies ~20 MB total. This is a deliberate trade-off: the page-side copy enables the synchronous `readFileSync` API without a round-trip through the SW. If memory is a concern, avoid calling `readFileSync`/`readFile` on large binary assets from page code; let the iframe fetch them directly via the SW instead.

## Reading

### `readFileSync` / `readFile`

```ts
readFileSync(path: string): Uint8Array
readFileSync(path: string, encoding: 'utf-8'): string

readFile(path: string): Promise<Uint8Array>
readFile(path: string, encoding: 'utf-8'): Promise<string>
```

Returns the file contents as a `Uint8Array` or, when `encoding` is `'utf-8'`, as a decoded string. Throws `ENOENT` if the file does not exist.

```js
const bytes = fs.readFileSync('/assets/logo.png');
const html  = fs.readFileSync('/index.html', 'utf-8');

// async equivalents
const bytes = await fs.readFile('/assets/logo.png');
const html  = await fs.readFile('/index.html', 'utf-8');
```

### `readdirSync` / `readdir`

```ts
readdirSync(path: string): string[]
readdir(path: string): Promise<string[]>
```

Returns the names (not full paths) of all direct children of `path`, sorted alphabetically.

```js
fs.readdirSync('/')        // → ['app.js', 'assets', 'index.html']
fs.readdirSync('/assets')  // → ['logo.png', 'style.css']
```

### `statSync` / `stat`

```ts
statSync(path: string): { size: number; isDirectory(): boolean }
stat(path: string): Promise<{ size: number; isDirectory(): boolean }>
```

Returns basic metadata. Throws `ENOENT` if neither a file nor an implicit directory exists.

```js
const info = fs.statSync('/index.html');
info.size          // → 1024
info.isDirectory() // → false
```

### `existsSync` / `exists`

```ts
existsSync(path: string): boolean
exists(path: string): Promise<boolean>
```

Returns `true` if a file or directory exists at `path`. Never throws.

```js
fs.existsSync('/config.json')  // → true | false
```

### `listFiles()`

```ts
listFiles(): string[]
```

Returns the absolute paths of every file in the archive, sorted. Always synchronous.

```js
fs.listFiles()
// → ['/app.js', '/assets/logo.png', '/index.html']
```

## Writing

### `writeFileSync` / `writeFile`

```ts
writeFileSync(path: string, data: string | Uint8Array): void
writeFile(path: string, data: string | Uint8Array): Promise<void>
```

Creates or overwrites a file. Strings are encoded as UTF-8.

- **Sync**: local Map updated immediately; SW sync is fire-and-forget.
- **Async**: awaits SW sync before resolving — use this when you need to guarantee the iframe sees the new content on its very next fetch.

```js
fs.writeFileSync('/data/user.json', JSON.stringify({ name: 'Alice' }));
await fs.writeFile('/critical.json', data); // guaranteed before next fetch
```

### `mkdir(path)`

```ts
mkdir(path: string): Promise<void>
```

No-op. Directories are implicit in ZIP archives.

### `unlinkSync` / `unlink`

```ts
unlinkSync(path: string): void
unlink(path: string): Promise<void>
```

Deletes a file. Throws `ENOENT` if the file does not exist. Same sync/async semantics as `writeFile`.

```js
fs.unlinkSync('/data/old-cache.json');
```

## Exporting

### `exportZip()`

```ts
exportZip(): Uint8Array
```

Re-packs the current in-memory state (including any writes) back into a ZIP archive.

```js
const bytes = fs.exportZip();
const blob  = new Blob([bytes], { type: 'application/zip' });
const url   = URL.createObjectURL(blob);

const a = document.createElement('a');
a.href     = url;
a.download = 'my-app-modified.pwa.zip';
a.click();
```

`ArcFS` is a Node `fs`-like API for reading and writing files inside a running archive. It is available as the `fs` property on `<arc-pwa>` after the `load` event fires.

All operations work against an **in-memory** copy of the archive. Writes are synced to the Service Worker immediately, so subsequent requests from within the iframe reflect the updated content. Nothing is persisted to disk or IndexedDB.

## Reading

### `readFile(path)`

```ts
readFile(path: string): Promise<Uint8Array>
readFile(path: string, encoding: 'utf-8'): Promise<string>
```

Returns the file contents as a `Uint8Array` or, when `encoding` is `'utf-8'`, as a decoded string.

Throws `ENOENT` if the file does not exist.

```js
const bytes = await fs.readFile('/assets/logo.png');          // Uint8Array
const html  = await fs.readFile('/index.html', 'utf-8');      // string
```

### `readdir(path)`

```ts
readdir(path: string): Promise<string[]>
```

Returns the names (not full paths) of all direct children of `path`, sorted alphabetically. Includes both files and implicit subdirectories.

```js
await fs.readdir('/')           // → ['app.js', 'assets', 'index.html']
await fs.readdir('/assets')     // → ['logo.png', 'style.css']
```

### `stat(path)`

```ts
stat(path: string): Promise<{ size: number; isDirectory(): boolean }>
```

Returns basic metadata. Throws `ENOENT` if neither a file nor an implicit directory exists at `path`.

```js
const info = await fs.stat('/index.html');
info.size          // → 1024
info.isDirectory() // → false
```

### `exists(path)`

```ts
exists(path: string): Promise<boolean>
```

Returns `true` if a file or directory exists at `path`, `false` otherwise. Never throws.

```js
await fs.exists('/config.json')  // → true | false
```

### `listFiles()`

```ts
listFiles(): string[]
```

Returns the absolute paths of every file in the archive, sorted. Directories are implicit and are not listed.

```js
fs.listFiles()
// → ['/app.js', '/assets/logo.png', '/index.html']
```

## Writing

### `writeFile(path, data)`

```ts
writeFile(path: string, data: string | Uint8Array): Promise<void>
```

Creates or overwrites a file. Strings are encoded as UTF-8. The change is synced to the Service Worker so the running app sees it on its next `fetch`.

```js
await fs.writeFile('/data/user.json', JSON.stringify({ name: 'Alice' }));
await fs.writeFile('/generated.txt', new TextEncoder().encode('hello'));
```

### `mkdir(path)`

```ts
mkdir(path: string): Promise<void>
```

No-op. Directories are implicit in ZIP archives; creating one explicitly is never required.

### `unlink(path)`

```ts
unlink(path: string): Promise<void>
```

Deletes a file. Throws `ENOENT` if the file does not exist.

```js
await fs.unlink('/data/old-cache.json');
```

## Exporting

### `exportZip()`

```ts
exportZip(): Uint8Array
```

Re-packs the current in-memory state (including any writes) back into a ZIP archive. Useful for "Save" or download flows.

```js
const bytes = fs.exportZip();
const blob  = new Blob([bytes], { type: 'application/zip' });
const url   = URL.createObjectURL(blob);

const a = document.createElement('a');
a.href     = url;
a.download = 'my-app-modified.pwa.zip';
a.click();
```
