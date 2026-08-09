import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { DateRangeQueryDto } from '../../common/dto/date-range-query.dto';
import { ExecutiveCollectionQueryDto } from './dto/executive-collection-query.dto';
import { FinancialYearQueryDto } from './dto/financial-year-query.dto';
import { MonthQueryDto } from './dto/month-query.dto';

/**
 * Every query below stays raw parameterized SQL rather than QueryBuilder —
 * same precedent as `credit-reports.service.ts`'s `processTat()` — because
 * most of these reports are built from correlated subqueries (per-row DPD
 * bucket sums against `collection`) that don't map cleanly onto TypeORM's
 * relation-join model. All table/column names below are the real legacy
 * schema (`leads`/`credit_analysis_memo`/`loan`/`collection`/`master_status`/
 * `loan_collection_followup`/`master_followup_type`/`master_followup_status`/
 * `master_role_type`/`user_roles`/`master_branch`/`lead_followup`/`users`/
 * `user_lead_allocation_log`), not the invented plural names this file was
 * originally written against.
 *
 * `master_status` rows have no persisted `legacyId` column (seeding only used
 * it transiently to build an in-memory id map) — every legacy numeric status
 * id referenced below must be resolved by `status_name` instead, never
 * assumed to equal the new schema's auto-increment `status_id`.
 */
const CLOSED_STATUS_NAMES = ['CLOSED', 'SETTLED', 'WRITEOFF'];
const OPEN_STATUS_NAMES = ['DISBURSED', 'PART-PAYMENT'];

/** legacy ids 14/16/17/18/19 — the whole disbursed-through-closed lifecycle,
 * the filter every collection report in legacy uses. */
const COLLECTION_LIFECYCLE_STATUS_NAMES = [
  ...OPEN_STATUS_NAMES,
  ...CLOSED_STATUS_NAMES,
];

/** `master_role_type.role_type_labels` codes (not `role_type_id` — legacy
 * only guarantees the label is stable across environments). */
const COLLECTION_EXECUTIVE_ROLE_CODES = ['CO1', 'CO2', 'CO3'];
const SANCTION_EXECUTIVE_ROLE_CODES = ['CR1', 'CR2', 'CR3'];

/** `Collection.verificationStatus` (`payment_verification`) is a numeric
 * enum (0=Pending, 1=Approved, 2=Rejected), not the string `'APPROVED'` the
 * original file compared against everywhere — a real bug fixed throughout
 * this rewrite. */
const VERIFICATION_APPROVED = 1;

function statusNameList(names: string[]): string {
  return names.map((n) => `'${n}'`).join(',');
}

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

function monthRange(monthIso: string): { from: string; to: string } {
  const d = new Date(monthIso);
  const from = new Date(d.getFullYear(), d.getMonth(), 1);
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return {
    from: formatLocalDate(from),
    to: formatLocalDate(to),
  };
}

function financialYearRange(startIso: string): { from: string; to: string } {
  const d = new Date(startIso);
  const from = new Date(d.getFullYear(), d.getMonth(), 1);
  const to = new Date(d.getFullYear(), d.getMonth() + 12, 0);
  return {
    from: formatLocalDate(from),
    to: formatLocalDate(to),
  };
}

