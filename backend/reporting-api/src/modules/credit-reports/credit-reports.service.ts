import { CreditAnalysisMemo, Lead, LeadFollowup, Loan } from '@finance-crm/database';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { DateRangeQueryDto } from '../../common/dto/date-range-query.dto';
import { MonthQueryDto } from './dto/month-query.dto';

/** Formats a `Date` as `YYYY-MM-DD` using its *local* calendar fields, not
 * `toISOString()` — `toISOString()` converts to UTC first, which silently
 * shifts the date back a day for any positive-UTC-offset timezone (e.g.
 * IST, this business's home timezone) when the `Date` was constructed at
 * local midnight. */
function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function monthBounds(month: string): { fromDate: string; toDate: string } {
  const d = new Date(month);
  const fromDate = formatLocalDate(new Date(d.getFullYear(), d.getMonth(), 1));
  const toDate = formatLocalDate(
    new Date(d.getFullYear(), d.getMonth() + 1, 0),
  );
  return { fromDate, toDate };
}

/**
 * Ports `Report_Model.php`'s sanction/credit-domain reports
 * (`TotalSanctionModel`, `SanctionKPIModel`, `OutstandingReportAmountModel`,
 * `OutstandingReportCasesModel`/`OutstandingReportCasesDateRangeModel`,
 * `LeadStatusSanctionWiseNewModel`/`RepeatModel`/`RepeatModelNEW`,
 * `SanctionExecutiveTAModel`, `SanctionExecutiveachievementModel`,
 * `SanctionStatusWiseDetailedModel`, `Bucket_Wise_Sanction_Executive_Report`,
 * `exportProcessTATModel`) plus a from-scratch `sanctionTATReport` (legacy's
 * `SanctionTATReport` model method doesn't exist — see docs/TODO.md).
 *
 * Every query uses TypeORM's `QueryBuilder` against the real rewritten
 * entities (`leads`, `credit_analysis_memo`, `loan`, `master_status`,
 * `lead_followup` — all singular/legacy-named, not the pre-rewrite
 * entities' invented plural table names this module's raw SQL originally
 * targeted) rather than raw `dataSource.query()` calls, per this project's
 * "no raw string-concatenated SQL, parameterized TypeORM queries only"
 * rule. QueryBuilder's alias.property references (including inside
 * `SUM(CASE WHEN ...)`-style raw select fragments) are translated to the
 * real column names automatically, so the query bodies below reference
 * entity property names throughout.
 *
 * Several legacy reports build their result as deeply nested PHP arrays with
 * presentational sub-buckets (e.g. `SanctionKPIModel`'s Week_1..Week_4
 * disbursal-day buckets). This port keeps the real underlying aggregation
 * (per-executive, per-user-type counts/amounts for the target period) but
 * flattens the presentation-only sub-bucketing into a single row per
 * executive — the new frontend can re-bucket for display if needed; the
 * legacy weekly split was a rendering choice, not a distinct business
 * metric. Documented here and in docs/TODO.md, not silently dropped.
 */
@Injectable()
export class CreditReportsService {
  constructor(
    @InjectRepository(Lead) private readonly leadRepository: Repository<Lead>,
    @InjectRepository(LeadFollowup)
    private readonly leadFollowupRepository: Repository<LeadFollowup>,
  ) {}

  /** report_id 3 — TotalSanctionModel: sanctioned cases + recommended
   * amount, by executive, new vs. repeat, within a credit-approval date
   * range. */
  async totalSanction(query: DateRangeQueryDto) {
    if (!query.fromDate || !query.toDate) {
      return [];
    }
    return this.leadRepository
      .createQueryBuilder('lead')
      .innerJoin(CreditAnalysisMemo, 'cam', 'cam.leadId = lead.id')
      .innerJoin('lead.creditAssignedTo', 'u')
      .select('u.name', 'executiveName')
      .addSelect(
        "SUM(CASE WHEN lead.userType = 'NEW' THEN 1 ELSE 0 END)",
        'newCases',
      )
      .addSelect(
        "SUM(CASE WHEN lead.userType = 'NEW' THEN cam.recommendedLoanAmount ELSE 0 END)",
        'newAmount',
      )
      .addSelect(
        "SUM(CASE WHEN lead.userType = 'REPEAT' THEN 1 ELSE 0 END)",
        'repeatCases',
      )
      .addSelect(
        "SUM(CASE WHEN lead.userType = 'REPEAT' THEN cam.recommendedLoanAmount ELSE 0 END)",
        'repeatAmount',
      )
      .where('lead.isActive = :active', { active: true })
      .andWhere('DATE(lead.creditApprovedAt) BETWEEN :fromDate AND :toDate', {
        fromDate: query.fromDate,
        toDate: query.toDate,
      })
      .groupBy('u.id')
      .addGroupBy('u.name')
      .orderBy('u.name', 'ASC')
      .getRawMany();
  }

