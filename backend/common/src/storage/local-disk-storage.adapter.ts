import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, relative } from 'node:path';
import type { StorageAdapter, UploadResult } from './storage-adapter.interface';

export class LocalDiskStorageAdapter implements StorageAdapter {
  constructor(
    private readonly basePath: string,
    private readonly publicBaseUrl: string,
  ) {}

  private resolvePath(key: string): string {
    const target = normalize(join(this.basePath, key));
    const rel = relative(this.basePath, target);
    if (rel.startsWith('..') || rel === '') {
      throw new Error(
        `Refusing to resolve storage key outside base path: ${key}`,
      );
    }
    return target;
  }

  async upload(buffer: Buffer, key: string): Promise<UploadResult> {
    const path = this.resolvePath(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, buffer);
    return { key, url: await this.getUrl(key) };
  }

  async download(key: string): Promise<Buffer> {
    return readFile(this.resolvePath(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolvePath(key), { force: true });
  }

  async getUrl(key: string): Promise<string> {
    return `${this.publicBaseUrl.replace(/\/$/, '')}/${key}`;
  }
}
