import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { StorageAdapter, UploadResult } from './storage-adapter.interface';

/**
 * Mirrors the legacy app's S3 usage (`application/libraries/S3_upload.php`):
 * objects are uploaded privately (ACL private, no public URL) under a bucket
 * "folder" prefix (legacy default: `upload/`), and every read goes through a
 * signed URL rather than a public object URL.
 */
export class S3StorageAdapter implements StorageAdapter {
  private readonly client: S3Client;

  constructor(
    private readonly bucket: string,
    region: string,
    private readonly keyPrefix: string,
  ) {
    this.client = new S3Client({ region });
  }

  private prefixedKey(key: string): string {
    const prefix = this.keyPrefix.replace(/^\/|\/$/g, '');
    return prefix ? `${prefix}/${key}` : key;
  }

  async upload(
    buffer: Buffer,
    key: string,
    contentType?: string,
  ): Promise<UploadResult> {
    const objectKey = this.prefixedKey(key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: buffer,
        ContentType: contentType,
        ACL: 'private',
      }),
    );
    return { key, url: await this.getUrl(key) };
  }

  async download(key: string): Promise<Buffer> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: this.prefixedKey(key) }),
    );
    const body = result.Body;
    if (!body) {
      throw new Error(`Empty S3 object body for key: ${key}`);
    }
    const chunks: Buffer[] = [];
    for await (const chunk of body as AsyncIterable<Buffer>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: this.prefixedKey(key),
      }),
    );
  }

  async getUrl(key: string, expiresInSeconds = 900): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: this.prefixedKey(key),
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }
}