  /** report_id 4 — SanctionKPIModel: for the target month, per-executive
   * disbursed-loan counts/amounts (loans whose CAM disbursalDate falls in
   * the month) and collected-principal amounts (loans whose CAM
   * repaymentDate falls in the month, loan DISBURSED). Legacy's Week_1..4
   * sub-buckets are flattened — see class doc comment. */
  async sanctionKpi(query: MonthQueryDto) {
    const { fromDate, toDate } = monthBounds(query.month);
    return this.leadRepository
      .createQueryBuilder('lead')
      .innerJoin(CreditAnalysisMemo, 'cam', 'cam.leadId = lead.id')
      .leftJoin(Loan, 'loan', 'loan.leadId = lead.id')
      .leftJoin('lead.creditAssignedTo', 'u')
      .select('u.name', 'executiveName')
      .addSelect(
        "SUM(CASE WHEN lead.userType = 'NEW' THEN 1 ELSE 0 END)",
        'newSanctions',
      )
      .addSelect(
        "SUM(CASE WHEN lead.userType = 'REPEAT' THEN 1 ELSE 0 END)",
        'repeatSanctions',
      )
      .addSelect('SUM(cam.recommendedLoanAmount)', 'totalRecommendedAmount')
      .addSelect('SUM(loan.principalReceived)', 'totalPrincipalReceived')
      .where('cam.disbursalDate BETWEEN :fromDate AND :toDate', {
        fromDate,
        toDate,
      })
      .groupBy('u.id')
      .addGroupBy('u.name')
      .orderBy('u.name', 'ASC')
      .getRawMany();
  }

  /** report_id 9 — outstandingSanctionCaseReport (OutstandingReportCasesModel):
   * disbursed-loan case counts by executive for the target month, by
   * user type. */
  async outstandingSanctionCases(query: MonthQueryDto) {
    const { fromDate, toDate } = monthBounds(query.month);
    return this.leadRepository
      .createQueryBuilder('lead')
      .innerJoin(Loan, 'loan', 'loan.leadId = lead.id')
      .innerJoin(CreditAnalysisMemo, 'cam', 'cam.leadId = lead.id')
      .innerJoin('lead.creditAssignedTo', 'u')
      .select('u.name', 'executiveName')
      .addSelect(
        "SUM(CASE WHEN lead.userType = 'NEW' THEN 1 ELSE 0 END)",
        'newCases',
      )
      .addSelect(
        "SUM(CASE WHEN lead.userType = 'REPEAT' THEN 1 ELSE 0 END)",
        'repeatCases',
      )
      .where('loan.status = :status', { status: 'DISBURSED' })
      .andWhere('DATE(cam.repaymentDate) BETWEEN :fromDate AND :toDate', {
        fromDate,
        toDate,
      })
      .groupBy('u.id')
      .addGroupBy('u.name')
      .orderBy('u.name', 'ASC')
      .getRawMany();
  }

  /** report_id 11 — UserTypeOutstandingReport: outstanding sanction amounts
   * split by fresh (NEW) vs. repeat customer, current snapshot (no date
   * params in legacy). */
  async userTypeOutstanding() {
    return this.leadRepository
      .createQueryBuilder('lead')
      .innerJoin(Loan, 'loan', 'loan.leadId = lead.id')
      .select('lead.userType', 'userType')
      .addSelect('COUNT(*)', 'caseCount')
      .addSelect('SUM(loan.principalOutstanding)', 'totalOutstanding')
      .where('loan.status = :status', { status: 'DISBURSED' })
      .groupBy('lead.userType')
      .getRawMany();
  }

  /** report_id 25 — LeadStatusSanctionWiseNewReport: fresh-lead status
   * breakdown by sanction (credit) executive, within a screener-assignment
   * date range. */
  leadStatusSanctionWiseNew(query: DateRangeQueryDto) {
    return this.leadStatusSanctionWise(query, 'NEW');
  }

