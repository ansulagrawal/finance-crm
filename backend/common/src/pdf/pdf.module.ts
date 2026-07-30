import { Module } from '@nestjs/common';
import { PDF_RENDERER } from './pdf.tokens';
import { PuppeteerPdfRenderer } from './puppeteer-pdf-renderer';

/**
 * Same factory-provider toggle pattern as `StorageModule`/`JobRunnerModule` —
 * only one implementation exists today (`PuppeteerPdfRenderer`), but every
 * consumer depends on the `PDF_RENDERER` token, not the class, so swapping
 * renderers later doesn't touch call sites.
 */
@Module({
  providers: [
    {
      provide: PDF_RENDERER,
      useFactory: () => new PuppeteerPdfRenderer(),
    },
  ],
  exports: [PDF_RENDERER],
})
export class PdfModule {}
