import {
  BankAccountStatus,
  CustomerBanking,
  Document,
  DocumentDownloadLog,
  DocumentType,
  Lead,
  User,
} from '@finance-crm/database';
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { VerificationService } from './verification.service';

function repo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    findOneBy: jest.fn().mockResolvedValue(null),
    save: jest.fn(async (x: unknown) => x),
    create: jest.fn((x: unknown) => x),
    update: jest.fn().mockResolvedValue({ affected: 0 }),
    ...overrides,
  };
}

describe('VerificationService', () => {
  let service: VerificationService;
  let customerBankingRepository: ReturnType<typeof repo>;
  let bankAccountStatusRepository: ReturnType<typeof repo>;

  beforeEach(async () => {
    customerBankingRepository = repo();
    bankAccountStatusRepository = repo();

    const moduleRef = await Test.createTestingModule({
      providers: [
        VerificationService,
        {
          provide: getRepositoryToken(CustomerBanking),
          useValue: customerBankingRepository,
        },
        { provide: getRepositoryToken(DocumentType), useValue: repo() },
        { provide: getRepositoryToken(Document), useValue: repo() },
        {
          provide: getRepositoryToken(DocumentDownloadLog),
          useValue: repo(),
        },
        { provide: getRepositoryToken(Lead), useValue: repo() },
        { provide: getRepositoryToken(User), useValue: repo() },
        {
          provide: getRepositoryToken(BankAccountStatus),
          useValue: bankAccountStatusRepository,
        },
      ],
    }).compile();

    service = moduleRef.get(VerificationService);
  });

  describe('listBankAccountStatuses', () => {
    it('returns only active rows, ordered by id', async () => {
      const rows = [{ id: 1, name: 'ACCOUNT AND NAME VERIFIED SUCCESSFULLY' }];
      bankAccountStatusRepository.find.mockResolvedValue(rows);

      await expect(service.listBankAccountStatuses()).resolves.toBe(rows);
      expect(bankAccountStatusRepository.find).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { id: 'ASC' },
      });
    });
  });

  describe('verifyBanking', () => {
    it('resets sibling verified accounts and marks this one verified (status id 1)', async () => {
      const banking = { id: 5, accountStatusId: 0 };
      customerBankingRepository.findOne.mockResolvedValue(banking);
      bankAccountStatusRepository.findOneBy.mockResolvedValue({ id: 1 });

      const result = await service.verifyBanking(1, 5);

      expect(bankAccountStatusRepository.findOneBy).toHaveBeenCalledWith({
        id: 1,
      });
      expect(customerBankingRepository.update).toHaveBeenCalledWith(
        { lead: { id: 1 }, accountStatusId: 1 },
        { accountStatusId: 0 },
      );
      expect(result.accountStatusId).toBe(1);
    });

    it('throws NotFoundException when the banking record does not belong to the lead', async () => {
      customerBankingRepository.findOne.mockResolvedValue(null);
      bankAccountStatusRepository.findOneBy.mockResolvedValue({ id: 1 });

      await expect(service.verifyBanking(1, 999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('setBankAccountStatus', () => {
    it('sets an arbitrary non-verified status without resetting siblings', async () => {
      const banking = { id: 5, accountStatusId: 1 };
      customerBankingRepository.findOne.mockResolvedValue(banking);
      bankAccountStatusRepository.findOneBy.mockResolvedValue({ id: 3 }); // IFSC CODE WRONG

      const result = await service.setBankAccountStatus(1, 5, 3);

      expect(customerBankingRepository.update).not.toHaveBeenCalled();
      expect(result.accountStatusId).toBe(3);
    });

    it('resets siblings when the target status is verified (id 1)', async () => {
      const banking = { id: 5, accountStatusId: 3 };
      customerBankingRepository.findOne.mockResolvedValue(banking);
      bankAccountStatusRepository.findOneBy.mockResolvedValue({ id: 1 });

      await service.setBankAccountStatus(1, 5, 1);

      expect(customerBankingRepository.update).toHaveBeenCalledWith(
        { lead: { id: 1 }, accountStatusId: 1 },
        { accountStatusId: 0 },
      );
    });

    it('throws NotFoundException for an unknown status id', async () => {
      bankAccountStatusRepository.findOneBy.mockResolvedValue(null);

      await expect(service.setBankAccountStatus(1, 5, 404)).rejects.toThrow(
        NotFoundException,
      );
      expect(customerBankingRepository.findOne).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for a banking record not belonging to the lead', async () => {
      bankAccountStatusRepository.findOneBy.mockResolvedValue({ id: 3 });
      customerBankingRepository.findOne.mockResolvedValue(null);

      await expect(service.setBankAccountStatus(1, 999, 3)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
