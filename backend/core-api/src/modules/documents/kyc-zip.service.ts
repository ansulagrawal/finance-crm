import { findOrFail, STORAGE_ADAPTER, type StorageAdapter } from '@finance-crm/common';
import { Document, Lead } from '@finance-crm/database';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import archiver from 'archiver';
import type { Repository } from 'typeorm';

/** Ports legacy `Admin/KycZipController.php` — zips every KYC document
 * uploaded for a lead's loan and streams it back. Legacy read straight off
 * a filesystem path (`LOANS_KYC_DOCS/{fy}/{loan_no}/`); this reads each
 * document through the storage adapter instead, so it works the same way
 * whether storage is local disk or S3. */
@Injectable()
export class KycZipService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @Inject(STORAGE_ADAPTER) private readonly storageAdapter: StorageAdapter,
  ) {}

  async buildZip(leadId: number): Promise<Buffer> {
    await findOrFail(this.leadRepository, leadId, 'Lead');
    const documents = await this.documentRepository.find({
      where: { lead: { id: leadId } },
      relations: { documentType: true },
      order: { id: 'ASC' },
    });
    if (documents.length === 0) {
      throw new NotFoundException(`No documents found for lead ${leadId}`);
    }

    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    archive.on('data', (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<void>((resolve, reject) => {
      archive.on('end', () => resolve());
      archive.on('error', (err) => reject(err));
    });

    for (const document of documents) {
      if (!document.filePath) continue;
      const buffer = await this.storageAdapter.download(document.filePath);
      const extension = document.filePath.split('.').pop() ?? 'bin';
      const label = document.documentType?.name ?? `document-${document.id}`;
      archive.append(buffer, { name: `${label}-${document.id}.${extension}` });
    }

    await archive.finalize();
    await done;
    return Buffer.concat(chunks);
  }
}
