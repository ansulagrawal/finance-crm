import {
  FaceMatchLog,
  Lead,
  LeadAudit,
  LeadCustomer,
  LeadFollowup,
  Loan,
  MasterStatus,
  ReverseGeocodeLog,
  User,
} from '@finance-crm/database';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditService } from './audit.service';

function repo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    findOneBy: jest.fn().mockResolvedValue(null),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    save: jest.fn(async (x: unknown) => x),
    create: jest.fn((x: unknown) => x),
    ...overrides,
  };
}

function mockQueryBuilder(rows: unknown[], total?: number) {
  const qb: Record<string, unknown> = {};
  const chain = [
    'leftJoinAndSelect',
    'where',
    'andWhere',
    'orWhere',
    'orderBy',
    'skip',
    'take',
  ];
  for (const method of chain) {
    qb[method] = jest.fn().mockReturnValue(qb);
  }
  qb.getManyAndCount = jest
    .fn()
    .mockResolvedValue([rows, total ?? rows.length]);
  return qb;
}

describe('AuditService', () => {
  let service: AuditService;
  let leadRepository: ReturnType<typeof repo> & {
    createQueryBuilder: jest.Mock;
  };

  beforeEach(async () => {
    leadRepository = { ...repo(), createQueryBuilder: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: getRepositoryToken(Lead), useValue: leadRepository },
        { provide: getRepositoryToken(Loan), useValue: repo() },
        { provide: getRepositoryToken(LeadAudit), useValue: repo() },
        { provide: getRepositoryToken(LeadFollowup), useValue: repo() },
        { provide: getRepositoryToken(MasterStatus), useValue: repo() },
        { provide: getRepositoryToken(User), useValue: repo() },
        { provide: getRepositoryToken(FaceMatchLog), useValue: repo() },
        { provide: getRepositoryToken(ReverseGeocodeLog), useValue: repo() },
        { provide: getRepositoryToken(LeadCustomer), useValue: repo() },
      ],
    }).compile();

    service = moduleRef.get(AuditService);
  });

  describe('list', () => {
    it('scopes a non-AH auditor to the joined alias, not a made-up column', async () => {
      // Regression test: this filter used to read `lead.auditAssignedToId`,
      // a column that does not exist — `auditAssignedTo` is only reachable
      // via the leftJoinAndSelect alias set up two lines above, so the real
      // MySQL column (`ER_BAD_FIELD_ERROR`) only surfaces at query time,
      // never at compile time. 500'd the audit queue for every AU/AM user.
      const qb = mockQueryBuilder([]);
      leadRepository.createQueryBuilder.mockReturnValue(qb);

      await service.list({}, 9, ['AU']);

      expect(qb.andWhere).toHaveBeenCalledWith(
        '(leadStatus.name = :auditNew OR auditAssignedTo.id = :actingUserId)',
        expect.objectContaining({ actingUserId: 9 }),
      );
    });

    it('does not scope by assignee for an Audit Head', async () => {
      const qb = mockQueryBuilder([]);
      leadRepository.createQueryBuilder.mockReturnValue(qb);

      await service.list({}, 9, ['AH']);

      expect(qb.andWhere).not.toHaveBeenCalled();
    });
  });
});
