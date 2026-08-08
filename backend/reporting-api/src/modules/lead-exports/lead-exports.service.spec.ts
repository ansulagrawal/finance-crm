import { BreRuleResult, Lead } from '@finance-crm/database';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LeadExportsService } from './lead-exports.service';

function createQueryBuilderMock(finalResult: unknown) {
  const qb: Record<string, jest.Mock> = {};
  const chainMethods = [
    'select',
    'addSelect',
    'innerJoin',
    'leftJoin',
    'where',
    'andWhere',
    'groupBy',
    'addGroupBy',
    'orderBy',
  ];
  for (const method of chainMethods) {
    qb[method] = jest.fn().mockReturnThis();
  }
  qb.getRawMany = jest.fn().mockResolvedValue(finalResult);
  return qb;
}

describe('LeadExportsService', () => {
  let service: LeadExportsService;
  let leadRepository: { createQueryBuilder: jest.Mock };
  let breRuleResultRepository: { createQueryBuilder: jest.Mock };

  beforeEach(async () => {
    leadRepository = { createQueryBuilder: jest.fn() };
    breRuleResultRepository = { createQueryBuilder: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        LeadExportsService,
        { provide: getRepositoryToken(Lead), useValue: leadRepository },
        {
          provide: getRepositoryToken(BreRuleResult),
          useValue: breRuleResultRepository,
        },
      ],
    }).compile();

    service = moduleRef.get(LeadExportsService);
  });

  it('leadDuplicate filters by the DUPLICATE master status name', async () => {
    const qb = createQueryBuilderMock([{ leadId: 1, firstName: 'Asha' }]);
    leadRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.leadDuplicate({
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
    });

    expect(qb.where).toHaveBeenCalledWith('status.name = :statusName', {
      statusName: 'DUPLICATE',
    });
    expect(result).toEqual([{ leadId: 1, firstName: 'Asha' }]);
  });

  it('leadTotal applies the optional utmSource filter only when provided', async () => {
    const qb = createQueryBuilderMock([]);
    leadRepository.createQueryBuilder.mockReturnValue(qb);

    await service.leadTotal({
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
      utmSource: 'google_ads',
    });

    expect(qb.andWhere).toHaveBeenCalledWith('lead.utmSource = :utmSource', {
      utmSource: 'google_ads',
    });
  });

  it('leadTotal skips the utmSource filter when not provided', async () => {
    const qb = createQueryBuilderMock([]);
    leadRepository.createQueryBuilder.mockReturnValue(qb);

    await service.leadTotal({ fromDate: '2026-01-01', toDate: '2026-01-31' });

    expect(qb.andWhere).not.toHaveBeenCalledWith(
      'lead.utmSource = :utmSource',
      expect.anything(),
    );
  });

  it('leadRejected attaches joined BRE rejection rule names per lead', async () => {
    const leadQb = createQueryBuilderMock([
      { leadId: 1, firstName: 'Asha' },
      { leadId: 2, firstName: 'Ravi' },
    ]);
    leadRepository.createQueryBuilder.mockReturnValue(leadQb);

    const breQb = createQueryBuilderMock([
      {
        leadId: 1,
        ruleName: 'Income Below Threshold',
        systemDecision: 'REJECT',
      },
      { leadId: 1, ruleName: 'Blacklisted Pincode', systemDecision: 'REJECT' },
    ]);
    breRuleResultRepository.createQueryBuilder.mockReturnValue(breQb);

    const result = await service.leadRejected({
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
    });

    expect(result).toEqual([
      {
        leadId: 1,
        firstName: 'Asha',
        breRejectionRules: 'Income Below Threshold; Blacklisted Pincode',
      },
      { leadId: 2, firstName: 'Ravi', breRejectionRules: '' },
    ]);
  });

  it('leadRejected skips the BRE lookup entirely when there are no rejected leads', async () => {
    const leadQb = createQueryBuilderMock([]);
    leadRepository.createQueryBuilder.mockReturnValue(leadQb);

    const result = await service.leadRejected({
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
    });

    expect(result).toEqual([]);
    expect(breRuleResultRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('partialLeadData filters to leads with no captured first name', async () => {
    const qb = createQueryBuilderMock([{ leadId: 3, mobile: '9999999999' }]);
    leadRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.partialLeadData({
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
    });

    expect(qb.andWhere).toHaveBeenCalledWith('lead.firstName IS NULL');
    expect(result).toEqual([{ leadId: 3, mobile: '9999999999' }]);
  });

  it('leadInteractionSummary returns per-lead stage-assignment detail within the entry-date range', async () => {
    const qb = createQueryBuilderMock([
      {
        leadId: 4,
        status: 'DISBURSED',
        screenerUserName: 'Priya',
        creditUserName: 'Amit',
      },
    ]);
    leadRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.leadInteractionSummary({
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
    });

    expect(result).toEqual([
      {
        leadId: 4,
        status: 'DISBURSED',
        screenerUserName: 'Priya',
        creditUserName: 'Amit',
      },
    ]);
    expect(qb.where).toHaveBeenCalledWith(
      'lead.leadEntryDate BETWEEN :from AND :to',
      { from: '2026-01-01', to: '2026-01-31' },
    );
  });

  it('leadInteractionSummary returns an empty array when no leads entered in range', async () => {
    const qb = createQueryBuilderMock([]);
    leadRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.leadInteractionSummary({
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
    });

    expect(result).toEqual([]);
  });
});
