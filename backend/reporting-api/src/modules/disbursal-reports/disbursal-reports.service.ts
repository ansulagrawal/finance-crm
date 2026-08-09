import { CreditAnalysisMemo, Lead, Loan, MasterStatus } from '@finance-crm/database';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { DateRangeQueryDto } from '../../common/dto/date-range-query.dto';
import { MonthQueryDto } from './dto/month-query.dto';

/** Legacy filters every disbursal report to leads in one of these final
 * lifecycle states — `lead_status_id IN (14, 16, 17, 18, 19)` — the exact
 * `MasterStatus.name` set, since our own numeric ids don't match legacy's
 * (they were assigned by re-seeding order, not preserved 1:1). */
const DISBURSED_LEAD_STATUS_NAMES = [
  'DISBURSED',
  'CLOSED',
  'SETTLED',
  'WRITEOFF',
  'PART-PAYMENT',
];

const HOUR_BANDS: Array<{ label: string; startHour: number; endHour: number }> =
  [
    { label: '12:01 AM-10:00 AM', startHour: 0, endHour: 10 },
    { label: '10:01 AM-12:00 PM', startHour: 10, endHour: 12 },
    { label: '12:01 PM-02:00 PM', startHour: 12, endHour: 14 },
    { label: '02:01 PM-04:00 PM', startHour: 14, endHour: 16 },
    { label: '04:01 PM-06:00 PM', startHour: 16, endHour: 18 },
    { label: '06:01 PM-08:00 PM', startHour: 18, endHour: 20 },
    { label: '08:01 PM-10:00 PM', startHour: 20, endHour: 22 },
    { label: '10:01 PM-12:00 AM', startHour: 22, endHour: 24 },
  ];

function bandForHour(hour: number): string {
  const band = HOUR_BANDS.find((b) => hour >= b.startHour && hour < b.endHour);
  return band?.label ?? HOUR_BANDS[0].label;
}

function monthRange(month: string): { start: Date; end: Date } {
  const d = new Date(month);
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
  return { start, end };
}

/**
 * Two real fixes from the pre-rewrite version of this file: joins targeted
 * raw plural table-name strings (`'credit_analysis_memos'`/`'loans'`) that
 * don't exist in the real legacy schema (the real tables are singular —
 * `credit_analysis_memo`/`loan`) — switched to joining the entity classes
 * directly, which also makes every `alias.property` reference inside these
 * joins' ON conditions and select clauses translate correctly. `LoanStatus`
 * (an enum that doesn't exist — `Loan.status` is a legacy free-string
 * label) is replaced with the `'DISBURSED'` string constant, matching the
 * pattern already established in `core-api`'s `disbursal.service.ts`.
 */