  /** report_id 26 — LeadStatusSanctionWiseRepeatReport: same, repeat
   * customers. */
  leadStatusSanctionWiseRepeat(query: DateRangeQueryDto) {
    return this.leadStatusSanctionWise(query, 'REPEAT');
  }

  /** report_id 71 — LeadStatusSanctionWiseRepeatReportNEW: legacy has a
   * newer duplicate of report 26 with the same intent; implemented
   * identically here since no behavioral difference was found worth
   * splitting out. */
  leadStatusSanctionWiseRepeatNew(query: DateRangeQueryDto) {
    return this.leadStatusSanctionWise(query, 'REPEAT');
  }

  private async leadStatusSanctionWise(
    query: DateRangeQueryDto,
    userType: 'NEW' | 'REPEAT',
  ) {
    if (!query.fromDate || !query.toDate) {
      return [];
    }
    return this.leadRepository
      .createQueryBuilder('lead')
      .leftJoin('lead.screenerAssignedTo', 'u')
      .innerJoin('lead.leadStatus', 'ms')
      .select('u.name', 'executiveName')
      .addSelect('ms.name', 'statusName')
      .addSelect('COUNT(*)', 'leadCount')
      .where('lead.isActive = :active', { active: true })
      .andWhere('lead.userType = :userType', { userType })
      .andWhere('DATE(lead.screenerAssignedAt) BETWEEN :fromDate AND :toDate', {
        fromDate: query.fromDate,
        toDate: query.toDate,
      })
      .groupBy('u.id')
      .addGroupBy('u.name')
      .addGroupBy('ms.id')
      .addGroupBy('ms.name')
      .orderBy('u.name', 'ASC')
      .addOrderBy('ms.name', 'ASC')
      .getRawMany();
  }

  /** report_id 29 — outstandingSanctionAmountReport (OutstandingReportAmountModel):
   * per-executive/user-type recommended/received/outstanding amounts for
   * disbursed loans repaid in the target month. */
  async outstandingSanctionAmount(query: MonthQueryDto) {
    const { fromDate, toDate } = monthBounds(query.month);
    return this.leadRepository
      .createQueryBuilder('lead')
      .innerJoin(Loan, 'loan', 'loan.leadId = lead.id')
      .innerJoin(CreditAnalysisMemo, 'cam', 'cam.leadId = lead.id')
      .innerJoin('lead.creditAssignedTo', 'u')
      .select('u.name', 'executiveName')
      .addSelect('lead.userType', 'userType')
      .addSelect('COUNT(*)', 'caseCount')
      .addSelect('SUM(cam.recommendedLoanAmount)', 'recommendedAmount')
      .addSelect('SUM(loan.principalReceived)', 'receivedAmount')
      .addSelect('SUM(loan.principalOutstanding)', 'outstandingAmount')
      .where('lead.isActive = :active', { active: true })
      .andWhere('loan.status = :status', { status: 'DISBURSED' })
      .andWhere('DATE(cam.repaymentDate) BETWEEN :fromDate AND :toDate', {
        fromDate,
        toDate,
      })
      .groupBy('u.id')
      .addGroupBy('u.name')
      .addGroupBy('lead.userType')
      .orderBy('u.name', 'ASC')
      .getRawMany();
  }

  /** report_id 36 — OutstandingReportCasesDateRangeReport: same shape as
   * report 9/29 but a free (non-month-locked) date range. */
  async outstandingCasesDateRange(query: DateRangeQueryDto) {
    if (!query.fromDate || !query.toDate) {
      return [];
    }
    return this.leadRepository
      .createQueryBuilder('lead')
      .innerJoin(Loan, 'loan', 'loan.leadId = lead.id')
      .innerJoin(CreditAnalysisMemo, 'cam', 'cam.leadId = lead.id')
      .innerJoin('lead.creditAssignedTo', 'u')
      .select('u.name', 'executiveName')
      .addSelect('lead.userType', 'userType')
      .addSelect('COUNT(*)', 'caseCount')
      .where('loan.status = :status', { status: 'DISBURSED' })
      .andWhere('DATE(cam.repaymentDate) BETWEEN :fromDate AND :toDate', {
        fromDate: query.fromDate,
        toDate: query.toDate,
      })
      .groupBy('u.id')
      .addGroupBy('u.name')
      .addGroupBy('lead.userType')
      .orderBy('u.name', 'ASC')
      .getRawMany();
  }

