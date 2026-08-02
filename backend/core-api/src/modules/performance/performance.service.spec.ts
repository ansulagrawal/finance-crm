import {
  User,
  UserTargetAllocation,
  UserTargetAllocationType,
} from '@finance-crm/database';
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PerformanceService } from './performance.service';

function repo(overrides: Record<string, jest.Mock> = {}) {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    findOneBy: jest.fn().mockResolvedValue(null),
    save: jest.fn(async (x: unknown) => x),
    create: jest.fn((x: unknown) => x),
    ...overrides,
  };
}

// `PerformanceService` trusts the stored achieved/target columns on
// `UserTargetAllocation` directly (legacy's cron keeps them updated) rather
// than recomputing "achieved" live from CreditAnalysisMemo -- unlike the
// pre-restart rewrite this spec used to test against, there is no monthly
// dimension and no CAM/MasterStatus dependency at all.
describe('PerformanceService', () => {
  let service: PerformanceService;
  let targetRepository: ReturnType<typeof repo>;
  let userRepository: ReturnType<typeof repo>;

  beforeEach(async () => {
    targetRepository = repo();
    userRepository = repo({
      findOneBy: jest.fn().mockResolvedValue({ id: 9 }),
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        PerformanceService,
        {
          provide: getRepositoryToken(UserTargetAllocation),
          useValue: targetRepository,
        },
        { provide: getRepositoryToken(User), useValue: userRepository },
      ],
    }).compile();

    service = moduleRef.get(PerformanceService);
  });

  describe('upsertTarget', () => {
    it('creates a new target for a first-time user/type pair', async () => {
      const user = { id: 9 };
      userRepository.findOneBy.mockResolvedValue(user);
      targetRepository.findOne.mockResolvedValue(null);

      const result = await service.upsertTarget({
        userId: 9,
        type: UserTargetAllocationType.SANCTION,
        targetAmount: 500000,
        targetCases: 20,
      });

      expect(targetRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user,
          type: UserTargetAllocationType.SANCTION,
        }),
      );
      expect(result.targetAmount).toBe(500000);
      expect(result.targetCases).toBe(20);
    });

    it('updates the existing target in place for the same user/type', async () => {
      const existing = { id: 1, targetAmount: 1, targetCases: 1 };
      targetRepository.findOne.mockResolvedValue(existing);

      const result = await service.upsertTarget({
        userId: 9,
        type: UserTargetAllocationType.SANCTION,
        targetAmount: 700000,
        targetCases: 30,
      });

      expect(targetRepository.create).not.toHaveBeenCalled();
      expect(result).toBe(existing);
      expect(existing.targetAmount).toBe(700000);
    });

    it('throws NotFoundException for an unknown user', async () => {
      userRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.upsertTarget({
          userId: 404,
          type: UserTargetAllocationType.SANCTION,
        }),
      ).rejects.toThrow(NotFoundException);
      expect(targetRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('getPerformance', () => {
    it('returns all zeros when no target row exists for the user/type', async () => {
      const result = await service.getPerformance(
        9,
        UserTargetAllocationType.SANCTION,
      );

      expect(result).toEqual({
        userId: 9,
        type: UserTargetAllocationType.SANCTION,
        targetCases: 0,
        targetAmount: 0,
        targetFollowups: 0,
        achievedCases: 0,
        achievedAmount: 0,
        achievedFollowups: 0,
      });
    });

    it('returns the stored target/achieved figures from the row', async () => {
      targetRepository.findOne.mockResolvedValue({
        targetAmount: 500000,
        targetCases: 20,
        targetFollowups: 10,
        achievedAmount: 50000,
        achievedCases: 2,
        achievedFollowups: 3,
      });

      const result = await service.getPerformance(
        9,
        UserTargetAllocationType.COLLECTION,
      );

      expect(result.targetAmount).toBe(500000);
      expect(result.achievedAmount).toBe(50000);
      expect(result.achievedCases).toBe(2);
    });

    it('throws NotFoundException for an unknown user', async () => {
      userRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.getPerformance(404, UserTargetAllocationType.SANCTION),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