@Injectable()
export class DisbursalReportsService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(MasterStatus)
    private readonly masterStatusRepository: Repository<MasterStatus>,
  ) {}

  private async statusIdsFor(names: string[]): Promise<number[]> {
    const statuses = await this.masterStatusRepository.find({
      where: names.map((name) => ({ name })),
    });
    return statuses.map((s) => s.id);
  }

  /** report_id 6 (`DisbursedReport`) — month-wise disbursal summary: count,
   * admin fee, and recommended-amount totals grouped by disbursal date. */
  async disbursalSummary(query: MonthQueryDto) {
    const { start, end } = monthRange(query.month);
    const statusIds = await this.statusIdsFor(DISBURSED_LEAD_STATUS_NAMES);

    return this.leadRepository
      .createQueryBuilder('lead')
      .innerJoin('lead.leadStatus', 'leadStatus')
      .innerJoin(
        CreditAnalysisMemo,
        'cam',
        'cam.leadId = lead.id AND cam.disbursalDate BETWEEN :start AND :end',
        { start, end },
      )
      .innerJoin(
        Loan,
        'loan',
        'loan.leadId = lead.id AND loan.status = :loanStatus',
        {
          loanStatus: 'DISBURSED',
        },
      )
      .where('leadStatus.id IN (:...statusIds)', { statusIds })
      .select('cam.disbursalDate', 'disbursalDate')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(cam.adminFee)', 'totalAdminFee')
      .addSelect('SUM(cam.recommendedLoanAmount)', 'totalLoanAmount')
      .groupBy('cam.disbursalDate')
      .orderBy('cam.disbursalDate', 'ASC')
      .getRawMany();
  }

  /** report_id 14 (`MonthwiseDisbursalModel`) — month-wise disbursal detail.
   * Legacy aggregates this row-level query further in PHP; this returns the
   * same underlying row set (one row per disbursed loan in the month) so
   * the caller can aggregate/paginate as needed. */
  async monthlyDisbursal(query: MonthQueryDto) {
    const { start, end } = monthRange(query.month);
    const statusIds = await this.statusIdsFor(DISBURSED_LEAD_STATUS_NAMES);

    return this.leadRepository
      .createQueryBuilder('lead')
      .innerJoin('lead.leadStatus', 'leadStatus')
      .innerJoin(
        CreditAnalysisMemo,
        'cam',
        'cam.leadId = lead.id AND cam.disbursalDate BETWEEN :start AND :end',
        { start, end },
      )
      .innerJoin(
        Loan,
        'loan',
        'loan.leadId = lead.id AND loan.status = :loanStatus',
        {
          loanStatus: 'DISBURSED',
        },
      )
      .where('leadStatus.id IN (:...statusIds)', { statusIds })
      .select('lead.id', 'leadId')
      .addSelect('cam.disbursalDate', 'disbursalDate')
      .addSelect('loan.loanNumber', 'loanNumber')
      .addSelect('cam.recommendedLoanAmount', 'loanRecommended')
      .addSelect('cam.repaymentAmount', 'repaymentAmount')
      .addSelect('loan.principalReceived', 'principalReceived')
      .addSelect('loan.principalOutstanding', 'principalOutstanding')
      .addSelect('loan.interestPayable', 'interestPayable')
      .addSelect('loan.interestReceived', 'interestReceived')
      .addSelect('loan.interestOutstanding', 'interestOutstanding')
      .addSelect('loan.penaltyReceived', 'penaltyReceived')
      .addSelect('loan.penaltyOutstanding', 'penaltyOutstanding')
      .addSelect('loan.totalReceived', 'totalReceived')
      .orderBy('cam.disbursalDate', 'ASC')
      .getRawMany();
  }

  /** report_id 15 (`HourlyDisbursalModel`) — disbursals bucketed into
   * legacy's fixed 8 two-hour bands (not literal hour-of-day), split
   * fresh (NEW) vs. repeat user type. */
  async hourlyDisbursal(query: DateRangeQueryDto) {
    const statusIds = await this.statusIdsFor(DISBURSED_LEAD_STATUS_NAMES);
    const leads = await this.leadRepository
      .createQueryBuilder('lead')
      .innerJoin('lead.leadStatus', 'leadStatus')
      .innerJoin(CreditAnalysisMemo, 'cam', 'cam.leadId = lead.id')
      .where('leadStatus.id IN (:...statusIds)', { statusIds })
      .andWhere('lead.finalDisbursedAt IS NOT NULL')
      .andWhere(
        query.fromDate ? 'lead.finalDisbursedAt >= :fromDate' : '1=1',
        query.fromDate ? { fromDate: query.fromDate } : {},
      )
      .andWhere(
        query.toDate ? 'lead.finalDisbursedAt <= :toDate' : '1=1',
        query.toDate ? { toDate: query.toDate } : {},
      )
      .select('lead.finalDisbursedAt', 'finalDisbursedAt')
      .addSelect('lead.userType', 'userType')
      .addSelect('cam.recommendedLoanAmount', 'loanRecommended')
      .getRawMany<{
        finalDisbursedAt: Date;
        userType: string;
        loanRecommended: string;
      }>();

    const buckets = new Map<
      string,
      {
        band: string;
        counts: number;
        loanRecommended: number;
        new: { counts: number; loanRecommended: number };
        repeat: { counts: number; loanRecommended: number };
      }
    >();
    for (const band of HOUR_BANDS) {
      buckets.set(band.label, {
        band: band.label,
        counts: 0,
        loanRecommended: 0,
        new: { counts: 0, loanRecommended: 0 },
        repeat: { counts: 0, loanRecommended: 0 },
      });
    }

    for (const row of leads) {
      const hour = new Date(row.finalDisbursedAt).getHours();
      const band = bandForHour(hour);
      const bucket = buckets.get(band);
      if (!bucket) continue;
      const amount = Number(row.loanRecommended ?? 0);
      bucket.counts += 1;
      bucket.loanRecommended += amount;
      if (row.userType === 'NEW') {
        bucket.new.counts += 1;
        bucket.new.loanRecommended += amount;
      } else {
        bucket.repeat.counts += 1;
        bucket.repeat.loanRecommended += amount;
      }
    }

    return Array.from(buckets.values());
  }

  /** report_id 34 (`FYdisbursementcollectionModel`) — disbursement vs.
   * collection, financial-year view (12 months from the given start). */
  async fyDisbursementCollection(query: MonthQueryDto) {
    const start = new Date(query.month);
    start.setDate(1);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 12);
    end.setDate(0);
    end.setHours(23, 59, 59);

    const statusIds = await this.statusIdsFor(DISBURSED_LEAD_STATUS_NAMES);

    return this.leadRepository
      .createQueryBuilder('lead')
      .innerJoin('lead.leadStatus', 'leadStatus')
      .innerJoin(
        CreditAnalysisMemo,
        'cam',
        'cam.leadId = lead.id AND cam.disbursalDate BETWEEN :start AND :end',
        { start, end },
      )
      .innerJoin(
        Loan,
        'loan',
        'loan.leadId = lead.id AND loan.status = :loanStatus',
        {
          loanStatus: 'DISBURSED',
        },
      )
      .where('leadStatus.id IN (:...statusIds)', { statusIds })
      .select("DATE_FORMAT(cam.disbursalDate, '%M-%y')", 'monthYear')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(cam.recommendedLoanAmount)', 'totalLoanAmount')
      .addSelect('SUM(cam.repaymentAmount)', 'totalRepayAmount')
      .addSelect('SUM(loan.totalReceived)', 'totalCollection')
      .groupBy("DATE_FORMAT(cam.disbursalDate, '%M-%y')")
      .orderBy('cam.disbursalDate', 'ASC')
      .getRawMany();
  }

  /**
   * report_id 57 — **rebuilt, not ported**. Legacy's
   * `HourlyLoanDisbursalReportModel` is not real logic: it's a hardcoded
   * HTML table with fake data (a literal made-up name "MEENA JOSHI", a
   * fixed date "19-Oct-2023", static counts). There is nothing to port.
   * Also, the DB row for report_id 57 is itself labeled "FLP Month Wise
   * Collection Report" — a stale/repurposed name (see TODO.md). Built as a
   * real report matching the task's actual intent ("loan disbursals by
   * hour, a newer variant of report 15"): the same hour-band bucketing as
   * `hourlyDisbursal` above, additionally split by disbursal executive.
   */
  async hourlyLoanDisbursalByExecutive(query: DateRangeQueryDto) {
    const statusIds = await this.statusIdsFor(DISBURSED_LEAD_STATUS_NAMES);
    const rows = await this.leadRepository
      .createQueryBuilder('lead')
      .innerJoin('lead.leadStatus', 'leadStatus')
      .leftJoin('lead.disbursalAssignedTo', 'disbursalAssignedTo')
      .innerJoin(CreditAnalysisMemo, 'cam', 'cam.leadId = lead.id')
      .where('leadStatus.id IN (:...statusIds)', { statusIds })
      .andWhere('lead.finalDisbursedAt IS NOT NULL')
      .andWhere(
        query.fromDate ? 'lead.finalDisbursedAt >= :fromDate' : '1=1',
        query.fromDate ? { fromDate: query.fromDate } : {},
      )
      .andWhere(
        query.toDate ? 'lead.finalDisbursedAt <= :toDate' : '1=1',
        query.toDate ? { toDate: query.toDate } : {},
      )
      .select('lead.finalDisbursedAt', 'finalDisbursedAt')
      .addSelect('disbursalAssignedTo.id', 'executiveId')
      .addSelect('disbursalAssignedTo.name', 'executiveName')
      .addSelect('cam.recommendedLoanAmount', 'loanRecommended')
      .getRawMany<{
        finalDisbursedAt: Date;
        executiveId: number | null;
        executiveName: string | null;
        loanRecommended: string;
      }>();

    const key = (band: string, executiveId: number | null) =>
      `${band}::${executiveId ?? 'unassigned'}`;
    const buckets = new Map<
      string,
      {
        band: string;
        executiveId: number | null;
        executiveName: string | null;
        counts: number;
        loanRecommended: number;
      }
    >();

    for (const row of rows) {
      const hour = new Date(row.finalDisbursedAt).getHours();
      const band = bandForHour(hour);
      const k = key(band, row.executiveId);
      const existing = buckets.get(k);
      const amount = Number(row.loanRecommended ?? 0);
      if (existing) {
        existing.counts += 1;
        existing.loanRecommended += amount;
      } else {
        buckets.set(k, {
          band,
          executiveId: row.executiveId,
          executiveName: row.executiveName,
          counts: 1,
          loanRecommended: amount,
        });
      }
    }

    return Array.from(buckets.values());
  }

  /** report_id 70 (`DisbursalDateWiseAllReport`) — all-disbursal detail by
   * date. Legacy narrows this specifically to lead_status_id IN (14, 19)
   * (DISBURSED, PART-PAYMENT only — not the full 14/16/17/18/19 set used
   * elsewhere), and filters by `lead_final_disbursed_date`, not the CAM
   * disbursal_date used by reports 6/14/34. */
  async disbursalDateWise(query: DateRangeQueryDto) {
    const statusIds = await this.statusIdsFor(['DISBURSED', 'PART-PAYMENT']);

    const qb = this.leadRepository
      .createQueryBuilder('lead')
      .innerJoin('lead.leadStatus', 'leadStatus')
      .innerJoin(CreditAnalysisMemo, 'cam', 'cam.leadId = lead.id')
      .innerJoin(
        Loan,
        'loan',
        'loan.leadId = lead.id AND loan.status = :loanStatus',
        {
          loanStatus: 'DISBURSED',
        },
      )
      .where('leadStatus.id IN (:...statusIds)', { statusIds })
      .andWhere('lead.finalDisbursedAt IS NOT NULL');

    if (query.fromDate) {
      qb.andWhere('lead.finalDisbursedAt >= :fromDate', {
        fromDate: query.fromDate,
      });
    }
    if (query.toDate) {
      qb.andWhere('lead.finalDisbursedAt <= :toDate', { toDate: query.toDate });
    }

    return qb
      .select('lead.finalDisbursedAt', 'finalDisbursedAt')
      .addSelect('loan.loanNumber', 'loanNumber')
      .addSelect('cam.recommendedLoanAmount', 'loanRecommended')
      .addSelect('loan.totalReceived', 'totalReceived')
      .addSelect('loan.totalOutstanding', 'totalOutstanding')
      .orderBy('lead.finalDisbursedAt', 'ASC')
      .getRawMany();
  }

  /**
   * report_id 72 — DB label ("Leads Affiliate Report") drifted from actual
   * behavior (see TODO.md). Legacy's `DisbursalExecutiveWiseReport` also
   * has its own bug on top of the drift: despite the name, it groups by
   * `lead_credit_assign_user_id` (the CREDIT executive), not the disbursal
   * executive, via its join to `credit_analysis_memo`. This port
   * implements what the name/task actually calls for — grouped by the
   * real disbursal executive (`Lead.disbursalAssignedTo`) — rather than
   * reproducing that apparent join bug; noted here rather than silently
   * copied.
   */
  async disbursalExecutiveWise(query: DateRangeQueryDto) {
    const statusIds = await this.statusIdsFor(DISBURSED_LEAD_STATUS_NAMES);

    const qb = this.leadRepository
      .createQueryBuilder('lead')
      .innerJoin('lead.leadStatus', 'leadStatus')
      .innerJoin('lead.disbursalAssignedTo', 'executive')
      .leftJoin(CreditAnalysisMemo, 'cam', 'cam.leadId = lead.id')
      .where('leadStatus.id IN (:...statusIds)', { statusIds });

    if (query.fromDate) {
      qb.andWhere('lead.finalDisbursedAt >= :fromDate', {
        fromDate: query.fromDate,
      });
    }
    if (query.toDate) {
      qb.andWhere('lead.finalDisbursedAt <= :toDate', { toDate: query.toDate });
    }

    return qb
      .select('executive.id', 'executiveId')
      .addSelect('executive.name', 'executiveName')
      .addSelect(
        "SUM(CASE WHEN lead.userType = 'NEW' THEN 1 ELSE 0 END)",
        'newCounts',
      )
      .addSelect(
        "SUM(CASE WHEN lead.userType = 'NEW' THEN cam.recommendedLoanAmount ELSE 0 END)",
        'newLoanAmount',
      )
      .addSelect(
        "SUM(CASE WHEN lead.userType != 'NEW' THEN 1 ELSE 0 END)",
        'repeatCounts',
      )
      .addSelect(
        "SUM(CASE WHEN lead.userType != 'NEW' THEN cam.recommendedLoanAmount ELSE 0 END)",
        'repeatLoanAmount',
      )
      .addSelect('COUNT(*)', 'totalCounts')
      .addSelect('SUM(cam.recommendedLoanAmount)', 'totalLoanAmount')
      .groupBy('executive.id')
      .orderBy('newCounts', 'DESC')
      .getRawMany();
  }

  /**
   * Ports `disbursal_head_approval_hour_report()` from
   * `CronJobs/CronReportController.php` — average turnaround time (hours)
   * between disbursal assignment and disbursal approval, by executive, for
   * a date range. No `master_mis_report` row exists for this one (it was
   * only ever a cron/email report in legacy, not a UI-gated MIS report) —
   * gated with id 84, the next free id after credit-reports' 83, same
   * "code-only" convention as credit-reports' `processTat` (id 80).
   */
  async disbursalExecutiveTa(query: DateRangeQueryDto) {
    const qb = this.leadRepository
      .createQueryBuilder('lead')
      .innerJoin('lead.disbursalAssignedTo', 'executive')
      .where('lead.disbursalApprovedAt IS NOT NULL')
      .andWhere('lead.disbursalAssignedAt IS NOT NULL');

    if (query.fromDate) {
      qb.andWhere('DATE(lead.disbursalApprovedAt) >= :fromDate', {
        fromDate: query.fromDate,
      });
    }
    if (query.toDate) {
      qb.andWhere('DATE(lead.disbursalApprovedAt) <= :toDate', {
        toDate: query.toDate,
      });
    }

    return qb
      .select('executive.id', 'executiveId')
      .addSelect('executive.name', 'executiveName')
      .addSelect('COUNT(*)', 'caseCount')
      .addSelect(
        'AVG(TIMESTAMPDIFF(HOUR, lead.disbursalAssignedAt, lead.disbursalApprovedAt))',
        'avgTurnaroundHours',
      )
      .groupBy('executive.id')
      .orderBy('executive.name', 'ASC')
      .getRawMany();
  }
}