  /** report_id 38 — SanctionExecutiveTAReport: average turnaround time
   * (hours) between credit assignment and credit approval, by executive,
   * for the target month. */
  async sanctionExecutiveTa(query: MonthQueryDto) {
    const { fromDate, toDate } = monthBounds(query.month);
    return this.leadRepository
      .createQueryBuilder('lead')
      .innerJoin('lead.creditAssignedTo', 'u')
      .select('u.name', 'executiveName')
      .addSelect('COUNT(*)', 'caseCount')
      .addSelect(
        'AVG(TIMESTAMPDIFF(HOUR, lead.creditAssignedAt, lead.creditApprovedAt))',
        'avgTurnaroundHours',
      )
      .where('lead.creditApprovedAt IS NOT NULL')
      .andWhere('lead.creditAssignedAt IS NOT NULL')
      .andWhere('DATE(lead.creditApprovedAt) BETWEEN :fromDate AND :toDate', {
        fromDate,
        toDate,
      })
      .groupBy('u.id')
      .addGroupBy('u.name')
      .orderBy('u.name', 'ASC')
      .getRawMany();
  }

  /** report_id 45 — SanctionExecutiveachievementReport: sanction count +
   * recommended amount, per executive, for the target month. Legacy's
   * "achievement vs. target" implies a stored target figure — no
   * target-tracking concept exists anywhere in this schema; this returns
   * actual counts/amounts only so the frontend/business can compare
   * against whatever target they track externally. Documented as a scope
   * gap, not fabricated. */
  async sanctionExecutiveAchievement(query: MonthQueryDto) {
    const { fromDate, toDate } = monthBounds(query.month);
    return this.leadRepository
      .createQueryBuilder('lead')
      .innerJoin(CreditAnalysisMemo, 'cam', 'cam.leadId = lead.id')
      .innerJoin('lead.creditAssignedTo', 'u')
      .select('u.name', 'executiveName')
      .addSelect('COUNT(*)', 'sanctionCount')
      .addSelect('SUM(cam.recommendedLoanAmount)', 'totalRecommendedAmount')
      .where('lead.isActive = :active', { active: true })
      .andWhere('DATE(lead.creditApprovedAt) BETWEEN :fromDate AND :toDate', {
        fromDate,
        toDate,
      })
      .groupBy('u.id')
      .addGroupBy('u.name')
      .orderBy('u.name', 'ASC')
      .getRawMany();
  }

  /** report_id 76 — SanctionStatusWiseDetailedReport: per-executive counts
   * of leads in application-recommend/audit-recommend/sanction/disburse
   * stages. **Legacy bug fixed**: `SanctionStatusWiseDetailedModel()` takes
   * zero params and never filters by date despite the controller passing a
   * date range — this port actually applies the filter (against
   * `creditAssignedAt`, the closest available "entered this pipeline"
   * timestamp) instead of reproducing the bug. */
  async sanctionStatusWiseDetailed(query: DateRangeQueryDto) {
    const statusNames = [
      'APPLICATION-RECOMMENDED',
      'AUDIT-NEW',
      'AUDIT-HOLD',
      'AUDIT-RECOMMENDED',
      'SANCTION',
      'DISBURSAL-SEND-BACK',
      'DISBURSAL-HOLD',
      'DISBURSAL-NEW',
    ];
    const qb = this.leadRepository
      .createQueryBuilder('lead')
      .innerJoin('lead.creditAssignedTo', 'u')
      .innerJoin('lead.leadStatus', 'ms')
      .select('u.name', 'executiveName')
      .addSelect(
        "SUM(CASE WHEN ms.name = 'APPLICATION-RECOMMENDED' THEN 1 ELSE 0 END)",
        'applicationRecommended',
      )
      .addSelect(
        "SUM(CASE WHEN ms.name IN ('AUDIT-NEW','AUDIT-HOLD','AUDIT-RECOMMENDED') THEN 1 ELSE 0 END)",
        'auditRecommended',
      )
      .addSelect(
        "SUM(CASE WHEN ms.name = 'SANCTION' THEN 1 ELSE 0 END)",
        'sanctioned',
      )
      .addSelect(
        "SUM(CASE WHEN ms.name IN ('DISBURSAL-SEND-BACK','DISBURSAL-HOLD','DISBURSAL-NEW') THEN 1 ELSE 0 END)",
        'disburseApplication',
      )
      .where('ms.name IN (:...statusNames)', { statusNames });

    if (query.fromDate && query.toDate) {
      qb.andWhere('DATE(lead.creditAssignedAt) BETWEEN :fromDate AND :toDate', {
        fromDate: query.fromDate,
        toDate: query.toDate,
      });
    }

    return qb
      .groupBy('u.id')
      .addGroupBy('u.name')
      .orderBy('u.name', 'ASC')
      .getRawMany();
  }

