export interface PdfRenderer {
  renderHtmlToPdf(html: string): Promise<Buffer>;
}
