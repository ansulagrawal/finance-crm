import {
  UserLeadAllocationCaseType,
  UserLeadAllocationLog,
  UserLeadAllocationStatus,
} from '@finance-crm/database';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LeadAllocationService } from './lead-allocation.service';

function repo(overrides: Record<string, jest.Mock> = {}) {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn(async (x: unknown) => x),
    create: jest.fn((x: unknown) => x),
    ...overrides,
  };
}

describe('LeadAllocationService', () => {
  let service: LeadAllocationService;
  let allocationLogRepository: ReturnType<typeof repo>;

  beforeEach(async () => {
    allocationLogRepository = repo();

    const moduleRef = await Test.createTestingModule({
      providers: [
        LeadAllocationService,
        {
          provide: getRepositoryToken(UserLeadAllocationLog),
          useValue: allocationLogRepository,
        },
      ],
    }).compile();

    service = moduleRef.get(LeadAllocationService);
  });

  describe('declare', () => {
    it('creates and saves a new declaration row for the acting user', async () => {
      const log = await service.declare(
        {
          userStatus: UserLeadAllocationStatus.ACTIVE,
          userCaseType: UserLeadAllocationCaseType.FRESH,
        },
        9,
      );

      expect(allocationLogRepository.save).toHaveBeenCalled();
      expect(log).toEqual(
        expect.objectContaining({
          userId: 9,
          userStatus: UserLeadAllocationStatus.ACTIVE,
          userCaseType: UserLeadAllocationCaseType.FRESH,
        }),
      );
    });
  });

  describe('getToday', () => {
    it('looks up the latest active declaration for the user within today', async () => {
      await service.getToday(9);

      expect(allocationLogRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 9,
            isActive: true,
            isDeleted: false,
          }),
          order: { id: 'DESC' },
        }),
      );
    });

    it('returns null when nothing was declared today', async () => {
      const result = await service.getToday(9);
      expect(result).toBeNull();
    });
  });
});