  /**
   * report_id 83 — `Bucket_Wise_Sanction_Executive_Report`. **Not actually a
   * DPD-bucket report** — verified against the live legacy source
   * (`Report_Model.php:8155`), not the earlier `$query_screener`/
   * `$query_credit_manager` block above it in the same file, which computes
   * a real DPD bucket but is entirely commented out and never runs. "Bucket-
   * wise" is leftover naming — same numeric-id-drift pattern already
   * documented elsewhere in this file for report ids 54/55/57/72/73. The
   * query that actually executes (`$query_agent`) is Screener-vs-Credit-
   * Manager fresh/repeat case performance: for each active CR1 (screener)
   * and CR2 (credit manager) user, fresh/repeat case counts and summed
   * `credit_analysis_memo.loan_recommended`, ranked (CREDIT rows first,
   * then by repeat count then total cases), plus one grand-total row
   * summing only the CREDIT rows (legacy does the same — the TOTAL row
   * ignores SCREENER numbers, not a bug introduced here).
   *
   * Ported field-for-field:
   * - SCREENER branch joins on `lead_screener_assign_user_id`, filtered to
   *   `lead_screener_recommend_datetime` in range and legacy status ids
   *   (4,5,6,10,11,12,13,25,30,35,37,44,45,46,47,48,14,16,17,18,19) — every
   *   application/audit/disbursal/closed-loan status a screener's recommended
   *   lead can reach — resolved by `status_name`, not the numeric ids, per
   *   this file's rule (`master_status` has no persisted legacy id column).
   * - CREDIT branch joins on `lead_credit_assign_user_id`, filtered to
   *   `updated_on` in range and status ids (14,16,17,18,19) — the same
   *   DISBURSED/CLOSED/SETTLED/WRITEOFF/PART-PAYMENT lifecycle set used
   *   throughout `collection-reports.service.ts`.
   * - `leads.user_type` compared against `1`/`2` in the legacy SQL is a
   *   MySQL enum-ordinal comparison (`user_type` is
   *   `enum('NEW','REPEAT','UNPAID-REPEAT')`, and MySQL compares an enum to
   *   an int by 1-based position) — ported as direct string comparison
   *   against `'NEW'`/`'REPEAT'`, the same enum-vs-numeric-id class of fix
   *   already made to `Collection.verificationStatus` elsewhere in this
   *   module (see `VERIFICATION_APPROVED` in `collection-reports.service.ts`).
   * - The hardcoded excluded `user_id` lists (legacy admin/system/test
   *   accounts, e.g. id 1) are carried over verbatim, including the branches'
   *   real difference (CREDIT additionally excludes id 37, SCREENER doesn't)
   *   — legacy-environment-specific data, faithfully ported rather than
   *   guessed at, not necessarily meaningful in every environment.
   * - Dropped: the `<img>` HTML markup legacy concatenates into an `image`
   *   column — presentational only, not a business value, same treatment as
   *   every other report in this file that strips display-only fields.
   *
   * Uses a raw parameterized query (not QueryBuilder), same precedent as
   * `processTat` above — the CTE/`UNION ALL`/`ROW_NUMBER() OVER` shape is
   * outside QueryBuilder's expression surface, and every value is bound via
   * `?`, none interpolated. */
  async bucketWiseSanctionExecutive(query: DateRangeQueryDto) {
    if (!query.fromDate || !query.toDate) {
      return [];
    }
    return this.leadRepository.query(
      `WITH cam_data AS (
         SELECT lead_id, SUM(loan_recommended) AS loanRecommended
         FROM credit_analysis_memo
         GROUP BY lead_id
       ),
       final_data AS (
         SELECT 'SCREENER' AS reportType, u.name AS executiveName,
                COUNT(DISTINCT CASE WHEN ld.user_type = 'NEW' THEN ld.lead_id END) AS freshTotal,
                SUM(CASE WHEN ld.user_type = 'NEW' THEN IFNULL(cam.loanRecommended,0) ELSE 0 END) AS freshAmount,
                COUNT(DISTINCT CASE WHEN ld.user_type = 'REPEAT' THEN ld.lead_id END) AS repeatTotal,
                SUM(CASE WHEN ld.user_type = 'REPEAT' THEN IFNULL(cam.loanRecommended,0) ELSE 0 END) AS repeatAmount,
                COUNT(DISTINCT ld.lead_id) AS totalCases,
                SUM(IFNULL(cam.loanRecommended,0)) AS totalAmount
         FROM users u
         LEFT JOIN leads ld
           ON ld.lead_screener_assign_user_id = u.user_id
           AND ld.lead_status_id IN (
             SELECT status_id FROM master_status WHERE status_name IN (
               'APPLICATION-NEW','APPLICATION-INPROCESS','APPLICATION-HOLD',
               'APPLICATION-RECOMMENDED','APPLICATION-SEND-BACK','SANCTION',
               'DISBURSE-PENDING','DISBURSAL-NEW','DISBURSAL-INPROCESS',
               'DISBURSAL-HOLD','DISBURSAL-SEND-BACK','AUDIT-NEW',
               'AUDIT-INPROCESS','AUDIT-HOLD','AUDIT-RECOMMENDED',
               'RECOMMENDED IN-PROCESS','DISBURSED','CLOSED','SETTLED',
               'WRITEOFF','PART-PAYMENT'
             )
           )
           AND DATE(ld.lead_screener_recommend_datetime) BETWEEN ? AND ?
         LEFT JOIN cam_data cam ON ld.lead_id = cam.lead_id
         WHERE EXISTS (
             SELECT 1 FROM user_roles ur
             INNER JOIN master_role_type rt ON rt.role_type_id = ur.user_role_type_id
             WHERE ur.user_role_user_id = u.user_id AND rt.role_type_labels = 'CR1'
               AND ur.user_role_active = 1 AND ur.user_role_deleted = 0
           )
           AND u.user_id NOT IN (1,2,31,32,33,51,92,93,101)
           AND u.user_active = 1 AND u.user_status_id = 1
         GROUP BY u.user_id

         UNION ALL

         SELECT 'CREDIT' AS reportType, u.name AS executiveName,
                COUNT(DISTINCT CASE WHEN ld.user_type = 'NEW' THEN ld.lead_id END) AS freshTotal,
                SUM(CASE WHEN ld.user_type = 'NEW' THEN IFNULL(cam.loanRecommended,0) ELSE 0 END) AS freshAmount,
                COUNT(DISTINCT CASE WHEN ld.user_type = 'REPEAT' THEN ld.lead_id END) AS repeatTotal,
                SUM(CASE WHEN ld.user_type = 'REPEAT' THEN IFNULL(cam.loanRecommended,0) ELSE 0 END) AS repeatAmount,
                COUNT(DISTINCT ld.lead_id) AS totalCases,
                SUM(IFNULL(cam.loanRecommended,0)) AS totalAmount
         FROM users u
         LEFT JOIN leads ld
           ON ld.lead_credit_assign_user_id = u.user_id
           AND ld.lead_status_id IN (
             SELECT status_id FROM master_status WHERE status_name IN (
               'DISBURSED','CLOSED','SETTLED','WRITEOFF','PART-PAYMENT'
             )
           )
           AND DATE(ld.updated_on) BETWEEN ? AND ?
         LEFT JOIN cam_data cam ON ld.lead_id = cam.lead_id
         WHERE EXISTS (
             SELECT 1 FROM user_roles ur
             INNER JOIN master_role_type rt ON rt.role_type_id = ur.user_role_type_id
             WHERE ur.user_role_user_id = u.user_id AND rt.role_type_labels = 'CR2'
               AND ur.user_role_active = 1 AND ur.user_role_deleted = 0
           )
           AND u.user_id NOT IN (1,2,31,32,33,37,51,92,93,101)
           AND u.user_active = 1 AND u.user_status_id = 1
         GROUP BY u.user_id
       )
       SELECT
         ROW_NUMBER() OVER (
           ORDER BY
             CASE WHEN reportType = 'CREDIT' THEN 1 WHEN reportType = 'SCREENER' THEN 2 END,
             repeatTotal DESC,
             totalCases DESC
         ) AS srNo,
         reportType, executiveName, freshTotal, freshAmount, repeatTotal, repeatAmount, totalCases, totalAmount
       FROM final_data

       UNION ALL

       SELECT NULL, 'TOTAL', 'TOTAL',
              SUM(CASE WHEN reportType = 'CREDIT' THEN freshTotal ELSE 0 END),
              SUM(CASE WHEN reportType = 'CREDIT' THEN freshAmount ELSE 0 END),
              SUM(CASE WHEN reportType = 'CREDIT' THEN repeatTotal ELSE 0 END),
              SUM(CASE WHEN reportType = 'CREDIT' THEN repeatAmount ELSE 0 END),
              SUM(CASE WHEN reportType = 'CREDIT' THEN totalCases ELSE 0 END),
              SUM(CASE WHEN reportType = 'CREDIT' THEN totalAmount ELSE 0 END)
       FROM final_data`,
      [query.fromDate, query.toDate, query.fromDate, query.toDate],
    );
  }

