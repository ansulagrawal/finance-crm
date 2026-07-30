export interface UploadResult {
  key: string;
  url: string;
}

export interface StorageAdapter {
  upload(
    buffer: Buffer,
    key: string,
    contentType?: string,
  ): Promise<UploadResult>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  /** Returns a URL usable to fetch the object directly (signed, for private S3 objects; a local path/URL for disk storage). */
  getUrl(key: string, expiresInSeconds?: number): Promise<string>;
}
