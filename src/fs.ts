import { zipSync } from 'fflate';
import { sendToSW } from './sw-client.js';

function normalizePath(path: string): string {
  return '/' + path.replace(/^\/+/, '');
}

function enoent(path: string): Error {
  return Object.assign(new Error(`ENOENT: no such file or directory: '${path}'`), {
    code: 'ENOENT',
  });
}

/**
 * Node fs-like API for reading and writing files within an ArcPWA archive.
 * Files are stored in memory; writes are synced to the Service Worker so
 * subsequent page requests inside the iframe reflect the changes.
 */
export class ArcFS {
  constructor(
    private readonly files: Map<string, Uint8Array>,
    private readonly instanceId: string,
  ) {}

  // --- Read ---

  readFileSync(path: string): Uint8Array;
  readFileSync(path: string, encoding: 'utf-8'): string;
  readFileSync(path: string, encoding?: 'utf-8'): Uint8Array | string {
    const p = normalizePath(path);
    const data = this.files.get(p);
    if (!data) throw enoent(path);
    return encoding === 'utf-8' ? new TextDecoder().decode(data) : data;
  }

  readFile(path: string): Promise<Uint8Array>;
  readFile(path: string, encoding: 'utf-8'): Promise<string>;
  async readFile(path: string, encoding?: 'utf-8'): Promise<Uint8Array | string> {
    return this.readFileSync(path, encoding as 'utf-8');
  }

  // --- Write ---

  writeFileSync(path: string, data: string | Uint8Array): void {
    const p = normalizePath(path);
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    this.files.set(p, bytes);
    // Sync to SW asynchronously (fire-and-forget); local Map is already updated.
    sendToSW({ type: 'WRITE_FILE', instanceId: this.instanceId, path: p, data: bytes }).catch(
      () => {},
    );
  }

  async writeFile(path: string, data: string | Uint8Array): Promise<void> {
    const p = normalizePath(path);
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    this.files.set(p, bytes);
    await sendToSW({ type: 'WRITE_FILE', instanceId: this.instanceId, path: p, data: bytes });
  }

  // --- Delete ---

  unlinkSync(path: string): void {
    const p = normalizePath(path);
    if (!this.files.has(p)) throw enoent(path);
    this.files.delete(p);
    sendToSW({ type: 'WRITE_FILE', instanceId: this.instanceId, path: p, data: null }).catch(
      () => {},
    );
  }

  async unlink(path: string): Promise<void> {
    const p = normalizePath(path);
    if (!this.files.has(p)) throw enoent(path);
    this.files.delete(p);
    await sendToSW({ type: 'WRITE_FILE', instanceId: this.instanceId, path: p, data: null });
  }

  // --- Directory ---

  async mkdir(_path: string): Promise<void> {
    // Directories are implicit in zip archives — no-op
  }

  readdirSync(path: string): string[] {
    const dir = normalizePath(path).replace(/\/?$/, '/');
    const entries = new Set<string>();
    for (const filePath of this.files.keys()) {
      if (filePath.startsWith(dir)) {
        const name = filePath.slice(dir.length).split('/')[0];
        if (name) entries.add(name);
      }
    }
    return [...entries].sort();
  }

  async readdir(path: string): Promise<string[]> {
    return this.readdirSync(path);
  }

  // --- Stat / exists ---

  existsSync(path: string): boolean {
    const p = normalizePath(path);
    if (this.files.has(p)) return true;
    const prefix = p.replace(/\/?$/, '/');
    for (const key of this.files.keys()) {
      if (key.startsWith(prefix)) return true;
    }
    return false;
  }

  async exists(path: string): Promise<boolean> {
    return this.existsSync(path);
  }

  statSync(path: string): { size: number; isDirectory(): boolean } {
    const p = normalizePath(path);
    const data = this.files.get(p);
    if (data) return { size: data.byteLength, isDirectory: () => false };
    const prefix = p.replace(/\/?$/, '/');
    for (const key of this.files.keys()) {
      if (key.startsWith(prefix)) return { size: 0, isDirectory: () => true };
    }
    throw enoent(path);
  }

  async stat(path: string): Promise<{ size: number; isDirectory(): boolean }> {
    return this.statSync(path);
  }

  // --- Export ---

  /**
   * Re-pack the current in-memory files into a ZIP archive (Uint8Array).
   * Useful for "Save As" / download flows.
   */
  exportZip(): Uint8Array {
    const entries: Record<string, Uint8Array> = {};
    for (const [path, data] of this.files) {
      entries[path.replace(/^\//, '')] = data;
    }
    return zipSync(entries);
  }

  /** List all file paths in the archive. */
  listFiles(): string[] {
    return [...this.files.keys()].sort();
  }
}