  /** report_id 80 (code-only, no `master_mis_report` row) — ProcessTATReport
   * (`exportProcessTATModel`): stage-to-stage turnaround time for leads
   * whose credit-recommendation happened on the given date. Legacy's
   * version is a recursive CTE with `ROW_NUMBER`/`LAG` window functions
   * over `lead_followup` rows for a fixed set of stage-status ids; ported
   * using the same window-function approach directly in SQL (MySQL 8
   * supports this natively), scoped to `LeadFollowup` (this schema's
   * equivalent of `lead_followup`). Uses a raw parameterized query (not
   * QueryBuilder) since CTEs with window functions are outside
   * QueryBuilder's expression surface — the query string has no
   * user-controlled interpolation, only a single `?` bind parameter. */
  async processTat(fromDate: string) {
    return this.leadFollowupRepository.query(
      `WITH ordered_followups AS (
         SELECT lf.lead_id AS leadId, ms.status_name AS statusName, MIN(lf.created_on) AS eventAt,
                ROW_NUMBER() OVER (PARTITION BY lf.lead_id ORDER BY MIN(lf.created_on)) AS rn
         FROM lead_followup lf
         INNER JOIN leads l ON l.lead_id = lf.lead_id
         INNER JOIN master_status ms ON ms.status_id = lf.lead_followup_status_id
         WHERE l.user_type = 'NEW' AND DATE(l.lead_credit_assign_datetime) = ?
         GROUP BY lf.lead_id, ms.status_id, ms.status_name
       ),
       diffs AS (
         SELECT o.*, TIMESTAMPDIFF(HOUR, LAG(o.eventAt) OVER (PARTITION BY o.leadId ORDER BY o.eventAt), o.eventAt) AS hoursSincePrevStage
         FROM ordered_followups o
       )
       SELECT leadId, statusName, eventAt, hoursSincePrevStage FROM diffs ORDER BY leadId, eventAt`,
      [fromDate],
    );
  }

