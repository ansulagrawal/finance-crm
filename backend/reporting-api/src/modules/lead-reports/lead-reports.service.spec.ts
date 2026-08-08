import { Lead, MasterStatus } from '@finance-crm/database';
import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LeadReportsService } from './lead-reports.service';

function createQueryBuilderMock(finalResult: unknown) {
  const qb: Record<string, jest.Mock> = {};
  const chainMethods = [
    'select',
    'addSelect',
    'innerJoin',
    'leftJoin',
    'where',
    'andWhere',
    'setParameter',
    'groupBy',
    'addGroupBy',
    'orderBy',
    'addOrderBy',
  ];
  for (const method of chainMethods) {
    qb[method] = jest.fn().mockReturnThis();
  }
  qb.getRawMany = jest.fn().mockResolvedValue(finalResult);
  qb.getMany = jest.fn().mockResolvedValue(finalResult);
  return qb;
}

describe('LeadReportsService', () => {
  let service: LeadReportsService;
  let leadRepository: {
    createQueryBuilder: jest.Mock;
    find: jest.Mock;
  };
  let masterStatusRepository: { find: jest.Mock; findOne: jest.Mock };

  beforeEach(async () => {
    leadRepository = {
      createQueryBuilder: jest.fn(),
      find: jest.fn(),
    };
    masterStatusRepository = { find: jest.fn(), findOne: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        LeadReportsService,
        { provide: getRepositoryToken(Lead), useValue: leadRepository },
        {
          provide: getRepositoryToken(MasterStatus),
          useValue: masterStatusRepository,
        },
      ],
    }).compile();

    service = moduleRef.get(LeadReportsService);
  });

  it('leadSource merges zero-count statuses with real counts', async () => {
    masterStatusRepository.find.mockResolvedValue([
      { id: 1, name: 'NEW', sortOrder: 1 },
      { id: 2, name: 'DISBURSED', sortOrder: 2 },
    ]);
    const qb = createQueryBuilderMock([{ statusId: 1, count: '5' }]);
    leadRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.leadSource({
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
    });

    expect(result.rows).toEqual([
      { statusId: 1, statusName: 'NEW', count: 5 },
      { statusId: 2, statusName: 'DISBURSED', count: 0 },
    ]);
    expect(result.totalLeads).toBe(5);
  });

  it('systemRejectedStatus joins on the resolved status id, not a raw relation path', async () => {
    masterStatusRepository.findOne.mockResolvedValue({ id: 9 });
    const qb = createQueryBuilderMock([
      { dataSourceName: 'Google', count: '3' },
    ]);
    leadRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.systemRejectedStatus({
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
    });

    expect(qb.where).toHaveBeenCalledWith('lead.leadStatus = :statusId', {
      statusId: 9,
    });
    expect(result.rows).toEqual([{ dataSourceName: 'Google', count: '3' }]);
  });

  it('systemRejectedStatus short-circuits when SYSTEM-REJECT status is unseeded', async () => {
    masterStatusRepository.findOne.mockResolvedValue(null);

    const result = await service.systemRejectedStatus({
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
    });

    expect(result.rows).toEqual([]);
    expect(leadRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('leadConversion rejects a date range over 30 days', async () => {
    await expect(
      service.leadConversion({ fromDate: '2026-01-01', toDate: '2026-03-01' }),
    ).rejects.toThrow(BadRequestException);
    expect(leadRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('leadConversion allows a 30-day-or-shorter range', async () => {
    const qb = createQueryBuilderMock([
      { incomeBracket: '< 15,000', totalLeads: '10', converted: '2' },
    ]);
    leadRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.leadConversion({
      fromDate: '2026-01-01',
      toDate: '2026-01-30',
    });

    expect(result).toEqual([
      { incomeBracket: '< 15,000', totalLeads: '10', converted: '2' },
    ]);
  });

  it('processTat computes stage-to-stage hour diffs from denormalized Lead timestamps', async () => {
    leadRepository.createQueryBuilder.mockReturnValue(
      createQueryBuilderMock(undefined),
    );
    const qb = leadRepository.createQueryBuilder();
    qb.getMany.mockResolvedValue([
      {
        id: 1,
        screenerAssignedAt: new Date('2026-01-01T00:00:00Z'),
        creditApprovedAt: new Date('2026-01-01T02:00:00Z'),
        disbursalApprovedAt: new Date('2026-01-01T05:00:00Z'),
        finalDisbursedAt: new Date('2026-01-01T06:00:00Z'),
      },
    ]);
    leadRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.processTat('2026-01-01');

    expect(result).toEqual([
      {
        leadId: 1,
        screenerToSanctionHours: 2,
        sanctionToDisbursalApprovalHours: 3,
        disbursalApprovalToDisbursedHours: 1,
      },
    ]);
  });

  it('leadSourceStatus groups counts by source and status', async () => {
    const qb = createQueryBuilderMock([
      { source: 'WEBSITE', statusName: 'NEW', sortOrder: 1, count: '4' },
    ]);
    leadRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.leadSourceStatus({
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
    });

    expect(result).toEqual([
      { source: 'WEBSITE', statusName: 'NEW', sortOrder: 1, count: '4' },
    ]);
    expect(qb.andWhere).toHaveBeenCalledWith('lead.source IS NOT NULL');
  });

  it('leadSourceStatus returns an empty array when nothing entered in range', async () => {
    const qb = createQueryBuilderMock([]);
    leadRepository.createQueryBuilder.mockReturnValue(qb);

    expect(
      await service.leadSourceStatus({
        fromDate: '2026-01-01',
        toDate: '2026-01-31',
      }),
    ).toEqual([]);
  });

  it('sanctionProductivity computes today/MTD counts scoped to the given user type', async () => {
    const qb = createQueryBuilderMock([
      {
        screenerId: 1,
        screenerName: 'Priya',
        screenedToday: '2',
        sanctionedToday: '1',
        disbursedToday: '0',
        screenedMtd: '20',
        sanctionedMtd: '10',
        disbursedMtd: '5',
      },
    ]);
    leadRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.sanctionProductivity('NEW', '2026-01-15');

    expect(result).toEqual([
      {
        screenerId: 1,
        screenerName: 'Priya',
        screenedToday: '2',
        sanctionedToday: '1',
        disbursedToday: '0',
        screenedMtd: '20',
        sanctionedMtd: '10',
        disbursedMtd: '5',
      },
    ]);
    expect(qb.andWhere).toHaveBeenCalledWith('lead.userType = :userType', {
      userType: 'NEW',
    });
    expect(qb.andWhere).toHaveBeenCalledWith(
      'lead.leadEntryDate BETWEEN :monthStart AND :toDate',
      { monthStart: '2026-01-01', toDate: '2026-01-15' },
    );
  });

  it('sanctionProductivity returns an empty array when the screener has no leads this month', async () => {
    const qb = createQueryBuilderMock([]);
    leadRepository.createQueryBuilder.mockReturnValue(qb);

    expect(await service.sanctionProductivity('REPEAT', '2026-01-15')).toEqual(
      [],
    );
  });

  it('hourlyStatusWise groups status counts by hour-of-day and user type', async () => {
    const qb = createQueryBuilderMock([
      { statusId: 1, statusName: 'NEW', hour: 10, userType: 'NEW', count: '3' },
    ]);
    leadRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.hourlyStatusWise({
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
    });

    expect(result).toEqual([
      { statusId: 1, statusName: 'NEW', hour: 10, userType: 'NEW', count: '3' },
    ]);
  });

  it('hourlyStatusWise returns an empty array when no leads entered in range', async () => {
    const qb = createQueryBuilderMock([]);
    leadRepository.createQueryBuilder.mockReturnValue(qb);

    expect(
      await service.hourlyStatusWise({
        fromDate: '2026-01-01',
        toDate: '2026-01-31',
      }),
    ).toEqual([]);
  });

  it('leadUtmSourceStatus uppercases utm_source and groups by status', async () => {
    const qb = createQueryBuilderMock([
      { utmSource: 'GOOGLE_ADS', statusId: 1, statusName: 'NEW', count: '6' },
    ]);
    leadRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.leadUtmSourceStatus({
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
    });

    expect(result).toEqual([
      { utmSource: 'GOOGLE_ADS', statusId: 1, statusName: 'NEW', count: '6' },
    ]);
    expect(qb.select).toHaveBeenCalledWith(
      'UPPER(lead.utmSource)',
      'utmSource',
    );
  });

  it('leadUtmSourceStatus returns an empty array when no leads entered in range', async () => {
    const qb = createQueryBuilderMock([]);
    leadRepository.createQueryBuilder.mockReturnValue(qb);

    expect(
      await service.leadUtmSourceStatus({
        fromDate: '2026-01-01',
        toDate: '2026-01-31',
      }),
    ).toEqual([]);
  });

  it('leadUtmCampaignStatus groups counts by utm_campaign and status', async () => {
    const qb = createQueryBuilderMock([
      {
        utmCampaign: 'summer-2026',
        statusId: 2,
        statusName: 'DISBURSED',
        count: '9',
      },
    ]);
    leadRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.leadUtmCampaignStatus({
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
    });

    expect(result).toEqual([
      {
        utmCampaign: 'summer-2026',
        statusId: 2,
        statusName: 'DISBURSED',
        count: '9',
      },
    ]);
  });

  it('leadUtmCampaignStatus returns an empty array when no leads entered in range', async () => {
    const qb = createQueryBuilderMock([]);
    leadRepository.createQueryBuilder.mockReturnValue(qb);

    expect(
      await service.leadUtmCampaignStatus({
        fromDate: '2026-01-01',
        toDate: '2026-01-31',
      }),
    ).toEqual([]);
  });

  it('sourceUtmSourceStatus groups the combined source/utm_source/utm_campaign x status matrix', async () => {
    const qb = createQueryBuilderMock([
      {
        source: 'WEBSITE',
        utmSource: 'google',
        utmCampaign: 'summer',
        statusId: 1,
        statusName: 'NEW',
        count: '2',
      },
    ]);
    leadRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.sourceUtmSourceStatus({
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
    });

    expect(result).toEqual([
      {
        source: 'WEBSITE',
        utmSource: 'google',
        utmCampaign: 'summer',
        statusId: 1,
        statusName: 'NEW',
        count: '2',
      },
    ]);
  });

  it('sourceUtmSourceStatus returns an empty array when no leads entered in range', async () => {
    const qb = createQueryBuilderMock([]);
    leadRepository.createQueryBuilder.mockReturnValue(qb);

    expect(
      await service.sourceUtmSourceStatus({
        fromDate: '2026-01-01',
        toDate: '2026-01-31',
      }),
    ).toEqual([]);
  });

  it('leadSourcingCityWiseStatus groups by city and status (schema has no isSourcing flag)', async () => {
    const qb = createQueryBuilderMock([
      { cityName: 'Jaipur', statusId: 1, statusName: 'NEW', count: '5' },
    ]);
    leadRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.leadSourcingCityWiseStatus({
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
    });

    expect(result).toEqual([
      { cityName: 'Jaipur', statusId: 1, statusName: 'NEW', count: '5' },
    ]);
  });

  it('leadSourcingCityWiseStatus returns an empty array when no leads entered in range', async () => {
    const qb = createQueryBuilderMock([]);
    leadRepository.createQueryBuilder.mockReturnValue(qb);

    expect(
      await service.leadSourcingCityWiseStatus({
        fromDate: '2026-01-01',
        toDate: '2026-01-31',
      }),
    ).toEqual([]);
  });

  it('leadCityWiseStatus groups pan-India lead counts by city and status', async () => {
    const qb = createQueryBuilderMock([
      { cityName: 'Mumbai', statusId: 2, statusName: 'DISBURSED', count: '8' },
    ]);
    leadRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.leadCityWiseStatus({
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
    });

    expect(result).toEqual([
      { cityName: 'Mumbai', statusId: 2, statusName: 'DISBURSED', count: '8' },
    ]);
  });

  it('leadCityWiseStatus returns an empty array when no leads entered in range', async () => {
    const qb = createQueryBuilderMock([]);
    leadRepository.createQueryBuilder.mockReturnValue(qb);

    expect(
      await service.leadCityWiseStatus({
        fromDate: '2026-01-01',
        toDate: '2026-01-31',
      }),
    ).toEqual([]);
  });

  it('rejectionAnalysis groups rejected-lead counts by reason and data source', async () => {
    const qb = createQueryBuilderMock([
      {
        dataSourceName: 'Google',
        rejectionReason: 'Low CIBIL score',
        count: '7',
      },
    ]);
    leadRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.rejectionAnalysis({
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
    });

    expect(result).toEqual([
      {
        dataSourceName: 'Google',
        rejectionReason: 'Low CIBIL score',
        count: '7',
      },
    ]);
  });

  it('rejectionAnalysis returns an empty array when nothing was rejected in range', async () => {
    const qb = createQueryBuilderMock([]);
    leadRepository.createQueryBuilder.mockReturnValue(qb);

    expect(
      await service.rejectionAnalysis({
        fromDate: '2026-01-01',
        toDate: '2026-01-31',
      }),
    ).toEqual([]);
  });

  it('leadAssignmentSummary groups current open-lead counts by credit-assigned user and user type', async () => {
    const qb = createQueryBuilderMock([
      {
        userId: 1,
        userName: 'Amit',
        email: 'amit@financecrm.com',
        userType: 'NEW',
        totalLeads: '12',
      },
    ]);
    leadRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.leadAssignmentSummary();

    expect(result).toEqual([
      {
        userId: 1,
        userName: 'Amit',
        email: 'amit@financecrm.com',
        userType: 'NEW',
        totalLeads: '12',
      },
    ]);
    expect(qb.where).toHaveBeenCalledWith('lead.isActive = :active', {
      active: true,
    });
  });

  it('leadAssignmentSummary returns an empty array when no leads are currently assigned', async () => {
    const qb = createQueryBuilderMock([]);
    leadRepository.createQueryBuilder.mockReturnValue(qb);

    expect(await service.leadAssignmentSummary()).toEqual([]);
  });

  it('leadRejectionAnalysisCampaign applies the utmCampaign filter only when provided', async () => {
    const qb = createQueryBuilderMock([
      { utmCampaign: 'summer-2026', rejectionReason: 'Duplicate', count: '3' },
    ]);
    leadRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.leadRejectionAnalysisCampaign({
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
      utmCampaign: 'summer-2026',
    });

    expect(result).toEqual([
      { utmCampaign: 'summer-2026', rejectionReason: 'Duplicate', count: '3' },
    ]);
    expect(qb.andWhere).toHaveBeenCalledWith(
      'lead.utmCampaign = :utmCampaign',
      { utmCampaign: 'summer-2026' },
    );
  });

  it('leadRejectionAnalysisCampaign skips the campaign filter when not provided', async () => {
    const qb = createQueryBuilderMock([]);
    leadRepository.createQueryBuilder.mockReturnValue(qb);

    await service.leadRejectionAnalysisCampaign({
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
    });

    expect(qb.andWhere).not.toHaveBeenCalledWith(
      'lead.utmCampaign = :utmCampaign',
      expect.anything(),
    );
  });

  it('leadDigitalSummary returns per-utm_source funnel totals (simplified from legacy Organic classification)', async () => {
    const qb = createQueryBuilderMock([
      {
        utmSource: 'google',
        totalLeads: '10',
        disbursed: '3',
        totalLoanAmount: '150000',
      },
    ]);
    leadRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.leadDigitalSummary({
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
    });

    expect(result).toEqual([
      {
        utmSource: 'google',
        totalLeads: '10',
        disbursed: '3',
        totalLoanAmount: '150000',
      },
    ]);
  });

  it('leadDigitalSummary returns an empty array when no leads entered in range', async () => {
    const qb = createQueryBuilderMock([]);
    leadRepository.createQueryBuilder.mockReturnValue(qb);

    expect(
      await service.leadDigitalSummary({
        fromDate: '2026-01-01',
        toDate: '2026-01-31',
      }),
    ).toEqual([]);
  });
});
