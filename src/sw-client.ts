// Dev:  Vite plugin serves src/sw.ts at /arc-pwa-sw.js  → scope = /
// Prod: SW is co-located with arc-pwa.js in dist/       → scope = /dist/ (or wherever)
let _swUrl: string = import.meta.env.DEV
  ? '/arc-pwa-sw.js'
  : new URL(import.meta.url).href.replace(/[^/]*$/, 'arc-pwa-sw.js');

/**
 * Override the Service Worker URL before any <arc-pwa> element is connected.
 * Required for CDN usage, where the SW must be same-origin and therefore
 * cannot be loaded from the CDN directly.
 *
 * @example
 * import { configure } from '@devscholar/arc-pwa';
 * configure({ swUrl: '/static/arc-pwa-sw.js' });
 */
export function configure(options: { swUrl?: string }): void {
  if (options.swUrl !== undefined) {
    _swUrl = options.swUrl;
    // Reset cached ARC_BASE so it is recomputed on next use
    _arcBase = computeArcBase();
    // Reset SW promise so next ensureSW() re-registers with the new URL
    _ensurePromise = null;
  }
}

// Derive the virtual URL prefix from the SW file's directory so it always
// matches the SW scope regardless of deployment path.
// Dev  → /__arc_pwa__/
// Prod → /dist/__arc_pwa__/  (or /__arc_pwa__/ at root, etc.)
function computeArcBase(): string {
  const swPath = new URL(_swUrl, location.href).pathname;
  const dir = swPath.slice(0, swPath.lastIndexOf('/') + 1);
  return dir + '__arc_pwa__/';
}
let _arcBase: string = computeArcBase();

export function getArcBase(): string {
  return _arcBase;
}

let _ensurePromise: Promise<void> | null = null;

/**
 * Register the service worker and wait until it controls this page.
 * Idempotent — safe to call multiple times.
 */
export async function ensureSW(): Promise<void> {
  if (_ensurePromise) return _ensurePromise;

  _ensurePromise = (async () => {
    if (!('serviceWorker' in navigator)) {
      throw new Error('ArcPWA: Service Workers are not supported in this browser.');
    }

    await navigator.serviceWorker.register(_swUrl, { type: 'module' });

    // Wait until a SW is actively controlling this page
    await waitForController();
  })();

  return _ensurePromise;
}

async function waitForController(): Promise<void> {
  if (navigator.serviceWorker.controller) return;

  // The SW called clients.claim() in its activate handler, so controllerchange
  // fires shortly after the SW activates — no page reload needed.
  return new Promise<void>((resolve) => {
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      () => resolve(),
      { once: true },
    );
  });
}

/**
 * Send a message to the active service worker and await its response
 * via a MessageChannel port. Rejects after 5 s if the SW never replies,
 * and always closes port1 so the port pair can be GC'd.
 */
export async function sendToSW(data: unknown): Promise<{ ok: boolean; [key: string]: unknown }> {
  const controller = navigator.serviceWorker.controller;
  if (!controller) throw new Error('ArcPWA: no active service worker controller');

  const { port1, port2 } = new MessageChannel();

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      port1.close();
      reject(new Error('ArcPWA: SW response timeout'));
    }, 5000);

    port1.onmessage = (e: MessageEvent) => {
      clearTimeout(timer);
      port1.close();
      const result = e.data as { ok: boolean; error?: string };
      if (result.ok) {
        resolve(result);
      } else {
        reject(new Error(result.error ?? 'SW error'));
      }
    };

    port1.onmessageerror = () => {
      clearTimeout(timer);
      port1.close();
      reject(new Error('ArcPWA: SW message deserialization error'));
    };

    controller.postMessage(data, [port2]);
  });
}