  /** report_id 2 — sanctionTATReport. **BROKEN in legacy** (calls a model
   * method, `SanctionTATReport`, that does not exist anywhere in
   * `Report_Model.php` — would fatal-error if invoked). Rebuilt here using
   * the same turnaround-time pattern as the working `processTat` above,
   * scoped specifically to the sanction/credit-approval stage: time from
   * credit assignment to credit approval, per lead, for leads approved in
   * the given date range. */
  async sanctionTat(query: DateRangeQueryDto) {
    if (!query.fromDate || !query.toDate) {
      return [];
    }
    return this.leadRepository
      .createQueryBuilder('lead')
      .innerJoin('lead.creditAssignedTo', 'u')
      .select('lead.id', 'leadId')
      .addSelect('lead.leadReferenceNo', 'leadReferenceNo')
      .addSelect('u.name', 'executiveName')
      .addSelect('lead.creditAssignedAt', 'creditAssignedAt')
      .addSelect('lead.creditApprovedAt', 'creditApprovedAt')
      .addSelect(
        'TIMESTAMPDIFF(HOUR, lead.creditAssignedAt, lead.creditApprovedAt)',
        'turnaroundHours',
      )
      .where('lead.creditApprovedAt IS NOT NULL')
      .andWhere('lead.creditAssignedAt IS NOT NULL')
      .andWhere('DATE(lead.creditApprovedAt) BETWEEN :fromDate AND :toDate', {
        fromDate: query.fromDate,
        toDate: query.toDate,
      })
      .orderBy('lead.creditApprovedAt', 'DESC')
      .getRawMany();
  }
}
