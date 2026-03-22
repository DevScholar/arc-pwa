import { unzip } from 'fflate';

/**
 * Fetch a .pwa.zip archive and decompress it into an in-memory file map.
 * All paths are normalized to start with `/`.
 *
 * Decompression runs off the main thread via fflate's async `unzip` so
 * large archives do not block the UI. Pass an AbortSignal to cancel both
 * the network request and any in-progress decompression.
 */
export async function loadArchive(url: string, signal?: AbortSignal): Promise<Map<string, Uint8Array>> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`ArcPWA: failed to fetch archive "${url}": ${response.status} ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();

  // Re-check after the await in case the signal fired while the body was downloading.
  if (signal?.aborted) throw abortError(signal);

  const decompressed = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
    const terminator = unzip(new Uint8Array(buffer), (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });

    // Cancel the decompression worker too if the signal fires.
    signal?.addEventListener('abort', () => {
      terminator(); // AsyncTerminable is a callable that stops the worker
      reject(abortError(signal));
    }, { once: true });
  });

  const files = new Map<string, Uint8Array>();
  for (const [filePath, data] of Object.entries(decompressed)) {
    if (filePath.endsWith('/')) continue; // skip directory entries
    files.set('/' + filePath.replace(/^\/+/, ''), data);
  }

  return files;
}

function abortError(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('Load aborted', 'AbortError');
}
