import { IncomeType, LeadUserType } from '@finance-crm/database';
import { LeadEligibilityService } from './lead-eligibility.service';

function repo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    findOneBy: jest.fn().mockResolvedValue(null),
    count: jest.fn().mockResolvedValue(0),
    save: jest.fn(async (x: unknown) => x),
    create: jest.fn((x: unknown) => x),
    ...overrides,
  };
}

describe('LeadEligibilityService', () => {
  let service: LeadEligibilityService;
  let leadRepository: ReturnType<typeof repo>;
  let leadCustomerRepository: ReturnType<typeof repo>;
  let leadEmploymentRepository: ReturnType<typeof repo>;
  let rejectionReasonRepository: ReturnType<typeof repo>;
  let masterStatusRepository: ReturnType<typeof repo>;
  let leadFollowupRepository: ReturnType<typeof repo>;
  let loanRepository: ReturnType<typeof repo>;
  let camRepository: ReturnType<typeof repo>;
  let isBlacklisted: jest.Mock;

  const baseLead = () => ({
    id: 1,
    pancard: 'ABCDE1234F',
    mobile: '9876543210',
    email: 'a@b.com',
    monthlySalaryAmount: 40000,
    userType: LeadUserType.NEW,
    state: { name: 'Delhi', isSourcing: true },
    city: { name: 'New Delhi', isSourcing: true },
  });

  const systemRejectStatus = { id: 8, name: 'SYSTEM-REJECT' };
  const rejectStatus = { id: 9, name: 'REJECT' };

  beforeEach(() => {
    leadRepository = repo();
    leadCustomerRepository = repo();
    leadEmploymentRepository = repo();
    rejectionReasonRepository = repo();
    masterStatusRepository = repo();
    leadFollowupRepository = repo();
    loanRepository = repo();
    camRepository = repo();
    isBlacklisted = jest.fn().mockResolvedValue(false);

    leadRepository.findOneBy.mockResolvedValue(baseLead());
    leadRepository.findOne.mockResolvedValue(baseLead());
    masterStatusRepository.findOne.mockImplementation(
      async ({ where }: { where: { name: string } }) => {
        if (where.name === 'SYSTEM-REJECT') return systemRejectStatus;
        if (where.name === 'REJECT') return rejectStatus;
        return null;
      },
    );
    masterStatusRepository.find.mockResolvedValue([]);

    service = new LeadEligibilityService(
      leadRepository as never,
      leadCustomerRepository as never,
      leadEmploymentRepository as never,
      rejectionReasonRepository as never,
      masterStatusRepository as never,
      leadFollowupRepository as never,
      loanRepository as never,
      camRepository as never,
      { isBlacklisted } as never,
    );
  });

  it('passes when every check is either satisfied or not applicable', async () => {
    const result = await service.evaluate(1);

    expect(result.eligible).toBe(true);
    expect(result.rejectionReasonText).toBeNull();
    expect(leadRepository.save).not.toHaveBeenCalled();
  });

  it('rejects self-employed leads with SELF EMPLOYED', async () => {
    leadEmploymentRepository.findOne.mockResolvedValue({
      incomeType: IncomeType.SELF_EMPLOYED,
    });

    const result = await service.evaluate(1);

    expect(result.eligible).toBe(false);
    expect(result.rejectionReasonText).toBe('SELF EMPLOYED');
    expect(leadRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ leadStatus: systemRejectStatus }),
    );
  });

  it('rejects cash salary mode', async () => {
    leadEmploymentRepository.findOne.mockResolvedValue({
      salaryMode: 'CASH',
    });

    const result = await service.evaluate(1);

    expect(result.rejectionReasonText).toBe('NE: SALARY CASH/ NOT RECEIVED');
  });

  it('rejects low salary for a NEW lead but allows it for REPEAT', async () => {
    leadRepository.findOne.mockResolvedValue({
      ...baseLead(),
      monthlySalaryAmount: 10000,
    });
    const result = await service.evaluate(1);
    expect(result.rejectionReasonText).toBe('NE: SALARY LOW');

    leadRepository.findOne.mockResolvedValue({
      ...baseLead(),
      monthlySalaryAmount: 10000,
      userType: LeadUserType.REPEAT,
    });
    const repeatResult = await service.evaluate(1);
    expect(repeatResult.eligible).toBe(true);
  });

  it('rejects age outside 21-54', async () => {
    leadCustomerRepository.findOne.mockResolvedValue({ dob: '2020-01-01' });

    const result = await service.evaluate(1);

    expect(result.rejectionReasonText).toBe('INTERNAL CRITERIA DO NOT MATCH');
  });

  it('rejects a non-sourcing state/city', async () => {
    leadRepository.findOne.mockResolvedValue({
      ...baseLead(),
      state: { name: 'Sikkim', isSourcing: false },
    });

    const result = await service.evaluate(1);

    expect(result.rejectionReasonText).toBe('OUTSIDE GEO LIMITS (OGL)');
  });

  it('rejects a blacklisted identity', async () => {
    isBlacklisted.mockResolvedValue(true);

    const result = await service.evaluate(1);

    expect(result.rejectionReasonText).toBe('BLACK LISTED CUSTOMER');
  });

  it('rejects a same-day duplicate (same PAN/mobile/email already applied today)', async () => {
    leadRepository.count.mockResolvedValue(1);

    const result = await service.evaluate(1);

    expect(result.rejectionReasonText).toBe('DUPLICATE LEAD');
  });

  it('rejects when the most recent DPD exceeds 15, overriding an earlier failure', async () => {
    leadEmploymentRepository.findOne.mockResolvedValue({
      incomeType: IncomeType.SELF_EMPLOYED,
    });
    masterStatusRepository.find.mockResolvedValue([{ id: 14 }]);
    loanRepository.findOne.mockResolvedValue({
      id: 1,
      lead: { id: 1 },
      closedAt: '2026-02-01',
      settledAt: null,
      writtenOffAt: null,
    });
    camRepository.findOne.mockResolvedValue({
      repaymentDate: '2026-01-01',
    });

    const result = await service.evaluate(1);

    expect(result.rejectionReasonText).toBe(
      'NOT ELIGIBLE - RECENT 30+ DPD IN PL',
    );
  });

  it('writes a LeadFollowup with the joined remarks on rejection', async () => {
    leadEmploymentRepository.findOne.mockResolvedValue({
      incomeType: IncomeType.SELF_EMPLOYED,
    });

    await service.evaluate(1);

    expect(leadFollowupRepository.save).toHaveBeenCalled();
    const [followupArg] = leadFollowupRepository.create.mock.calls[0];
    expect(followupArg.remarks).toContain('Eligibility Rules');
    expect(followupArg.status).toBe(systemRejectStatus);
  });
});
