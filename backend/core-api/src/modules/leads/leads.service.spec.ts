import { IntegrationsApiClient } from '@finance-crm/common';
import {
  Branch,
  City,
  Company,
  DataSource,
  Lead,
  LeadCustomer,
  LeadCustomerReference,
  LeadEmployment,
  LeadFollowup,
  LeadUserType,
  MaritalStatus,
  MasterStatus,
  Occupation,
  Product,
  Qualification,
  RejectionReason,
  Religion,
  State,
  User,
  UserRoleLocation,
} from '@finance-crm/database';
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LeadAssignmentStage } from './dto/assign-lead.dto';
import { LeadsService } from './leads.service';

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

describe('LeadsService', () => {
  let service: LeadsService;
  let leadRepository: ReturnType<typeof repo>;
  let leadCustomerRepository: ReturnType<typeof repo>;
  let leadEmploymentRepository: ReturnType<typeof repo>;
  let leadCustomerReferenceRepository: ReturnType<typeof repo>;
  let leadFollowupRepository: ReturnType<typeof repo>;
  let companyRepository: ReturnType<typeof repo>;
  let productRepository: ReturnType<typeof repo>;
  let dataSourceRepository: ReturnType<typeof repo>;
  let stateRepository: ReturnType<typeof repo>;
  let cityRepository: ReturnType<typeof repo>;
  let branchRepository: ReturnType<typeof repo>;
  let masterStatusRepository: ReturnType<typeof repo>;
  let rejectionReasonRepository: ReturnType<typeof repo>;
  let userRepository: ReturnType<typeof repo>;
  let maritalStatusRepository: ReturnType<typeof repo>;
  let qualificationRepository: ReturnType<typeof repo>;
  let religionRepository: ReturnType<typeof repo>;
  let occupationRepository: ReturnType<typeof repo>;
  let userRoleLocationRepository: ReturnType<typeof repo>;
  let integrationsApiClient: { post: jest.Mock; get: jest.Mock };

  beforeEach(async () => {
    leadRepository = repo();
    leadCustomerRepository = repo();
    leadEmploymentRepository = repo();
    leadCustomerReferenceRepository = repo();
    leadFollowupRepository = repo();
    companyRepository = repo();
    productRepository = repo();
    dataSourceRepository = repo();
    stateRepository = repo();
    cityRepository = repo();
    branchRepository = repo();
    masterStatusRepository = repo();
    // Legacy `leads.status`/`stage` are NOT NULL, so `create` always resolves a
    // MasterStatus row and derives them from it.
    masterStatusRepository.findOne.mockResolvedValue({
      id: 1,
      name: 'LEAD-NEW',
      stageCode: 'S1',
    });
    // Legacy `leads.company_id`/`product_id` are NOT NULL, so `create` always
    // resolves both.
    companyRepository.findOneBy.mockResolvedValue({ id: 1 });
    productRepository.findOneBy.mockResolvedValue({ id: 1 });
    rejectionReasonRepository = repo();
    userRepository = repo();
    maritalStatusRepository = repo();
    qualificationRepository = repo();
    religionRepository = repo();
    occupationRepository = repo();
    userRoleLocationRepository = repo();
    integrationsApiClient = {
      post: jest.fn().mockResolvedValue({}),
      get: jest.fn().mockResolvedValue({}),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        LeadsService,
        { provide: getRepositoryToken(Lead), useValue: leadRepository },
        {
          provide: getRepositoryToken(LeadCustomer),
          useValue: leadCustomerRepository,
        },
        {
          provide: getRepositoryToken(LeadEmployment),
          useValue: leadEmploymentRepository,
        },
        {
          provide: getRepositoryToken(LeadCustomerReference),
          useValue: leadCustomerReferenceRepository,
        },
        {
          provide: getRepositoryToken(LeadFollowup),
          useValue: leadFollowupRepository,
        },
        { provide: getRepositoryToken(Company), useValue: companyRepository },
        { provide: getRepositoryToken(Product), useValue: productRepository },
        {
          provide: getRepositoryToken(DataSource),
          useValue: dataSourceRepository,
        },
        { provide: getRepositoryToken(State), useValue: stateRepository },
        { provide: getRepositoryToken(City), useValue: cityRepository },
        { provide: getRepositoryToken(Branch), useValue: branchRepository },
        {
          provide: getRepositoryToken(MasterStatus),
          useValue: masterStatusRepository,
        },
        {
          provide: getRepositoryToken(RejectionReason),
          useValue: rejectionReasonRepository,
        },
        { provide: getRepositoryToken(User), useValue: userRepository },
        {
          provide: getRepositoryToken(MaritalStatus),
          useValue: maritalStatusRepository,
        },
        {
          provide: getRepositoryToken(Qualification),
          useValue: qualificationRepository,
        },
        {
          provide: getRepositoryToken(Religion),
          useValue: religionRepository,
        },
        {
          provide: getRepositoryToken(Occupation),
          useValue: occupationRepository,
        },
        {
          provide: getRepositoryToken(UserRoleLocation),
          useValue: userRoleLocationRepository,
        },
        {
          provide: IntegrationsApiClient,
          useValue: integrationsApiClient,
        },
      ],
    }).compile();

    service = moduleRef.get(LeadsService);
  });

  describe('list', () => {
    it('applies filters and pagination and returns a PaginatedResult', async () => {
      const qb = mockQueryBuilder([{ id: 1 }], 1);
      leadRepository.createQueryBuilder = jest.fn().mockReturnValue(qb);

      const result = await service.list({
        page: 2,
        limit: 10,
        companyId: 5,
        isBlacklisted: true,
      } as never);

      expect(leadRepository.createQueryBuilder).toHaveBeenCalledWith('lead');
      expect(qb.skip).toHaveBeenCalledWith(10);
      expect(qb.take).toHaveBeenCalledWith(10);
      expect(qb.andWhere).toHaveBeenCalledWith('company.id = :companyId', {
        companyId: 5,
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'lead.isBlacklisted = :isBlacklisted',
        { isBlacklisted: true },
      );
      expect(result).toEqual({
        data: [{ id: 1 }],
        page: 2,
        limit: 10,
        total: 1,
      });
    });

    it('matches a search term against firstName, mobile, and email, not just firstName', async () => {
      const qb = mockQueryBuilder([]);
      leadRepository.createQueryBuilder = jest.fn().mockReturnValue(qb);

      await service.list({ search: 'john' } as never);

      const [brackets] = qb.andWhere.mock.calls[0];
      const searchQb = { where: jest.fn(), orWhere: jest.fn() };
      searchQb.where.mockReturnValue(searchQb);
      searchQb.orWhere.mockReturnValue(searchQb);
      brackets.whereFactory(searchQb);
      expect(searchQb.where).toHaveBeenCalledWith(
        'lead.firstName LIKE :search',
        { search: '%john%' },
      );
      expect(searchQb.orWhere).toHaveBeenCalledWith('lead.mobile LIKE :search', {
        search: '%john%',
      });
      expect(searchQb.orWhere).toHaveBeenCalledWith('lead.email LIKE :search', {
        search: '%john%',
      });
    });

    it('ANDs companyId/isBlacklisted alongside a search', async () => {
      const qb = mockQueryBuilder([]);
      leadRepository.createQueryBuilder = jest.fn().mockReturnValue(qb);

      await service.list({
        search: 'john',
        companyId: 5,
        isBlacklisted: true,
      } as never);

      expect(qb.andWhere).toHaveBeenCalledWith('company.id = :companyId', {
        companyId: 5,
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'lead.isBlacklisted = :isBlacklisted',
        { isBlacklisted: true },
      );
    });

    it('defaults to page 1/limit 20 when unset', async () => {
      const qb = mockQueryBuilder([]);
      leadRepository.createQueryBuilder = jest.fn().mockReturnValue(qb);

      await service.list({} as never);

      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(20);
    });

    it('filters by stageCode when leadStatusId is not given', async () => {
      const qb = mockQueryBuilder([]);
      leadRepository.createQueryBuilder = jest.fn().mockReturnValue(qb);

      await service.list({ stageCode: ['S8', 'S9'] } as never);

      expect(qb.andWhere).toHaveBeenCalledWith(
        'leadStatus.stageCode IN (:...stageCodes)',
        { stageCodes: ['S8', 'S9'] },
      );
    });

    it('prefers leadStatusId over stageCode when both are given', async () => {
      const qb = mockQueryBuilder([]);
      leadRepository.createQueryBuilder = jest.fn().mockReturnValue(qb);

      await service.list({
        leadStatusId: 7,
        stageCode: ['S8', 'S9'],
      } as never);

      expect(qb.andWhere).toHaveBeenCalledWith('leadStatus.id = :leadStatusId', {
        leadStatusId: 7,
      });
      expect(qb.andWhere).not.toHaveBeenCalledWith(
        'leadStatus.stageCode IN (:...stageCodes)',
        expect.anything(),
      );
    });
  });

  describe('findById', () => {
    it('returns the lead when found', async () => {
      const lead = { id: 1 };
      leadRepository.findOne.mockResolvedValue(lead);
      await expect(service.findById(1)).resolves.toBe(lead);
    });

    it('throws NotFoundException when missing', async () => {
      leadRepository.findOne.mockResolvedValue(null);
      await expect(service.findById(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates a lead resolving its FK relations', async () => {
      const company = { id: 5 };
      companyRepository.findOneBy.mockResolvedValue(company);

      const result = await service.create({
        firstName: 'Jane',
        mobile: '9999999999',
        userType: LeadUserType.NEW,
        companyId: 5,
        productId: 1,
      } as never);

      expect(result.company).toBe(company);
      expect(leadRepository.save).toHaveBeenCalled();
    });

    it('sets leadEntryDate so reporting-api/automation-worker date filters see the lead', async () => {
      companyRepository.findOneBy.mockResolvedValue({ id: 5 });

      const result = await service.create({
        firstName: 'Jane',
        mobile: '9999999999',
        userType: LeadUserType.NEW,
        companyId: 5,
        productId: 1,
      } as never);

      expect(result.leadEntryDate).toBeInstanceOf(Date);
    });

    it('starts every lead in a real lifecycle status, which legacy needs NOT NULL', async () => {
      const leadNew = { id: 1, name: 'LEAD-NEW', stageCode: 'S1' };
      masterStatusRepository.findOne.mockResolvedValue(leadNew);

      const result = await service.create({
        firstName: 'Jane',
        mobile: '9999999999',
        companyId: 1,
        productId: 1,
      } as never);

      expect(result.leadStatus).toBe(leadNew);
    });

    it('throws NotFoundException when an optional FK id does not resolve', async () => {
      companyRepository.findOneBy.mockResolvedValue(null);
      await expect(
        service.create({
          firstName: 'Jane',
          mobile: '9999999999',
          companyId: 404,
        } as never),
      ).rejects.toThrow(NotFoundException);
    });

    it('leaves the genuinely optional relations null when no id supplied', async () => {
      const result = await service.create({
        firstName: 'Jane',
        mobile: '9999999999',
        companyId: 1,
        productId: 1,
      } as never);
      expect(result.dataSource).toBeNull();
      expect(result.branch).toBeNull();
    });
  });

  describe('update', () => {
    it('updates only the provided fields and re-fetches with relations', async () => {
      const existing = { id: 1, firstName: 'Old', mobile: '111' };
      leadRepository.findOne.mockResolvedValue(existing);

      await service.update(1, { firstName: 'New' } as never);

      expect(existing.firstName).toBe('New');
      expect(existing.mobile).toBe('111');
      expect(leadRepository.save).toHaveBeenCalledWith(existing);
    });

    it('throws NotFoundException when lead does not exist', async () => {
      leadRepository.findOne.mockResolvedValue(null);
      await expect(
        service.update(99, { firstName: 'X' } as never),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('changeStatus', () => {
    it('updates the lead status and writes an audit-trail followup', async () => {
      const lead = { id: 1 };
      const status = { id: 2, name: 'APPROVED' };
      const actingUser = { id: 9 };
      leadRepository.findOne.mockResolvedValue(lead);
      masterStatusRepository.findOneBy.mockResolvedValue(status);
      userRepository.findOne.mockResolvedValue(actingUser);

      await service.changeStatus(1, { leadStatusId: 2, remarks: 'ok' }, 9);

      expect(lead.leadStatus).toBe(status);
      expect(leadRepository.save).toHaveBeenCalledWith(lead);
      expect(leadFollowupRepository.save).toHaveBeenCalled();
      const [followupArg] = leadFollowupRepository.create.mock.calls[0];
      expect(followupArg.status).toBe(status);
      expect(followupArg.remarks).toBe('ok');
      expect(followupArg.user).toBe(actingUser);
      // re-fetches the lead by id after mutation
      expect(leadRepository.findOne).toHaveBeenCalledTimes(2);
    });

    it('rejects an unknown target status (invalid transition target)', async () => {
      leadRepository.findOne.mockResolvedValue({ id: 1 });
      masterStatusRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.changeStatus(1, { leadStatusId: 404 }, 9),
      ).rejects.toThrow(NotFoundException);
      expect(leadRepository.save).not.toHaveBeenCalled();
      expect(leadFollowupRepository.save).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the lead itself does not exist', async () => {
      leadRepository.findOne.mockResolvedValue(null);
      await expect(
        service.changeStatus(99, { leadStatusId: 2 }, 9),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('assign', () => {
    it.each([
      ['SCREENER' as const, 'screenerAssignedTo', 'screenerAssignedAt'],
      ['CREDIT' as const, 'creditAssignedTo', 'creditAssignedAt'],
      ['DISBURSAL' as const, 'disbursalAssignedTo', 'disbursalAssignedAt'],
    ])(
      'assigns stage %s to the assignee, stamps the timestamp, and writes a followup',
      async (stage, assignedToField, assignedAtField) => {
        const lead: Record<string, unknown> = { id: 1 };
        const assignee = { id: 7, name: 'Alice' };
        leadRepository.findOne.mockResolvedValue(lead);
        userRepository.findOneBy.mockResolvedValue(assignee);
        userRepository.findOne.mockResolvedValue({ id: 9 });

        await service.assign(
          1,
          { stage: LeadAssignmentStage[stage], userId: 7 },
          9,
        );

        expect(lead[assignedToField]).toBe(assignee);
        expect(lead[assignedAtField]).toBeInstanceOf(Date);
        expect(leadFollowupRepository.save).toHaveBeenCalled();
        const [followupArg] = leadFollowupRepository.create.mock.calls[0];
        expect(followupArg.remarks).toBe(
          `Assigned to Alice (${stage.toLowerCase()})`,
        );
      },
    );

    it('uses the caller-supplied remarks over the default message', async () => {
      leadRepository.findOne.mockResolvedValue({ id: 1 });
      userRepository.findOneBy.mockResolvedValue({ id: 7, name: 'Alice' });
      userRepository.findOne.mockResolvedValue({ id: 9 });

      await service.assign(
        1,
        {
          stage: LeadAssignmentStage.SCREENER,
          userId: 7,
          remarks: 'custom note',
        },
        9,
      );

      const [followupArg] = leadFollowupRepository.create.mock.calls[0];
      expect(followupArg.remarks).toBe('custom note');
    });

    it('throws NotFoundException when the assignee user does not exist', async () => {
      leadRepository.findOne.mockResolvedValue({ id: 1 });
      userRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.assign(
          1,
          { stage: LeadAssignmentStage.SCREENER, userId: 404 },
          9,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('selfAllocate', () => {
    const screenerInProcess = { id: 2, name: 'LEAD-INPROCESS' };
    const applicationNew = { id: 4, name: 'APPLICATION-NEW' };
    const applicationInProcess = { id: 5, name: 'APPLICATION-INPROCESS' };
    const disbursalNew = { id: 25, name: 'DISBURSAL-NEW' };
    const disbursalInProcess = { id: 30, name: 'DISBURSAL-INPROCESS' };
    const partialLeadStatuses = [{ id: 1, name: 'LEAD-NEW', stageCode: 'S1' }];

    beforeEach(() => {
      userRepository.findOneBy.mockResolvedValue({ id: 9, name: 'Alice' });
    });

    it('throws ForbiddenException when the acting role does not authorize the target queue', async () => {
      await expect(
        service.selfAllocate(
          { leadIds: [1], assignTarget: LeadAssignmentStage.SCREENER },
          9,
          ['CR2'],
        ),
      ).rejects.toThrow('does not permit');
    });

    it('SCREENER: allocates a lead in stageCode S1, skips one that is not, and fires RUNO for CR1', async () => {
      masterStatusRepository.find.mockResolvedValue(partialLeadStatuses);
      masterStatusRepository.findOne.mockResolvedValue(screenerInProcess);
      const eligibleLead = { id: 1, leadStatus: { id: 1 } };
      const ineligibleLead = { id: 2, leadStatus: { id: 99 } };
      leadRepository.findOne
        .mockResolvedValueOnce(eligibleLead)
        .mockResolvedValueOnce(ineligibleLead);

      const result = await service.selfAllocate(
        { leadIds: [1, 2], assignTarget: LeadAssignmentStage.SCREENER },
        9,
        ['CR1'],
      );

      expect(result).toEqual({ allocated: 1, skipped: [2] });
      expect(eligibleLead.leadStatus).toBe(screenerInProcess);
      expect(
        (eligibleLead as never as { screenerAssignedTo: unknown })
          .screenerAssignedTo,
      ).toEqual({ id: 9, name: 'Alice' });
      expect(integrationsApiClient.post).toHaveBeenCalledWith(
        expect.stringContaining('runo/sanction-allocation'),
        {},
      );
    });

    it('does not fire RUNO for a CA/SA actor claiming a SCREENER lead', async () => {
      masterStatusRepository.find.mockResolvedValue(partialLeadStatuses);
      masterStatusRepository.findOne.mockResolvedValue(screenerInProcess);
      leadRepository.findOne.mockResolvedValue({
        id: 1,
        leadStatus: { id: 1 },
      });

      await service.selfAllocate(
        { leadIds: [1], assignTarget: LeadAssignmentStage.SCREENER },
        9,
        ['SA'],
      );

      expect(integrationsApiClient.post).not.toHaveBeenCalled();
    });

    it('CREDIT: matches on the named APPLICATION-NEW status and backfills screener if unset', async () => {
      masterStatusRepository.findOne.mockImplementation(
        async ({ where }: { where: { name: string } }) =>
          where.name === 'APPLICATION-NEW'
            ? applicationNew
            : applicationInProcess,
      );
      const lead: Record<string, unknown> = {
        id: 3,
        leadStatus: applicationNew,
        screenerAssignedTo: null,
      };
      leadRepository.findOne.mockResolvedValue(lead);

      const result = await service.selfAllocate(
        { leadIds: [3], assignTarget: LeadAssignmentStage.CREDIT },
        9,
        ['CR2'],
      );

      expect(result).toEqual({ allocated: 1, skipped: [] });
      expect(lead.leadStatus).toBe(applicationInProcess);
      expect(lead.creditAssignedTo).toEqual({ id: 9, name: 'Alice' });
      expect(lead.screenerAssignedTo).toEqual({ id: 9, name: 'Alice' });
      expect(integrationsApiClient.post).not.toHaveBeenCalled();
    });

    it('DISBURSAL: matches on the named DISBURSAL-NEW status for a DS1 actor', async () => {
      masterStatusRepository.findOne.mockImplementation(
        async ({ where }: { where: { name: string } }) =>
          where.name === 'DISBURSAL-NEW' ? disbursalNew : disbursalInProcess,
      );
      const lead: Record<string, unknown> = {
        id: 4,
        leadStatus: disbursalNew,
        screenerAssignedTo: { id: 1 },
      };
      leadRepository.findOne.mockResolvedValue(lead);

      const result = await service.selfAllocate(
        { leadIds: [4], assignTarget: LeadAssignmentStage.DISBURSAL },
        9,
        ['DS1'],
      );

      expect(result).toEqual({ allocated: 1, skipped: [] });
      expect(lead.leadStatus).toBe(disbursalInProcess);
      expect(lead.disbursalAssignedTo).toEqual({ id: 9, name: 'Alice' });
      expect(lead.screenerAssignedTo).toEqual({ id: 1 });
    });

    it('does not fail the whole batch when RUNO allocation throws', async () => {
      masterStatusRepository.find.mockResolvedValue(partialLeadStatuses);
      masterStatusRepository.findOne.mockResolvedValue(screenerInProcess);
      leadRepository.findOne.mockResolvedValue({
        id: 1,
        leadStatus: { id: 1 },
      });
      integrationsApiClient.post.mockRejectedValue(new Error('RUNO down'));

      const result = await service.selfAllocate(
        { leadIds: [1], assignTarget: LeadAssignmentStage.SCREENER },
        9,
        ['CR1'],
      );

      expect(result).toEqual({ allocated: 1, skipped: [] });
    });
  });

  describe('reject', () => {
    it('sets rejection reason/rejectedBy/rejectedAt/leadStatus and writes a followup', async () => {
      const lead: Record<string, unknown> = { id: 1 };
      const reason = { id: 3, reason: 'Low income' };
      const rejectedBy = { id: 9, name: 'Manager' };
      const rejectStatus = { id: 9, name: 'REJECT', stageCode: 'S9' };
      leadRepository.findOne.mockResolvedValue(lead);
      rejectionReasonRepository.findOneBy.mockResolvedValue(reason);
      userRepository.findOneBy.mockResolvedValue(rejectedBy);
      userRepository.findOne.mockResolvedValue(rejectedBy);
      masterStatusRepository.findOne.mockResolvedValue(rejectStatus);

      await service.reject(1, { rejectionReasonId: 3 }, 9);

      expect(lead.leadStatus).toBe(rejectStatus);
      expect(lead.rejectionReason).toBe(reason);
      expect(lead.rejectedBy).toBe(rejectedBy);
      expect(lead.rejectedAt).toBeInstanceOf(Date);
      const [followupArg] = leadFollowupRepository.create.mock.calls[0];
      expect(followupArg.status).toBe(rejectStatus);
      expect(followupArg.remarks).toBe('Low income');
    });

    it('uses caller-supplied remarks over the rejection reason text', async () => {
      leadRepository.findOne.mockResolvedValue({ id: 1 });
      rejectionReasonRepository.findOneBy.mockResolvedValue({
        id: 3,
        reason: 'Low income',
      });
      userRepository.findOneBy.mockResolvedValue({ id: 9 });
      userRepository.findOne.mockResolvedValue({ id: 9 });

      await service.reject(
        1,
        { rejectionReasonId: 3, remarks: 'explicit remark' },
        9,
      );

      const [followupArg] = leadFollowupRepository.create.mock.calls[0];
      expect(followupArg.remarks).toBe('explicit remark');
    });

    it('throws NotFoundException for an unknown rejection reason', async () => {
      leadRepository.findOne.mockResolvedValue({ id: 1 });
      rejectionReasonRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.reject(1, { rejectionReasonId: 404 }, 9),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findCustomer', () => {
    it('returns the customer record for a lead', async () => {
      leadRepository.findOne.mockResolvedValue({ id: 1 });
      const customer = { id: 5, firstName: 'Jane' };
      leadCustomerRepository.findOne.mockResolvedValue(customer);

      const result = await service.findCustomer(1);
      expect(result).toBe(customer);
    });

    it('throws NotFoundException when no customer record exists yet', async () => {
      leadRepository.findOne.mockResolvedValue({ id: 1 });
      leadCustomerRepository.findOne.mockResolvedValue(null);

      await expect(service.findCustomer(1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('upsertCustomer', () => {
    it('creates a new customer record when none exists yet', async () => {
      const lead = { id: 1 };
      leadRepository.findOne.mockResolvedValue(lead);
      leadCustomerRepository.findOne.mockResolvedValue(null);

      const result = await service.upsertCustomer(1, {
        firstName: 'Jane',
      } as never);

      expect(leadCustomerRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ lead }),
      );
      expect(result.firstName).toBe('Jane');
      expect(leadCustomerRepository.save).toHaveBeenCalled();
    });

    it('updates the existing customer record in place', async () => {
      leadRepository.findOne.mockResolvedValue({ id: 1 });
      const existing = { id: 55, firstName: 'Old' };
      leadCustomerRepository.findOne.mockResolvedValue(existing);

      const result = await service.upsertCustomer(1, {
        firstName: 'New',
      } as never);

      expect(leadCustomerRepository.create).not.toHaveBeenCalled();
      expect(result).toBe(existing);
      expect(existing.firstName).toBe('New');
    });

    it('resolves FK lookup fields (state/city/marital status/etc)', async () => {
      leadRepository.findOne.mockResolvedValue({ id: 1 });
      leadCustomerRepository.findOne.mockResolvedValue(null);
      const state = { id: 4 };
      stateRepository.findOneBy.mockResolvedValue(state);

      const result = await service.upsertCustomer(1, { stateId: 4 } as never);
      expect(result.state).toBe(state);
    });

    it('throws NotFoundException when the lead does not exist', async () => {
      leadRepository.findOne.mockResolvedValue(null);
      await expect(
        service.upsertCustomer(99, { firstName: 'X' } as never),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findEmployment', () => {
    it('returns the employment record for a lead', async () => {
      leadRepository.findOne.mockResolvedValue({ id: 1 });
      const employment = { id: 5, employerName: 'Acme' };
      leadEmploymentRepository.findOne.mockResolvedValue(employment);

      const result = await service.findEmployment(1);
      expect(result).toBe(employment);
    });

    it('throws NotFoundException when no employment record exists yet', async () => {
      leadRepository.findOne.mockResolvedValue({ id: 1 });
      leadEmploymentRepository.findOne.mockResolvedValue(null);

      await expect(service.findEmployment(1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('upsertEmployment', () => {
    it('creates employment with the required incomeType when none exists', async () => {
      const lead = { id: 1 };
      leadRepository.findOne.mockResolvedValue(lead);
      leadEmploymentRepository.findOne.mockResolvedValue(null);

      const result = await service.upsertEmployment(1, {
        incomeType: 'SALARIED',
      } as never);

      expect(leadEmploymentRepository.create).toHaveBeenCalledWith({
        lead,
        incomeType: 'SALARIED',
      });
      expect(result.incomeType).toBe('SALARIED');
    });

    it('updates the existing employment record in place', async () => {
      leadRepository.findOne.mockResolvedValue({ id: 1 });
      const existing = { id: 3, incomeType: 'SALARIED', employerName: 'Old' };
      leadEmploymentRepository.findOne.mockResolvedValue(existing);

      const result = await service.upsertEmployment(1, {
        incomeType: 'SELF_EMPLOYED',
        employerName: 'New',
      } as never);

      expect(result).toBe(existing);
      expect(existing.employerName).toBe('New');
      expect(existing.incomeType).toBe('SELF_EMPLOYED');
    });
  });

  describe('references', () => {
    it('listReferences 404s when the lead does not exist', async () => {
      leadRepository.findOne.mockResolvedValue(null);
      await expect(service.listReferences(99)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('addReference creates a reference tied to the lead', async () => {
      const lead = { id: 1 };
      leadRepository.findOne.mockResolvedValue(lead);

      const result = await service.addReference(1, {
        name: 'Bob',
        mobile: '888',
      });

      expect(leadCustomerReferenceRepository.create).toHaveBeenCalledWith({
        lead,
        name: 'Bob',
        mobile: '888',
        relationType: null,
        createdAt: expect.any(Date),
      });
      expect(result.name).toBe('Bob');
    });

    it('removeReference soft-deletes (isActive=false, isDeleted=true)', async () => {
      const reference = { id: 5, isActive: true, isDeleted: false };
      leadCustomerReferenceRepository.findOne.mockResolvedValue(reference);

      await service.removeReference(1, 5);

      expect(reference.isActive).toBe(false);
      expect(reference.isDeleted).toBe(true);
      expect(leadCustomerReferenceRepository.save).toHaveBeenCalledWith(
        reference,
      );
    });

    it('removeReference 404s for a reference belonging to a different lead', async () => {
      leadCustomerReferenceRepository.findOne.mockResolvedValue(null);
      await expect(service.removeReference(1, 999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('followups', () => {
    it('listFollowups 404s when the lead does not exist', async () => {
      leadRepository.findOne.mockResolvedValue(null);
      await expect(service.listFollowups(99, {} as never)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('listFollowups paginates and orders newest-first', async () => {
      leadRepository.findOne.mockResolvedValue({ id: 1 });
      const followup = { id: 10 };
      leadFollowupRepository.findAndCount.mockResolvedValue([[followup], 1]);

      const result = await service.listFollowups(1, {
        page: 1,
        limit: 20,
      } as never);

      expect(result).toEqual({
        data: [followup],
        page: 1,
        limit: 20,
        total: 1,
      });
      const [args] = leadFollowupRepository.findAndCount.mock.calls[0];
      expect(args.order).toEqual({ id: 'DESC' });
    });

    it('addFollowup writes a followup entry with no status change (manual note)', async () => {
      const lead = { id: 1 };
      leadRepository.findOne.mockResolvedValue(lead);
      userRepository.findOne.mockResolvedValue({ id: 9 });

      const result = await service.addFollowup(
        1,
        { remarks: 'called customer' },
        9,
      );

      expect(result.remarks).toBe('called customer');
      expect(result.status).toBeNull();
      expect(leadFollowupRepository.save).toHaveBeenCalled();
    });
  });

  describe('listQueue', () => {
    it('falls back to the unrestricted list() for a role with no defined queue (e.g. SA)', async () => {
      const qb = mockQueryBuilder([{ id: 1 }], 1);
      leadRepository.createQueryBuilder = jest.fn().mockReturnValue(qb);

      const result = await service.listQueue({}, 9, ['SA']);

      expect(leadRepository.createQueryBuilder).toHaveBeenCalledWith('lead');
      expect(result).toEqual({
        data: [{ id: 1 }],
        page: 1,
        limit: 20,
        total: 1,
      });
    });

    it('falls back to the unrestricted list() when the user has no roles at all', async () => {
      const qb = mockQueryBuilder([]);
      leadRepository.createQueryBuilder = jest.fn().mockReturnValue(qb);

      await service.listQueue({}, 9, []);

      expect(leadRepository.createQueryBuilder).toHaveBeenCalledWith('lead');
    });

    it('CR1 uses a scoped query builder, not the unrestricted list()', async () => {
      const qb = mockQueryBuilder([{ id: 5 }], 1);
      leadRepository.createQueryBuilder = jest.fn().mockReturnValue(qb);

      const result = await service.listQueue({}, 9, ['CR1']);

      expect(leadRepository.createQueryBuilder).toHaveBeenCalledWith('lead');
      expect(leadRepository.findAndCount).not.toHaveBeenCalled();
      expect(qb.andWhere).toHaveBeenCalled();
      expect(result).toEqual({
        data: [{ id: 5 }],
        page: 1,
        limit: 20,
        total: 1,
      });
    });

    it('applies the standard list filters (e.g. search) on top of the role scope, matching firstName/mobile/email', async () => {
      const qb = mockQueryBuilder([]);
      leadRepository.createQueryBuilder = jest.fn().mockReturnValue(qb);

      await service.listQueue({ search: 'ramesh' }, 9, ['DS1']);

      // andWhere call order: [0] role-scope Brackets, [1] this search Brackets.
      const [brackets] = qb.andWhere.mock.calls[1];
      const searchQb = { where: jest.fn(), orWhere: jest.fn() };
      searchQb.where.mockReturnValue(searchQb);
      searchQb.orWhere.mockReturnValue(searchQb);
      brackets.whereFactory(searchQb);
      expect(searchQb.where).toHaveBeenCalledWith(
        'lead.firstName LIKE :search',
        { search: '%ramesh%' },
      );
      expect(searchQb.orWhere).toHaveBeenCalledWith('lead.mobile LIKE :search', {
        search: '%ramesh%',
      });
      expect(searchQb.orWhere).toHaveBeenCalledWith('lead.email LIKE :search', {
        search: '%ramesh%',
      });
    });

    it('a user holding multiple mapped roles still uses the scoped query builder once', async () => {
      const qb = mockQueryBuilder([]);
      leadRepository.createQueryBuilder = jest.fn().mockReturnValue(qb);

      await service.listQueue({}, 9, ['CR1', 'CR2']);

      expect(leadRepository.createQueryBuilder).toHaveBeenCalledTimes(1);
    });

    it('CO2 with no covered states sees an empty queue, not every lead', async () => {
      userRoleLocationRepository.find.mockResolvedValue([]);
      leadRepository.createQueryBuilder = jest.fn();

      const result = await service.listQueue({}, 9, ['CO2']);

      expect(leadRepository.createQueryBuilder).not.toHaveBeenCalled();
      expect(leadRepository.findAndCount).not.toHaveBeenCalled();
      expect(result).toEqual({ data: [], page: 1, limit: 20, total: 0 });
    });

    it('CO2 with covered states scopes the queue by lead.state', async () => {
      userRoleLocationRepository.find.mockResolvedValue([
        { locationId: 4 },
        { locationId: 7 },
      ]);
      const qb = mockQueryBuilder([{ id: 3 }], 1);
      leadRepository.createQueryBuilder = jest.fn().mockReturnValue(qb);

      await service.listQueue({}, 9, ['CO2']);

      expect(userRoleLocationRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userRole: expect.objectContaining({
              user: { id: 9 },
              roleType: { code: 'CO2' },
            }),
          }),
        }),
      );

      const [brackets] = qb.andWhere.mock.calls[0];
      const scopeQb = { where: jest.fn(), orWhere: jest.fn() };
      brackets.whereFactory(scopeQb);
      expect(scopeQb.where).toHaveBeenCalledWith(
        expect.stringContaining('state.id IN (:...stateIds0)'),
        expect.objectContaining({ stateIds0: [4, 7] }),
      );
    });
  });
});
