import { unzip } from 'fflate';

/**
 * Fetch a .pwa.zip archive and decompress it into an in-memory file map.
 * All paths are normalized to start with `/`.
 *
 * Decompression runs off the main thread via fflate's async `unzip` so
 * large archives do not block the UI. Pass an AbortSignal to cancel both
 * the network request and any in-progress decompression.
 *
 * @param onProgress - called during download with (bytesLoaded, totalBytes).
 *   totalBytes is 0 when the server does not send Content-Length.
 */
export async function loadArchive(
  url: string,
  signal?: AbortSignal,
  onProgress?: (loaded: number, total: number) => void,
): Promise<Map<string, Uint8Array>> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`ArcPWA: failed to fetch archive "${url}": ${response.status} ${response.statusText}`);
  }

  const total = Number(response.headers.get('content-length')) || 0;
  let buffer: Uint8Array;

  if (onProgress && response.body) {
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (signal?.aborted) throw abortError(signal);
      if (done) break;
      chunks.push(value);
      loaded += value.byteLength;
      onProgress(loaded, total);
    }
    buffer = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
  } else {
    const ab = await response.arrayBuffer();
    // Re-check after the await in case the signal fired while the body was downloading.
    if (signal?.aborted) throw abortError(signal);
    buffer = new Uint8Array(ab);
  }

  const decompressed = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
    const terminator = unzip(buffer, (err, data) => {
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
