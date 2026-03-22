import { loadArchive } from './loader.js';
import { ensureSW, sendToSW, getArcBase } from './sw-client.js';
import { ArcFS } from './fs.js';

// ---------------------------------------------------------------------------
// Shadow DOM template
// ---------------------------------------------------------------------------

const SHADOW_HTML = /* html */`
<style>
  :host {
    display: block;
    position: relative;
    overflow: hidden;
  }
  [hidden] { display: none !important; }
  #overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f8fafc;
    font-family: system-ui, sans-serif;
    font-size: 0.875rem;
    color: #64748b;
  }
  #error {
    color: #dc2626;
    padding: 1rem;
    text-align: center;
    max-width: 32rem;
    word-break: break-word;
  }
  iframe {
    width: 100%;
    height: 100%;
    border: none;
    display: block;
  }
</style>
<div id="overlay">
  <div id="loading"><slot name="loading">Loading…</slot></div>
  <div id="error" hidden></div>
</div>
<iframe sandbox="allow-scripts allow-same-origin allow-forms allow-popups" hidden></iframe>
`;

// ---------------------------------------------------------------------------
// Element
// ---------------------------------------------------------------------------

/**
 * <arc-pwa> custom element
 *
 * Attributes:
 *   archive  - URL to the .pwa.zip archive (required)
 *   src      - Entry point within the archive (default: "index.html")
 *
 * Properties:
 *   fs             - ArcFS instance (available after 'load' event)
 *   contentWindow  - The inner iframe's contentWindow (after 'load')
 *
 * Events:
 *   load   - fired when the archive is loaded and iframe is ready
 *   error  - fired if loading fails (ErrorEvent); AbortErrors are suppressed
 *
 * Slots:
 *   loading  - shown while the archive is loading (default: "Loading…")
 */
export class ArcPwaElement extends HTMLElement {
  private readonly instanceId: string = crypto.randomUUID();
  private _fs: ArcFS | null = null;
  private _loadPromise: Promise<void> | null = null;
  private _abortController: AbortController | null = null;

  private readonly _iframe: HTMLIFrameElement;
  private readonly _overlay: HTMLElement;
  private readonly _loadingEl: HTMLElement;
  private readonly _errorEl: HTMLElement;

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = SHADOW_HTML;
    this._iframe    = shadow.querySelector('iframe')!;
    this._overlay   = shadow.querySelector('#overlay')!;
    this._loadingEl = shadow.querySelector('#loading')!;
    this._errorEl   = shadow.querySelector('#error')!;
  }

  get fs(): ArcFS | null {
    return this._fs;
  }

  get contentWindow(): WindowProxy | null {
    return this._iframe.contentWindow;
  }

  static get observedAttributes(): string[] {
    return ['archive', 'src'];
  }

  connectedCallback(): void {
    this._load();
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this._load();
  }

  disconnectedCallback(): void {
    this._abortController?.abort();
    this._fs = null;
    // Ensure UNREGISTER arrives after any in-progress REGISTER_INSTANCE.
    const instanceId = this.instanceId;
    const cleanup = () =>
      sendToSW({ type: 'UNREGISTER_INSTANCE', instanceId }).catch(() => {});
    if (this._loadPromise) {
      this._loadPromise.then(cleanup, cleanup);
    } else {
      cleanup();
    }
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private _load(): void {
    const archive = this.getAttribute('archive');
    if (!archive) return;

    // Cancel any in-flight load (network + decompression).
    this._abortController?.abort();
    this._abortController = new AbortController();

    this._showLoading();

    const signal = this._abortController.signal;
    this._loadPromise = this._doLoad(archive, signal);
    this._loadPromise.catch((err: unknown) => {
      if (isAbortError(err)) return; // cancelled intentionally — no event
      this._showError(String(err));
      this.dispatchEvent(
        new ErrorEvent('error', { bubbles: true, error: err, message: String(err) }),
      );
      console.error('[ArcPWA]', err);
    });
  }

  private async _doLoad(archive: string, signal: AbortSignal): Promise<void> {
    const src = this.getAttribute('src') || 'index.html';

    await ensureSW();
    if (signal.aborted) return;

    const files = await loadArchive(archive, signal);
    if (signal.aborted) return;

    const entries: [string, Uint8Array][] = [...files.entries()];
    await sendToSW({ type: 'REGISTER_INSTANCE', instanceId: this.instanceId, entries });
    if (signal.aborted) return;

    this._fs = new ArcFS(files, this.instanceId);

    const virtualUrl = `${getArcBase()}${this.instanceId}/${src.replace(/^\/+/, '')}`;
    this._iframe.src = virtualUrl;

    this._showApp();
    this.dispatchEvent(new Event('load', { bubbles: true }));
  }

  private _showLoading(): void {
    this._overlay.hidden = false;
    this._loadingEl.hidden = false;
    this._errorEl.hidden = true;
    this._errorEl.textContent = '';
    this._iframe.hidden = true;
  }

  private _showApp(): void {
    this._overlay.hidden = true;
    this._iframe.hidden = false;
  }

  private _showError(message: string): void {
    this._overlay.hidden = false;
    this._loadingEl.hidden = true;
    this._errorEl.hidden = false;
    this._errorEl.textContent = message;
    this._iframe.hidden = true;
  }
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

if (!customElements.get('arc-pwa')) {
  customElements.define('arc-pwa', ArcPwaElement);
}
