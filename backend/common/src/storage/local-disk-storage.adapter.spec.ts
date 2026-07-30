import { mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalDiskStorageAdapter } from './local-disk-storage.adapter';

/**
 * The traversal guard here is a real security boundary, not a nicety:
 * `Document.filePath` is an unvalidated client-supplied string
 * (`CreateDocumentDto` is only `@IsString() @MinLength(1)`), and the KYC-zip
 * endpoint feeds it straight into `download()`. This adapter's `resolvePath`
 * is the only thing standing between that and arbitrary file read.
 *
 * It was reviewed as correct during the 2026-08-06 security review but had no
 * test, which is exactly the kind of guard that later gets "simplified".
 */
describe('LocalDiskStorageAdapter', () => {
  let base: string;
  let adapter: LocalDiskStorageAdapter;

  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), 'finance-crm-storage-'));
    adapter = new LocalDiskStorageAdapter(base, 'http://localhost/storage');
  });

  describe('path traversal', () => {
    it.each([
      '../escaped.txt',
      '../../escaped.txt',
      'nested/../../escaped.txt',
      './../escaped.txt',
    ])('refuses to resolve %j outside the base path', async (key) => {
      await expect(adapter.download(key)).rejects.toThrow(
        /outside base path|Refusing to resolve/i,
      );
    });

    it('refuses an upload that would escape the base path', async () => {
      await expect(
        adapter.upload(Buffer.from('x'), '../escaped.txt'),
      ).rejects.toThrow(/Refusing to resolve/i);
    });

    it('refuses a delete that would escape the base path', async () => {
      await expect(adapter.delete('../escaped.txt')).rejects.toThrow(
        /Refusing to resolve/i,
      );
    });

    it('refuses a key that resolves to the base path itself', async () => {
      await expect(adapter.download('.')).rejects.toThrow(
        /Refusing to resolve/i,
      );
    });

    it('treats an absolute-looking key as relative, not as an escape', async () => {
      // join(base, '/etc/passwd') === base + '/etc/passwd', so this stays
      // inside — it must fail as "not found", never read the real /etc/passwd.
      await expect(adapter.download('/etc/passwd')).rejects.toThrow(/ENOENT/);
    });
  });

  describe('normal operation', () => {
    it('round-trips an upload and download', async () => {
      const result = await adapter.upload(Buffer.from('hello'), 'a/b/c.txt');

      expect(result.key).toBe('a/b/c.txt');
      expect((await adapter.download('a/b/c.txt')).toString()).toBe('hello');
    });

    it('creates intermediate directories on upload', async () => {
      await adapter.upload(Buffer.from('x'), 'deep/nested/path/file.txt');

      expect(
        readFileSync(join(base, 'deep/nested/path/file.txt')).toString(),
      ).toBe('x');
    });

    it('delete is idempotent — removing a missing key does not throw', async () => {
      await expect(
        adapter.delete('never-existed.txt'),
      ).resolves.toBeUndefined();
    });

    it('builds a public URL without doubling the slash', async () => {
      const withSlash = new LocalDiskStorageAdapter(base, 'http://host/files/');

      await expect(withSlash.getUrl('a.txt')).resolves.toBe(
        'http://host/files/a.txt',
      );
    });
  });

  describe('symlinks', () => {
    it('does NOT follow a symlink out of the base path (documented limitation)', async () => {
      // resolvePath is lexical — it does not resolve symlinks. A symlink
      // planted inside the base directory therefore still reads its target.
      // Nothing in this codebase creates symlinks under the storage root, and
      // creating one requires filesystem access rather than API access, so
      // this is recorded rather than fixed. If untrusted writes to the storage
      // root ever become possible, this needs realpath containment.
      const outside = join(tmpdir(), `finance-crm-outside-${process.pid}.txt`);
      writeFileSync(outside, 'secret');
      symlinkSync(outside, join(base, 'link.txt'));

      expect((await adapter.download('link.txt')).toString()).toBe('secret');
    });
  });
});