@Injectable()
export class CollectionReportsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * report_id 5, `CollectionPercentageReport`/`TotalCollectionPercentageModel`.
   * Despite the legacy name, the actual query is a sanction-executive-wise
   * breakdown of credit-approved leads (NEW vs REPEAT counts + amounts) —
   * ported faithfully to the code's real behavior, not the misleading name.
   */
  async collectionPercentageByExecutive(query: DateRangeQueryDto) {
    const params: unknown[] = [];
    let where = '1=1';
    if (query.fromDate && query.toDate) {
      where +=
        ' AND lead.lead_credit_approve_datetime >= ? AND lead.lead_credit_approve_datetime <= ?';
      params.push(query.fromDate, query.toDate);
    }
    return this.dataSource.query(
      `SELECT u.name AS executiveName,
              SUM(IF(lead.user_type='NEW',1,0)) AS newCount,
              SUM(IF(lead.user_type='NEW',cam.loan_recommended,0)) AS newAmount,
              SUM(IF(lead.user_type='REPEAT',1,0)) AS repeatCount,
              SUM(IF(lead.user_type='REPEAT',cam.loan_recommended,0)) AS repeatAmount
       FROM leads lead
       INNER JOIN credit_analysis_memo cam ON lead.lead_id = cam.lead_id
       INNER JOIN users u ON lead.lead_credit_assign_user_id = u.user_id
       WHERE ${where}
       GROUP BY u.user_id
       ORDER BY u.name`,
      params,
    );
  }

  /** report_id 7, `MonthwisePendingCollection`/`MonthwisePendingCollectionModel`. */
  async monthwisePendingCollection() {
    return this.dataSource.query(
      `SELECT DATE_FORMAT(cam.repayment_date, '%M-%y') AS monthYear,
              cam.repayment_date AS repaymentDate,
              cam.loan_recommended AS recommendedLoanAmount,
              (SELECT SUM(c.received_amount) FROM collection c
                 WHERE c.lead_id = lead.lead_id AND c.collection_active=1 AND c.payment_verification=${VERIFICATION_APPROVED}) AS collected,
              (SELECT SUM(c.received_amount) FROM collection c
                 WHERE c.lead_id = lead.lead_id AND c.collection_active=1 AND c.payment_verification=${VERIFICATION_APPROVED}
                   AND c.date_of_recived < CURDATE()) AS preCollected
       FROM credit_analysis_memo cam
       INNER JOIN loan l ON cam.lead_id = l.lead_id
       INNER JOIN leads lead ON cam.lead_id = lead.lead_id
       WHERE lead.lead_status_id IN (SELECT status_id FROM master_status WHERE status_name IN (${statusNameList(OPEN_STATUS_NAMES)}))
         AND l.status = 'DISBURSED'
         AND cam.repayment_date < CURDATE()
       ORDER BY cam.repayment_date DESC`,
    );
  }

  /**
   * report_id 10, `CollectionCallwithtimeReport`/`CollectionCallwithtimeModel`.
   * Legacy buckets call timestamps into 8 two-hour windows; the "Call"
   * followup type is looked up by name, not a magic id — no `FollowupType`
   * catalog id reliably maps across environments.
   */
  async collectionCallsByTime(query: DateRangeQueryDto) {
    const rows = await this.dataSource.query(
      `SELECT u.name AS userName, lcf.lcf_created_on AS createdAt
       FROM loan_collection_followup lcf
       INNER JOIN users u ON lcf.lcf_user_id = u.user_id
       WHERE lcf.lcf_type_id = (SELECT m_followup_type_id FROM master_followup_type WHERE m_followup_type_name='Call') AND lcf.lcf_active = 1
         AND DATE(lcf.lcf_created_on) >= ? AND DATE(lcf.lcf_created_on) <= ?
       ORDER BY TIME(lcf.lcf_created_on) ASC`,
      [query.fromDate, query.toDate],
    );
    return this.bucketByTwoHourWindow(
      rows as Array<{ userName: string; createdAt: Date }>,
    );
  }

  private bucketByTwoHourWindow(
    rows: Array<{ userName: string; createdAt: Date }>,
  ) {
    const windows = [
      '12:00-10:00 AM',
      '10:00-12:00 PM',
      '12:00-02:00 PM',
      '02:00-04:00 PM',
      '04:00-06:00 PM',
      '06:00-08:00 PM',
      '08:00-10:00 PM',
      '10:00-12:00 AM',
    ];
    const byUser = new Map<string, Record<string, number>>();
    for (const row of rows) {
      const hour = new Date(row.createdAt).getHours();
      const label = windows[Math.min(Math.floor(hour / 2), 7)];
      const bucket = byUser.get(row.userName) ?? {};
      bucket[label] = (bucket[label] ?? 0) + 1;
      byUser.set(row.userName, bucket);
    }
    return Array.from(byUser.entries()).map(([userName, buckets]) => ({
      userName,
      buckets,
    }));
  }

  /** report_id 12, `CollectionCallwithStatusReport`/`CollectionCallwithStatusModel`. */
  async collectionCallsByStatus(query: DateRangeQueryDto) {
    return this.dataSource.query(
      `SELECT u.name AS userName, fs.m_followup_status_name AS followupStatusName, COUNT(*) AS count
       FROM loan_collection_followup lcf
       INNER JOIN master_followup_status fs ON fs.m_followup_status_id = lcf.lcf_status_id
       INNER JOIN users u ON lcf.lcf_user_id = u.user_id
       WHERE lcf.lcf_type_id = (SELECT m_followup_type_id FROM master_followup_type WHERE m_followup_type_name='Call') AND lcf.lcf_active = 1
         AND DATE(lcf.lcf_created_on) >= ? AND DATE(lcf.lcf_created_on) <= ?
       GROUP BY u.user_id, fs.m_followup_status_id
       ORDER BY u.name`,
      [query.fromDate, query.toDate],
    );
  }

  /**
   * report_id 13, `MonthlyCollectionReport`/`MonthwiseCollectionModel` —
   * per-lead detail for a given month, disbursed loans only.
   */
  async monthlyCollectionDetail(query: MonthQueryDto) {
    const { from, to } = monthRange(query.month);
    return this.dataSource.query(
      `SELECT lead.lead_id AS leadId, l.loan_no AS loanNumber, lead.lead_status_id AS leadStatusId, cam.repayment_date AS repaymentDate,
              cam.loan_recommended AS recommendedLoanAmount, cam.repayment_amount AS repaymentAmount,
              l.loan_principle_received_amount AS principalReceived, l.loan_principle_outstanding_amount AS principalOutstanding,
              l.loan_interest_payable_amount AS interestPayable, l.loan_interest_received_amount AS interestReceived, l.loan_interest_outstanding_amount AS interestOutstanding,
              l.loan_penalty_payable_amount AS penaltyPayable, l.loan_penalty_received_amount AS penaltyReceived, l.loan_penalty_outstanding_amount AS penaltyOutstanding,
              l.loan_total_received_amount AS totalReceived
       FROM leads lead
       INNER JOIN credit_analysis_memo cam ON lead.lead_id = cam.lead_id
       INNER JOIN loan l ON lead.lead_id = l.lead_id
       WHERE l.status = 'DISBURSED' AND lead.lead_status_id IN (SELECT status_id FROM master_status WHERE status_name IN (${statusNameList(COLLECTION_LIFECYCLE_STATUS_NAMES)}))
         AND cam.repayment_date >= ? AND cam.repayment_date <= ?
       ORDER BY cam.repayment_date ASC`,
      [from, to],
    );
  }

  /**
   * report_id 21, `PaymentAnalysisReport`/`PaymentAnalysis` — legacy builds a
   * full disbursal-month x collection-month vintage/cohort matrix (12x14
   * cells). **Simplified here** to per-disbursal-month totals (disbursed
   * amount vs. collected amount) rather than the full cohort matrix — the
   * full vintage-analysis view is flagged in TODO.md as a follow-up if the
   * business needs the detailed cohort breakdown, not silently dropped.
   */
  async paymentAnalysisByDisbursalMonth(query: FinancialYearQueryDto) {
    const { from, to } = financialYearRange(query.financialYearStart);
    return this.dataSource.query(
      `SELECT DATE_FORMAT(cam.disbursal_date, '%M-%y') AS disbursalMonth,
              SUM(cam.loan_recommended) AS disbursedAmount,
              (SELECT COALESCE(SUM(c.received_amount), 0) FROM collection c
                 INNER JOIN credit_analysis_memo cam2 ON c.lead_id = cam2.lead_id
                 WHERE cam2.disbursal_date = cam.disbursal_date
                   AND c.payment_verification=${VERIFICATION_APPROVED} AND c.collection_active=1) AS collectedAmount
       FROM credit_analysis_memo cam
       INNER JOIN loan l ON cam.lead_id = l.lead_id
       WHERE l.status = 'DISBURSED' AND cam.disbursal_date >= ? AND cam.disbursal_date <= ?
       GROUP BY DATE_FORMAT(cam.disbursal_date, '%Y-%m')
       ORDER BY MIN(cam.disbursal_date) ASC`,
      [from, to],
    );
  }

  /**
   * Shared DPD-bucket calculation underlying report_ids 22/23/24
   * (`DateWisePreCollectionModel`/`DateWiseCollectionModel`/
   * `DateWiseRecoveryModel`), ported verbatim from legacy's
   * `PreCollectionCalculationModel` — a single correlated-subquery source of
   * truth for 5 DPD windows relative to the loan's due date
   * (`repayment_date`): pre-collection (on/before due date), pre-10
   * (due date, +10 days], collection ((+10, +60] days), recovery
   * ((+60, +180] days), legal (>+180 days).
   */
  private async dpdBucketDetail(fromDate: string, toDate: string) {
    return this.dataSource.query(
      `SELECT lead.lead_id AS leadId, l.loan_no AS loanNumber, lead.lead_status_id AS leadStatusId, cam.repayment_date AS repaymentDate,
              cam.loan_recommended AS recommendedLoanAmount,
              (SELECT SUM(c.received_amount) FROM collection c WHERE c.lead_id=lead.lead_id
                 AND c.collection_active=1 AND c.payment_verification=${VERIFICATION_APPROVED}
                 AND c.date_of_recived <= cam.repayment_date) AS preCollectionAmount,
              (SELECT SUM(c.received_amount) FROM collection c WHERE c.lead_id=lead.lead_id
                 AND c.collection_active=1 AND c.payment_verification=${VERIFICATION_APPROVED}
                 AND c.date_of_recived > cam.repayment_date
                 AND c.date_of_recived <= DATE_ADD(cam.repayment_date, INTERVAL 10 DAY)) AS pre10Amount,
              (SELECT SUM(c.received_amount) FROM collection c WHERE c.lead_id=lead.lead_id
                 AND c.collection_active=1 AND c.payment_verification=${VERIFICATION_APPROVED}
                 AND c.date_of_recived > DATE_ADD(cam.repayment_date, INTERVAL 10 DAY)
                 AND c.date_of_recived <= DATE_ADD(cam.repayment_date, INTERVAL 60 DAY)) AS collectionAmount,
              (SELECT SUM(c.received_amount) FROM collection c WHERE c.lead_id=lead.lead_id
                 AND c.collection_active=1 AND c.payment_verification=${VERIFICATION_APPROVED}
                 AND c.date_of_recived > DATE_ADD(cam.repayment_date, INTERVAL 60 DAY)
                 AND c.date_of_recived <= DATE_ADD(cam.repayment_date, INTERVAL 180 DAY)) AS recoveryAmount,
              (SELECT SUM(c.received_amount) FROM collection c WHERE c.lead_id=lead.lead_id
                 AND c.collection_active=1 AND c.payment_verification=${VERIFICATION_APPROVED}
                 AND c.date_of_recived > DATE_ADD(cam.repayment_date, INTERVAL 180 DAY)) AS legalAmount
       FROM leads lead
       INNER JOIN credit_analysis_memo cam ON lead.lead_id = cam.lead_id
       INNER JOIN loan l ON lead.lead_id = l.lead_id
       WHERE lead.lead_status_id IN (SELECT status_id FROM master_status WHERE status_name IN (${statusNameList(COLLECTION_LIFECYCLE_STATUS_NAMES)}))
         AND cam.repayment_date >= ? AND cam.repayment_date <= ?`,
      [fromDate, toDate],
    );
  }

  /** report_id 22, `DateWisePreCollectionReport` — the pre-collection (on/before
   * due date) DPD bucket from the shared calculation. */
  async preCollectionByMonth(query: MonthQueryDto) {
    const { from, to } = monthRange(query.month);
    const rows = await this.dpdBucketDetail(from, to);
    return (rows as Array<Record<string, unknown>>).map((r) => ({
      leadId: r.leadId,
      loanNumber: r.loanNumber,
      repaymentDate: r.repaymentDate,
      loanRecommended: r.recommendedLoanAmount,
      preCollectionAmount: r.preCollectionAmount ?? 0,
    }));
  }

  /** report_id 23, `DateWiseCollectionReport` — the "collection" DPD bucket
   * ((+10, +60] days past due), from the shared calculation. Note: the
   * research summary called this "up to 40 DPD" — the real legacy window is
   * (10, 60] days, confirmed directly from `PreCollectionCalculationModel`. */
  async collectionByMonth(query: MonthQueryDto) {
    const { from, to } = monthRange(query.month);
    const rows = await this.dpdBucketDetail(from, to);
    return (rows as Array<Record<string, unknown>>).map((r) => ({
      leadId: r.leadId,
      loanNumber: r.loanNumber,
      repaymentDate: r.repaymentDate,
      loanRecommended: r.recommendedLoanAmount,
      collectionAmount: r.collectionAmount ?? 0,
    }));
  }

  /** report_id 24, `DateWiseRecoveryReport` — the "recovery" DPD bucket
   * ((+60, +180] days past due), from the shared calculation. */
  async recoveryByMonth(query: MonthQueryDto) {
    const { from, to } = monthRange(query.month);
    const rows = await this.dpdBucketDetail(from, to);
    return (rows as Array<Record<string, unknown>>).map((r) => ({
      leadId: r.leadId,
      loanNumber: r.loanNumber,
      repaymentDate: r.repaymentDate,
      loanRecommended: r.recommendedLoanAmount,
      recoveryAmount: r.recoveryAmount ?? 0,
    }));
  }

  /**
   * report_ids 30/47, `CollectionBucketCaseWiseReport`/`...AmountReport`
   * (`CollectionBucketCaseWiseModel`/`...AmountModel`) — ported verbatim,
   * including its own distinct (cruder) bucket scheme: on-or-before due
   * date / 1-10 DPD / 10+ DPD, computed from days-since-last-verified-
   * payment vs. the due date, for CLOSED/SETTLED/WRITEOFF leads, plus a
   * separate "Not Closed" bucket for still-open DISBURSED/PART-PAYMENT
   * leads. `byAmount` selects the sum-of-received-amount variant (report 47)
   * instead of the case-count variant (report 30).
   */
  async collectionBucketCaseWise(query: DateRangeQueryDto, byAmount: boolean) {
    const rows = await this.dataSource.query(
      `SELECT lead.lead_id AS leadId, ms.status_name AS statusName, cam.repayment_date AS repaymentDate, lead.user_type AS userType,
              (SELECT c.received_amount FROM collection c WHERE c.lead_id=lead.lead_id
                 AND c.payment_verification=${VERIFICATION_APPROVED} AND c.collection_active=1
                 ORDER BY c.date_of_recived DESC LIMIT 1) AS lastPaymentAmount,
              (SELECT c.date_of_recived FROM collection c WHERE c.lead_id=lead.lead_id
                 AND c.payment_verification=${VERIFICATION_APPROVED} AND c.collection_active=1
                 ORDER BY c.date_of_recived DESC LIMIT 1) AS lastPaymentDate
       FROM leads lead
       INNER JOIN credit_analysis_memo cam ON lead.lead_id = cam.lead_id
       INNER JOIN loan l ON lead.lead_id = l.lead_id
       INNER JOIN master_status ms ON lead.lead_status_id = ms.status_id
       WHERE ms.status_name IN (${statusNameList(COLLECTION_LIFECYCLE_STATUS_NAMES)})
         AND cam.repayment_date >= ? AND cam.repayment_date <= ?`,
      [query.fromDate, query.toDate],
    );

    const buckets: Record<string, { NEW: number; REPEAT: number }> = {
      'On/Before Due Date': { NEW: 0, REPEAT: 0 },
      'Collection (1 to 10 DPD)': { NEW: 0, REPEAT: 0 },
      'Recovery (10+ DPD)': { NEW: 0, REPEAT: 0 },
      'Not Closed': { NEW: 0, REPEAT: 0 },
    };
    for (const row of rows as Array<Record<string, unknown>>) {
      const statusName = row.statusName as string;
      const userType = row.userType as 'NEW' | 'REPEAT';
      const value = byAmount ? Number(row.lastPaymentAmount ?? 0) : 1;
      if (CLOSED_STATUS_NAMES.includes(statusName)) {
        const dpd = row.lastPaymentDate
          ? (new Date(row.lastPaymentDate as string).getTime() -
              new Date(row.repaymentDate as string).getTime()) /
            (1000 * 60 * 60 * 24)
          : 0;
        const bucket =
          dpd <= 0
            ? 'On/Before Due Date'
            : dpd <= 10
              ? 'Collection (1 to 10 DPD)'
              : 'Recovery (10+ DPD)';
        buckets[bucket][userType] += value;
      } else if (OPEN_STATUS_NAMES.includes(statusName)) {
        buckets['Not Closed'][userType] += value;
      }
    }
    return Object.entries(buckets).map(([bucket, counts]) => ({
      bucket,
      ...counts,
    }));
  }

  /**
   * report_ids 39/40, `CollectionbyCollectionExecutiveModel` — collection
   * totals grouped by collection executive (restricted to `master_role_type`
   * codes CO1/CO2/CO3), split by repayment_type (the loan's closing status).
   * `typeId` 1 = filter by actual payment date, 2 = by due date.
   */
  async collectionByCollectionExecutive(query: ExecutiveCollectionQueryDto) {
    return this.groupedCollectionByRole(query, COLLECTION_EXECUTIVE_ROLE_CODES);
  }

  /**
   * report_ids 41/42, `CollectionbySanctionExecutiveModel` — same shape,
   * restricted to `master_role_type` codes CR1/CR2/CR3 instead.
   */
  async collectionBySanctionExecutive(query: ExecutiveCollectionQueryDto) {
    return this.groupedCollectionByRole(query, SANCTION_EXECUTIVE_ROLE_CODES);
  }

  private async groupedCollectionByRole(
    query: ExecutiveCollectionQueryDto,
    roleCodes: string[],
  ) {
    const dateColumn =
      query.typeId === 1 ? 'c.date_of_recived' : 'cam.repayment_date';
    const rows = await this.dataSource.query(
      `SELECT u.name AS executiveName, rt.status_name AS repaymentTypeName, COUNT(c.lead_id) AS totalCases,
              SUM(c.received_amount) AS totalReceived
       FROM collection c
       INNER JOIN users u ON c.collection_executive_user_id = u.user_id
       INNER JOIN credit_analysis_memo cam ON c.lead_id = cam.lead_id
       LEFT JOIN master_status rt ON rt.status_id = c.repayment_type
       WHERE c.received_amount > 0 AND c.payment_verification=${VERIFICATION_APPROVED} AND c.collection_active=1
         AND c.collection_executive_user_id IN (
           SELECT DISTINCT ur.user_role_user_id FROM user_roles ur
           WHERE ur.user_role_active=1 AND ur.user_role_type_id IN (
             SELECT role_type_id FROM master_role_type WHERE role_type_labels IN (${roleCodes.map(() => '?').join(',')})
           )
         )
         AND ${dateColumn} >= ? AND ${dateColumn} <= ?
       GROUP BY c.collection_executive_user_id, rt.status_id
       ORDER BY u.name`,
      [...roleCodes, query.fromDate, query.toDate],
    );
    return rows;
  }

  /**
   * report_ids 43/44, `CollectionbyBranchModel` — same shape, grouped by the
   * lead's branch instead of an executive, no role restriction.
   */
  async collectionByBranch(query: ExecutiveCollectionQueryDto) {
    const dateColumn =
      query.typeId === 1 ? 'c.date_of_recived' : 'cam.repayment_date';
    return this.dataSource.query(
      `SELECT b.m_branch_name AS branchName, rt.status_name AS repaymentTypeName, COUNT(c.lead_id) AS totalCases,
              SUM(c.received_amount) AS totalReceived
       FROM collection c
       INNER JOIN leads lead ON c.lead_id = lead.lead_id
       INNER JOIN credit_analysis_memo cam ON c.lead_id = cam.lead_id
       INNER JOIN master_branch b ON lead.lead_branch_id = b.m_branch_id
       LEFT JOIN master_status rt ON rt.status_id = c.repayment_type
       WHERE c.received_amount > 0 AND c.payment_verification=${VERIFICATION_APPROVED} AND c.collection_active=1
         AND ${dateColumn} >= ? AND ${dateColumn} <= ?
       GROUP BY b.m_branch_id, rt.status_id
       ORDER BY b.m_branch_name`,
      [query.fromDate, query.toDate],
    );
  }

  /**
   * report_id 48, `HourlyCollectionReport` — **STUB in legacy** (literal
   * "Working On It." placeholder, never implemented; `HourlyCollectionModel`
   * exists but is dead code, never invoked). Rebuilt here as a real report:
   * verified collection amounts bucketed by hour of the payment day. See
   * `REPORTING-QUESTIONS-FOR-CLIENT.md` for the business-facing note on this
   * reconstruction.
   */
  async hourlyCollection(query: DateRangeQueryDto) {
    const rows = await this.dataSource.query(
      `SELECT HOUR(date_of_recived) AS hourOfDay, COUNT(*) AS caseCount, SUM(received_amount) AS totalAmount
       FROM collection
       WHERE payment_verification=${VERIFICATION_APPROVED} AND collection_active=1
         AND date_of_recived >= ? AND date_of_recived <= ?
       GROUP BY HOUR(date_of_recived)
       ORDER BY hourOfDay ASC`,
      [query.fromDate, query.toDate],
    );
    return rows;
  }

  /**
   * report_id 55 (legacy DB label "Collection Report SCM Wise" — a
   * numeric-id-drift bug; the real code behind this id is
   * `SanctionWiseLeadConversionModel`, lead→sanction conversion by sanction
   * executive). Legacy computes a complex day-over-day delta (today's
   * followups vs. yesterday's) — **simplified here** to same-day followup
   * outcome counts (rejected / disbursed / pending) grouped by screener,
   * for the given date, rather than the full delta comparison. Flagged in
   * TODO.md, not silently approximated without note.
   */
  async sanctionWiseLeadConversion(date: string) {
    return this.dataSource.query(
      `SELECT u.name AS screenerName,
              SUM(IF(lf.lead_followup_status_id = (SELECT status_id FROM master_status WHERE status_name='REJECT'), 1, 0)) AS rejectedCount,
              SUM(IF(lf.lead_followup_status_id IN (
                SELECT status_id FROM master_status WHERE status_name IN ('DISBURSED','CLOSED','SETTLED','WRITEOFF','PART-PAYMENT')
              ), 1, 0)) AS disbursedCount,
              COUNT(DISTINCT lf.lead_id) AS totalLeads
       FROM lead_followup lf
       INNER JOIN leads lead ON lf.lead_id = lead.lead_id
       INNER JOIN users u ON lead.lead_screener_assign_user_id = u.user_id
       WHERE DATE(lf.created_on) = ? AND lead.lead_active=1 AND lead.lead_deleted=0
       GROUP BY u.user_id
       ORDER BY lead.lead_id DESC`,
      [date],
    );
  }

  /**
   * report_id 73 (legacy DB label "Leads Affiliate Money Report" — a
   * numeric-id-drift bug; the real code behind this id is
   * `CurrentBucketStatusModel`). Ported field-for-field from the real query
   * (`Report_Model.php:10779`), not the earlier simplified version this
   * method used to be:
   * - Base is active CR1/screener + CR2/credit-manager users who logged in
   *   within the last 3 days, each joined to their supervisor
   *   (`UserRole.supervisorRole`, legacy's `CR3`/credit-head alias) — a user
   *   with no supervisor role assigned is excluded, matching legacy's
   *   `INNER JOIN users U3`.
   * - Each such user's leads: `COALESCE(creditAssign, screenerAssign)`,
   *   restricted to the in-process queue statuses a screener/credit-manager
   *   actively works — legacy's hardcoded `status_id IN (2,3,5,6,11)`,
   *   resolved here by `status_name` (`LEAD-INPROCESS`/`LEAD-HOLD`/
   *   `APPLICATION-INPROCESS`/`APPLICATION-HOLD`/`APPLICATION-SEND-BACK`)
   *   per this file's rule against trusting `master_status`'s auto-increment
   *   id to match legacy's. The subsequent `INNER JOIN master_status`
   *   (kept, not upgraded to LEFT) reproduces legacy's real behavior of
   *   silently dropping any user with zero leads in that status set, even
   *   though the lead join itself is a LEFT JOIN — an inner join on a
   *   nullable column never matches NULL, so it acts as a filter.
   * - `user_activity_flags`: today's latest declaration per user from
   *   `user_lead_allocation_log` (`LeadAllocationService`'s new self-service
   *   endpoint — see docs/COMPLETED.md), MAX-aggregated the same way legacy
   *   does, defaulting to `'-'` via `COALESCE` when nobody has declared
   *   today. This is the piece that was previously omitted for lack of an
   *   entity; it exists now.
   */
  async currentBucketStatus() {
    return this.dataSource.query(
      `WITH user_activity_flags AS (
         SELECT
           ula.ula_user_id AS userId,
           MAX(CASE WHEN ula.ula_user_status = 1 THEN 'ACTIVE' ELSE 'IN-ACTIVE' END) AS userActiveFlag,
           MAX(CASE
             WHEN ula.ula_user_case_type = 1 THEN 'NEW'
             WHEN ula.ula_user_case_type = 2 THEN 'REPEAT'
             ELSE ''
           END) AS userTypeFlag
         FROM user_lead_allocation_log ula
         WHERE DATE(ula.ula_created_on) = CURDATE() AND ula.ula_active = 1
         GROUP BY ula.ula_user_id
       )
       SELECT
         head.user_id AS creditHeadId, head.name AS creditHeadName,
         u.user_id AS creditManagerId, u.name AS creditManagerName,
         lead.user_type AS userType,
         COUNT(DISTINCT lead.lead_id) AS count,
         ms.status_name AS statusName,
         COALESCE(uaf.userActiveFlag, '-') AS userActiveFlag,
         COALESCE(uaf.userTypeFlag, '-') AS userTypeFlag
       FROM users u
       INNER JOIN user_roles ur
         ON ur.user_role_user_id = u.user_id
         AND ur.user_role_active = 1
         AND ur.user_role_type_id IN (
           SELECT role_type_id FROM master_role_type WHERE role_type_labels IN ('CR1','CR2')
         )
       LEFT JOIN user_roles head_role ON head_role.user_role_id = ur.user_role_supervisor_role_id
       INNER JOIN users head ON head.user_id = head_role.user_role_user_id
       LEFT JOIN leads lead
         ON COALESCE(lead.lead_credit_assign_user_id, lead.lead_screener_assign_user_id) = u.user_id
         AND lead.lead_status_id IN (
           SELECT status_id FROM master_status WHERE status_name IN (
             'LEAD-INPROCESS','LEAD-HOLD','APPLICATION-INPROCESS','APPLICATION-HOLD','APPLICATION-SEND-BACK'
           )
         )
         AND lead.lead_active = 1
       INNER JOIN master_status ms ON ms.status_id = lead.lead_status_id
       LEFT JOIN user_activity_flags uaf ON uaf.userId = u.user_id
       WHERE u.user_last_login_datetime >= NOW() - INTERVAL 3 DAY
       GROUP BY lead.lead_status_id, lead.user_type, u.user_id, head.user_id
       ORDER BY head.user_id DESC, u.name ASC, ms.status_name ASC`,
    );
  }

  /**
   * report_id 35, `FYrepaymentcollectionReport`/`FYrepaymentcollectionModel`
   * — same per-lead detail shape as report 13, rolled up over a full
   * financial year (12 months) instead of a single month.
   */
  async fyRepaymentCollection(query: FinancialYearQueryDto) {
    const { from, to } = financialYearRange(query.financialYearStart);
    return this.dataSource.query(
      `SELECT DATE_FORMAT(cam.repayment_date, '%M-%y') AS monthYear,
              COUNT(*) AS caseCount,
              SUM(cam.loan_recommended) AS loanRecommended,
              SUM(l.loan_total_received_amount) AS totalReceived,
              SUM(l.loan_principle_received_amount) AS principalReceived,
              SUM(l.loan_principle_outstanding_amount) AS principalOutstanding,
              SUM(l.loan_interest_received_amount) AS interestReceived,
              SUM(l.loan_interest_outstanding_amount) AS interestOutstanding,
              SUM(l.loan_penalty_received_amount) AS penaltyReceived,
              SUM(l.loan_penalty_outstanding_amount) AS penaltyOutstanding
       FROM leads lead
       INNER JOIN credit_analysis_memo cam ON lead.lead_id = cam.lead_id
       INNER JOIN loan l ON lead.lead_id = l.lead_id
       WHERE l.status = 'DISBURSED' AND lead.lead_status_id IN (SELECT status_id FROM master_status WHERE status_name IN (${statusNameList(COLLECTION_LIFECYCLE_STATUS_NAMES)}))
         AND cam.repayment_date >= ? AND cam.repayment_date <= ?
       GROUP BY DATE_FORMAT(cam.repayment_date, '%Y-%m')
       ORDER BY MIN(cam.repayment_date) ASC`,
      [from, to],
    );
  }

  /**
   * Ports `collection_approval_hour_report()` from
   * `CronJobs/CronReportController.php` — average turnaround time (hours)
   * between a collection entry being logged and its verification closure,
   * by the closing (approving) user, for a date range. This schema has no
   * separate "collection assigned" timestamp — `Collection.createdAt`
   * (`collection_executive_payment_created_on`, entry submitted) to
   * `Collection.closedAt` (`closure_payment_updated_on`, verification
   * closed) is the closest equivalent to legacy's assign-to-approve window.
   * No `master_mis_report` row exists for this one (code-only in legacy,
   * same as credit-reports' `processTat`/id 80).
   */
  async collectionApprovalHour(query: DateRangeQueryDto) {
    if (!query.fromDate || !query.toDate) {
      return [];
    }
    return this.dataSource.query(
      `SELECT u.name AS executiveName,
              COUNT(*) AS caseCount,
              AVG(TIMESTAMPDIFF(HOUR, c.collection_executive_payment_created_on, c.closure_payment_updated_on)) AS avgTurnaroundHours
       FROM collection c
       INNER JOIN users u ON u.user_id = c.closure_user_id
       WHERE c.payment_verification = ${VERIFICATION_APPROVED} AND c.closure_payment_updated_on IS NOT NULL
         AND DATE(c.closure_payment_updated_on) BETWEEN ? AND ?
       GROUP BY u.user_id, u.name
       ORDER BY u.name ASC`,
      [query.fromDate, query.toDate],
    );
  }
}
