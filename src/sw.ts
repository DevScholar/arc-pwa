// Service Worker for @devscholar/arc-pwa
// Registered with { type: 'module' } — built as an ES module by Vite.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sw = self as any;

// ---------------------------------------------------------------------------
// MIME types
// ---------------------------------------------------------------------------

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.cjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.wasm': 'application/wasm',
  '.pdf': 'application/pdf',
  '.map': 'application/json',
};

function getMimeType(path: string): string {
  const ext = path.match(/\.[^./]+$/)?.[0]?.toLowerCase() ?? '';
  return MIME_TYPES[ext] ?? 'application/octet-stream';
}

// ---------------------------------------------------------------------------
// In-memory instance registry
// instanceId → (normalized path → file bytes)
// ---------------------------------------------------------------------------

const instances = new Map<string, Map<string, Uint8Array>>();

// ---------------------------------------------------------------------------
// Virtual URL prefix — computed once at module init.
// self.registration is a synchronous property on ServiceWorkerGlobalScope,
// so this is safe to evaluate before any event fires.
// ---------------------------------------------------------------------------

const _prefix: string = (() => {
  const scopePath = new URL(sw.registration.scope as string).pathname; // e.g. '/dist/'
  return scopePath + '__arc_pwa__/';
})();

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

sw.addEventListener('install', () => {
  sw.skipWaiting();
});

sw.addEventListener('activate', (event: { waitUntil(p: Promise<unknown>): void }) => {
  event.waitUntil(sw.clients.claim());
});

// ---------------------------------------------------------------------------
// Fetch interception
// ---------------------------------------------------------------------------

sw.addEventListener('fetch', (event: { request: Request; respondWith(r: Promise<Response>): void }) => {
  const url = new URL(event.request.url);
  const prefix = _prefix;

  if (!url.pathname.startsWith(prefix)) return; // pass through to network

  const rest = url.pathname.slice(prefix.length); // '{instanceId}/{filePath}'
  const slashIdx = rest.indexOf('/');

  let instanceId: string;
  let filePath: string;

  if (slashIdx === -1) {
    instanceId = rest;
    filePath = '/index.html';
  } else {
    instanceId = rest.slice(0, slashIdx);
    filePath = rest.slice(slashIdx) || '/index.html';
  }

  event.respondWith(serveFile(instanceId, filePath));
});

async function serveFile(instanceId: string, path: string): Promise<Response> {
  const files = instances.get(instanceId);
  if (!files) {
    return new Response(`ArcPWA: instance "${instanceId}" not found`, { status: 404 });
  }

  const data = resolveFile(files, path);
  if (!data) {
    return new Response(`ArcPWA: file not found: ${path}`, { status: 404 });
  }

  return new Response(data as unknown as BodyInit, {
    status: 200,
    headers: { 'Content-Type': getMimeType(path) },
  });
}

function resolveFile(files: Map<string, Uint8Array>, path: string): Uint8Array | undefined {
  // 1. Exact match
  let data = files.get(path);
  if (data) return data;

  // 2. Append /index.html for directory-like paths
  const withIndex = path.replace(/\/?$/, '/index.html');
  data = files.get(withIndex);
  if (data) return data;

  // 3. Try appending .html for extension-less paths
  if (!path.includes('.')) {
    data = files.get(path + '.html');
    if (data) return data;
  }

  // 4. SPA fallback: serve root index.html
  return files.get('/index.html');
}

// ---------------------------------------------------------------------------
// Message handling
// ---------------------------------------------------------------------------

interface MessageEventLike {
  data: { type: string; instanceId: string; [key: string]: unknown };
  ports: { postMessage(data: unknown): void }[];
}

// Make this file an ES module (required for Vite ESM output and { type: 'module' } SW).
export {};

sw.addEventListener('message', (event: MessageEventLike) => {
  const { type, instanceId } = event.data;
  const port = event.ports[0];

  switch (type) {
    case 'REGISTER_INSTANCE': {
      const entries = event.data['entries'] as [string, Uint8Array][];
      instances.set(instanceId, new Map(entries));
      port?.postMessage({ ok: true });
      break;
    }

    case 'WRITE_FILE': {
      const path = event.data['path'] as string;
      const data = event.data['data'] as Uint8Array | null;
      const map = instances.get(instanceId);
      if (map) {
        if (data === null) {
          map.delete(path);
        } else {
          map.set(path, data);
        }
      }
      port?.postMessage({ ok: true });
      break;
    }

    case 'UNREGISTER_INSTANCE': {
      instances.delete(instanceId);
      port?.postMessage({ ok: true });
      break;
    }

    default:
      port?.postMessage({ ok: false, error: `Unknown message type: ${type}` });
  }
});
