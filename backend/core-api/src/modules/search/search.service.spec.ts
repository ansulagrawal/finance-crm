import { Lead } from '@finance-crm/database';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SearchService } from './search.service';

const CHAIN_METHODS = [
  'leftJoinAndSelect',
  'leftJoin',
  'where',
  'orWhere',
  'orderBy',
  'distinct',
  'take',
] as const;

function queryBuilder(getManyResult: unknown[] = []) {
  const qb: Record<string, jest.Mock> = {
    getMany: jest.fn().mockResolvedValue(getManyResult),
  };
  for (const key of CHAIN_METHODS) {
    qb[key] = jest.fn().mockReturnValue(qb);
  }
  return qb;
}

describe('SearchService', () => {
  let service: SearchService;
  let leadRepository: { createQueryBuilder: jest.Mock };
  let qb: ReturnType<typeof queryBuilder>;

  beforeEach(async () => {
    qb = queryBuilder();
    leadRepository = { createQueryBuilder: jest.fn().mockReturnValue(qb) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: getRepositoryToken(Lead), useValue: leadRepository },
      ],
    }).compile();

    service = moduleRef.get(SearchService);
  });

  function whereArgs() {
    // .where(...) is the first condition (leadReferenceNo); every
    // subsequent condition is chained via .orWhere(...).
    return [qb.where.mock.calls[0], ...qb.orWhere.mock.calls];
  }

  it('returns the leads resolved by the query builder', async () => {
    const leads = [{ id: 1 }];
    qb.getMany.mockResolvedValue(leads);

    const result = await service.search('9876543210');

    expect(result).toEqual({ leads });
  });

  it('trims whitespace before binding the search value', async () => {
    await service.search('  ABCD1234E  ');

    expect(whereArgs()).toContainEqual([
      'lead.leadReferenceNo = :exact',
      { exact: 'ABCD1234E' },
    ]);
  });

  it('matches on leadReferenceNo as an exact bound parameter', async () => {
    await service.search('LR-000123');
    expect(qb.where).toHaveBeenCalledWith('lead.leadReferenceNo = :exact', {
      exact: 'LR-000123',
    });
  });

  it('matches on applicationNo as an exact bound parameter', async () => {
    await service.search('APP-000123');
    expect(qb.orWhere).toHaveBeenCalledWith('lead.applicationNo = :exact', {
      exact: 'APP-000123',
    });
  });

  it('matches on mobile (lead-level) as an exact bound parameter', async () => {
    await service.search('9876543210');
    expect(qb.orWhere).toHaveBeenCalledWith('lead.mobile = :exact', {
      exact: '9876543210',
    });
  });

  it('matches on email as an exact bound parameter', async () => {
    await service.search('jane@example.com');
    expect(qb.orWhere).toHaveBeenCalledWith('lead.email = :exact', {
      exact: 'jane@example.com',
    });
  });

  it('matches on PAN (lead-level) as an exact bound parameter', async () => {
    await service.search('ABCDE1234F');
    expect(qb.orWhere).toHaveBeenCalledWith('lead.pancard = :exact', {
      exact: 'ABCDE1234F',
    });
  });

  it('matches on name as a prefix LIKE, not a substring or exact match', async () => {
    await service.search('Jane');
    expect(qb.orWhere).toHaveBeenCalledWith('lead.firstName LIKE :likeValue', {
      likeValue: 'Jane%',
    });
  });

  it('matches on PAN (customer/KYC-level) as an exact bound parameter', async () => {
    await service.search('ABCDE1234F');
    expect(qb.orWhere).toHaveBeenCalledWith('customer.pancard = :exact', {
      exact: 'ABCDE1234F',
    });
  });

  it('matches on Aadhaar as an exact bound parameter', async () => {
    await service.search('123456789012');
    expect(qb.orWhere).toHaveBeenCalledWith('customer.aadhaarNumber = :exact', {
      exact: '123456789012',
    });
  });

  it('matches on mobile (customer-level) as an exact bound parameter', async () => {
    await service.search('9876543210');
    expect(qb.orWhere).toHaveBeenCalledWith('customer.mobile = :exact', {
      exact: '9876543210',
    });
  });

  it('matches on email (customer-level) as an exact bound parameter', async () => {
    await service.search('jane@example.com');
    expect(qb.orWhere).toHaveBeenCalledWith('customer.email = :exact', {
      exact: 'jane@example.com',
    });
  });

  it('matches on loan number as an exact bound parameter', async () => {
    await service.search('LN-000123');
    expect(qb.orWhere).toHaveBeenCalledWith('loan.loanNumber = :exact', {
      exact: 'LN-000123',
    });
  });

  it('matches on CIF number as an exact bound parameter', async () => {
    await service.search('FTC00000004');
    expect(qb.orWhere).toHaveBeenCalledWith('cifCustomer.cifNumber = :exact', {
      exact: 'FTC00000004',
    });
  });

  it('adds a numeric lead.id match only when the query is purely numeric', async () => {
    await service.search('42');
    expect(qb.orWhere).toHaveBeenCalledWith('lead.id = :id', { id: 42 });
  });

  it('does not add a lead.id match for a non-numeric query', async () => {
    await service.search('jane@example.com');
    expect(qb.orWhere).not.toHaveBeenCalledWith(
      'lead.id = :id',
      expect.anything(),
    );
  });

  it('does not add a lead.id match for a mixed alphanumeric query', async () => {
    await service.search('42A');
    expect(qb.orWhere).not.toHaveBeenCalledWith(
      'lead.id = :id',
      expect.anything(),
    );
  });

  it('caps results at 50 rows and dedupes/orders newest-first', async () => {
    await service.search('anything');
    expect(qb.distinct).toHaveBeenCalledWith(true);
    expect(qb.orderBy).toHaveBeenCalledWith('lead.id', 'DESC');
    expect(qb.take).toHaveBeenCalledWith(50);
  });

  describe('OL role masking', () => {
    const lead = { id: 1, email: 'jane.doe@example.com', mobile: '9876543210' };

    it('masks email and mobile for a caller holding the OL role', async () => {
      qb.getMany.mockResolvedValue([{ ...lead }]);

      const result = await service.search('jane', ['OL']);

      expect(result.leads[0].email).toBe('XXXXXxample.com');
      expect(result.leads[0].mobile).toBe('XXXXXX3210');
    });

    it('leaves email and mobile unmasked for a caller without the OL role', async () => {
      qb.getMany.mockResolvedValue([{ ...lead }]);

      const result = await service.search('jane', ['CA']);

      expect(result.leads[0].email).toBe('jane.doe@example.com');
      expect(result.leads[0].mobile).toBe('9876543210');
    });

    it('leaves a null email as null when masking', async () => {
      qb.getMany.mockResolvedValue([{ ...lead, email: null }]);

      const result = await service.search('jane', ['OL']);

      expect(result.leads[0].email).toBeNull();
    });

    it('defaults to unmasked when no roles are passed', async () => {
      qb.getMany.mockResolvedValue([{ ...lead }]);

      const result = await service.search('jane');

      expect(result.leads[0].email).toBe('jane.doe@example.com');
    });
  });

  describe('malicious input is bound as a literal parameter value, never interpreted', () => {
    it.each([
      `' OR '1'='1`,
      `'; DROP TABLE leads; --`,
      `1 OR 1=1`,
      `" OR ""="`,
    ])(
      'treats %j as a plain bound string, not concatenated SQL',
      async (payload) => {
        await service.search(payload);

        // Every condition is a static parameterized string with a named
        // placeholder — the raw payload only ever appears as the *value* of
        // a params object, never spliced into the condition string itself.
        const allCalls = [...qb.where.mock.calls, ...qb.orWhere.mock.calls];
        for (const [condition] of allCalls) {
          expect(condition).not.toContain(payload);
          expect(condition).toMatch(/^[\w.]+ (=|LIKE) :\w+$/);
        }

        expect(qb.where).toHaveBeenCalledWith('lead.leadReferenceNo = :exact', {
          exact: payload,
        });
        expect(qb.orWhere).toHaveBeenCalledWith('lead.mobile = :exact', {
          exact: payload,
        });
        // The LIKE clause binds the raw payload plus a trailing wildcard —
        // still a single bound parameter, not string-built SQL.
        expect(qb.orWhere).toHaveBeenCalledWith(
          'lead.firstName LIKE :likeValue',
          {
            likeValue: `${payload}%`,
          },
        );
      },
    );
  });
});
