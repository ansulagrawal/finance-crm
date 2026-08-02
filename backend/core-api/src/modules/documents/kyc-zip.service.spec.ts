import { STORAGE_ADAPTER } from '@finance-crm/common';
import { Document, Lead } from '@finance-crm/database';
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { KycZipService } from './kyc-zip.service';

function repo(overrides: Record<string, jest.Mock> = {}) {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    findOneBy: jest.fn().mockResolvedValue({ id: 1 }),
    find: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe('KycZipService', () => {
  let service: KycZipService;
  let leadRepository: ReturnType<typeof repo>;
  let documentRepository: ReturnType<typeof repo>;
  let storageAdapter: { download: jest.Mock };

  beforeEach(async () => {
    leadRepository = repo();
    documentRepository = repo();
    storageAdapter = {
      download: jest.fn().mockResolvedValue(Buffer.from('file-bytes')),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        KycZipService,
        { provide: getRepositoryToken(Lead), useValue: leadRepository },
        { provide: getRepositoryToken(Document), useValue: documentRepository },
        { provide: STORAGE_ADAPTER, useValue: storageAdapter },
      ],
    }).compile();

    service = moduleRef.get(KycZipService);
  });

  it('throws NotFoundException when the lead has no documents', async () => {
    documentRepository.find.mockResolvedValue([]);
    await expect(service.buildZip(1)).rejects.toThrow(NotFoundException);
  });

  it("builds a non-empty zip buffer from the lead's documents", async () => {
    documentRepository.find.mockResolvedValue([
      { id: 1, filePath: 'docs/pan.pdf', documentType: { name: 'PAN' } },
      { id: 2, filePath: 'docs/aadhaar.jpg', documentType: null },
    ]);

    const zip = await service.buildZip(1);

    expect(storageAdapter.download).toHaveBeenCalledWith('docs/pan.pdf');
    expect(storageAdapter.download).toHaveBeenCalledWith('docs/aadhaar.jpg');
    expect(zip.length).toBeGreaterThan(0);
  });
});
