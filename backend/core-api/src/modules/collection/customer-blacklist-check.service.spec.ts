import { CustomerBlacklist } from '@finance-crm/database';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CustomerBlacklistCheckService } from './customer-blacklist-check.service';

describe('CustomerBlacklistCheckService', () => {
  let service: CustomerBlacklistCheckService;
  let qb: {
    where: jest.Mock;
    andWhere: jest.Mock;
    getOne: jest.Mock;
  };

  beforeEach(async () => {
    qb = {
      where: jest.fn(),
      andWhere: jest.fn(),
      getOne: jest.fn().mockResolvedValue(null),
    };
    qb.where.mockReturnValue(qb);
    qb.andWhere.mockReturnValue(qb);

    const repository = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CustomerBlacklistCheckService,
        {
          provide: getRepositoryToken(CustomerBlacklist),
          useValue: repository,
        },
      ],
    }).compile();

    service = moduleRef.get(CustomerBlacklistCheckService);
  });

  it('returns false and skips the query when no identity fields are given', async () => {
    const result = await service.isBlacklisted({});
    expect(result).toBe(false);
    expect(qb.getOne).not.toHaveBeenCalled();
  });

  it('returns true when a match is found by pancard', async () => {
    qb.getOne.mockResolvedValue({ id: 1 });

    const result = await service.isBlacklisted({ pancard: 'abcde1234f' });

    expect(result).toBe(true);
    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('bl.pancard = :pancard'),
      expect.objectContaining({ pancard: 'ABCDE1234F' }),
    );
  });

  it('returns false when nothing matches', async () => {
    qb.getOne.mockResolvedValue(null);

    const result = await service.isBlacklisted({
      mobile: '9876543210',
      email: 'test@example.com',
    });

    expect(result).toBe(false);
  });
});
