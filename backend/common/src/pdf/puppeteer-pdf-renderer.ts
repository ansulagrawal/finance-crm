import puppeteer, { type Browser } from 'puppeteer';
import type { PdfRenderer } from './pdf-renderer.interface';

/**
 * Legacy CRM rendered PDFs (sanction letter, loan agreement, CIBIL report)
 * with mPDF from HTML strings. The ported templates are plain HTML/CSS
 * (tables, no JS), so Puppeteer's print-to-PDF is a drop-in equivalent and
 * handles modern CSS far better than mPDF did.
 *
 * In Docker/production, set `PUPPETEER_EXECUTABLE_PATH` to an OS-installed
 * `chromium` binary (e.g. `apt-get install chromium` in the Dockerfile) so
 * the image doesn't also bundle Puppeteer's own downloaded Chromium copy.
 * Locally, leave it unset — Puppeteer manages its own cached browser.
 *
 * **Sandboxing.** This used to launch with `--no-sandbox
 * --disable-setuid-sandbox`, the usual workaround for Chrome refusing to
 * start its sandbox as root in a container. Combined with templates that
 * interpolated DB strings unescaped, that meant any renderer compromise
 * escalated straight to full container access. `core-api`'s Dockerfile now
 * runs as a non-root `app` user, so the sandbox works normally and the
 * flags are gone. `PUPPETEER_DISABLE_SANDBOX=true` exists only as an escape
 * hatch for an environment that genuinely can't provide the required
 * kernel namespaces — do not set it to work around a permissions error;
 * fix the user the process runs as instead.
 *
 * Network access is off (`--disable-features=... `/request interception is
 * overkill here, so this uses the simpler lever): every template's only
 * external reference is an inlined `data:` logo URI, so there is nothing
 * legitimate to fetch, and blocking it removes the SSRF reach an injected
 * `<img src="http://169.254.169.254/...">` would otherwise have.
 */
/** Schemes an injected tag could use to reach the network or the local
 * filesystem from inside the render. `file` is included because a PDF is a
 * plausible exfiltration channel for whatever it reads. */
const BLOCKED_REQUEST_SCHEMES = new Set([
  'http',
  'https',
  'ws',
  'wss',
  'ftp',
  'file',
  'blob',
]);

export class PuppeteerPdfRenderer implements PdfRenderer {
  private browserPromise: Promise<Browser> | null = null;

  private getBrowser(): Promise<Browser> {
    if (!this.browserPromise) {
      const disableSandbox =
        process.env.PUPPETEER_DISABLE_SANDBOX === 'true'
          ? ['--no-sandbox', '--disable-setuid-sandbox']
          : [];
      this.browserPromise = puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        // `--disable-dev-shm-usage` is a stability flag, not a sandbox
        // weakening: Docker's default /dev/shm is 64MB, which Chrome can
        // exhaust and crash on. It writes shared memory to /tmp instead.
        args: ['--disable-dev-shm-usage', ...disableSandbox],
      });
    }
    return this.browserPromise;
  }

  async renderHtmlToPdf(html: string): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      // Belt-and-braces against anything that still reaches the page as
      // markup: no request may leave the machine. Blocking by scheme rather
      // than allow-listing, so the `about:blank` document `setContent`
      // renders into is never itself aborted (that would break rendering);
      // templates reference only inlined `data:` URIs, so nothing
      // legitimate is blocked.
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const scheme = request.url().split(':', 1)[0].toLowerCase();
        if (BLOCKED_REQUEST_SCHEMES.has(scheme)) {
          void request.abort();
          return;
        }
        void request.continue();
      });
      await page.setContent(html, { waitUntil: 'load' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' },
      });
      return Buffer.from(pdf);
    } finally {
      await page.close();
    }
  }

  async close(): Promise<void> {
    if (this.browserPromise) {
      const browser = await this.browserPromise;
      await browser.close();
      this.browserPromise = null;
    }
  }
}
