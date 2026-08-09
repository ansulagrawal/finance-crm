import {
  Collection,
  CollectionVerificationStatus,
  CreditAnalysisMemo,
  Lead,
  LeadCustomer,
  Loan,
  LoanCollectionFollowup,
  MasterStatus,
} from '@finance-crm/database';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { DateRangeQueryDto } from '../../common/dto/date-range-query.dto';

/**
 * CSV exports for the collection/recovery domain — ports
 * `application/models/Export_Model.php`'s collection-related export methods
 * (verbatim SQL joins re-derived here as parameterized TypeORM
 * QueryBuilder over this schema's normalized entities, not a 1:1 column
 * copy since several legacy columns — GST/admin-fee breakdowns,
 * `customer_employment` fields — have no equivalent field in this schema).
 * All queries filter `isDeleted = false` throughout (legacy's `*_active`
 * flags).
 *
 * Two real schema mismatches fixed throughout: (1) `Lead` has no
 * `leadCustomer` relation — `LeadCustomer` is joined as an entity class on
 * `customer.leadId = lead.id`, same pattern as `credit-exports`/
 * `disbursal-exports`; (2) `Collection.verificationStatus`
 * (`payment_verification`) is the numeric `CollectionVerificationStatus`
 * enum, not the string `'APPROVED'`/`'PENDING'`/`'REJECTED'` the original
 * file compared against. Also `netDisbursalAmount` lives on
 * `CreditAnalysisMemo`, not `Loan` — every `collection`-rooted query that
 * read `loan.netDisbursalAmount` now joins `CreditAnalysisMemo` and reads
 * `cam.netDisbursalAmount` instead. `Collection.repaymentType` is not a
 * relation either (`repaymentTypeId` is a varchar matching
 * `MasterStatus.id` without a formal FK) — joined as an entity class the
 * same way.
 */
@Injectable()
export class CollectionExportsService {
  constructor(
    @InjectRepository(Collection)
    private readonly collectionRepository: Repository<Collection>,
    @InjectRepository(LoanCollectionFollowup)
    private readonly followupRepository: Repository<LoanCollectionFollowup>,
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
  ) {}

  /** export_id 9 — `ExportLoanClosed`: closed loans with recovery/NOC detail. */
  async loanClosed(query: DateRangeQueryDto) {
    const qb = this.collectionRepository
      .createQueryBuilder('collection')
      .leftJoin('collection.lead', 'lead')
      .leftJoin(LeadCustomer, 'customer', 'customer.leadId = lead.id')
      .leftJoin('collection.loan', 'loan')
      .leftJoin(CreditAnalysisMemo, 'cam', 'cam.leadId = collection.leadId')
      .leftJoin('collection.collectionExecutive', 'collector')
      .leftJoin('collection.closedBy', 'closer')
      .leftJoin(
        MasterStatus,
        'repaymentType',
        'repaymentType.id = collection.repaymentTypeId',
      )
      .where('collection.isDeleted = false')
      .andWhere('collection.verificationStatus = :verified', {
        verified: CollectionVerificationStatus.APPROVED,
      })
      .andWhere('collection.receivedDate IS NOT NULL')
      .select([
        'collection.id AS leadId',
        'customer.firstName AS customerFirstName',
        'customer.surName AS customerSurName',
        'customer.pancard AS pancard',
        'lead.userType AS userType',
        'loan.loanNumber AS loanNumber',
        'cam.netDisbursalAmount AS loanAmount',
        'collection.refund AS refund',
        'loan.principalReceived AS principalReceived',
        'loan.interestReceived AS interestReceived',
        'loan.penaltyReceived AS penaltyReceived',
        'loan.totalDiscount AS totalDiscount',
        'loan.totalReceived AS totalReceived',
        'collector.name AS recoveryBy',
        'collection.createdAt AS recoveryDate',
        'closer.name AS verifiedBy',
        'collection.closedAt AS verifiedDate',
        'collection.referenceNo AS referenceNo',
        'collection.remarks AS remarks',
        'loan.closedAt AS loanClosedAt',
        'repaymentType.name AS status',
      ]);
    this.applyDateRange(qb, 'collection.closedAt', query);
    return qb.getRawMany();
  }

  /** export_id 10 — `exportCSVPendingRecovery`: **STUB in legacy**, always
   * "No Records Found", the export logic was never written. Rebuilt here
   * using the same column structure as `totalRecovery` (export_id 12),
   * scoped to collection records that are received but not yet verified —
   * the closest real proxy for "pending recovery" in this schema. Flagged
   * as a reconstruction, not a port — see REPORTING-QUESTIONS-FOR-CLIENT.md. */
  async pendingRecovery(query: DateRangeQueryDto) {
    const qb = this.collectionRepository
      .createQueryBuilder('collection')
      .leftJoin('collection.lead', 'lead')
      .leftJoin(LeadCustomer, 'customer', 'customer.leadId = lead.id')
      .leftJoin('collection.loan', 'loan')
      .leftJoin(CreditAnalysisMemo, 'cam', 'cam.leadId = collection.leadId')
      .leftJoin('lead.branch', 'branch')
      .leftJoin('collection.collectionExecutive', 'collector')
      .where('collection.isDeleted = false')
      .andWhere('collection.verificationStatus = :pending', {
        pending: CollectionVerificationStatus.PENDING,
      })
      .select([
        'collection.id AS leadId',
        'branch.name AS branchName',
        'customer.firstName AS customerFirstName',
        'customer.surName AS customerSurName',
        'loan.loanNumber AS loanNumber',
        'cam.netDisbursalAmount AS loanAmount',
        'collection.receivedAmount AS receivedAmount',
        'collection.receivedDate AS receivedDate',
        'collector.name AS recoveryBy',
        'collection.referenceNo AS referenceNo',
        'collection.remarks AS remarks',
      ]);
    this.applyDateRange(qb, 'collection.receivedDate', query);
    return qb.getRawMany();
  }

  /** export_id 11 — `ExportCollectionReport`: collection CSV with
   * employer/salary detail. Legacy gates extra PII columns (mobile/email)
   * behind a hardcoded user_id plus a role check — this port gates that
   * extra detail purely by role (SA/CA) via `includeContactDetails`,
   * dropping the hardcoded user-id allowlist entirely. */
  async collection(query: DateRangeQueryDto, includeContactDetails: boolean) {
    const qb = this.collectionRepository
      .createQueryBuilder('collection')
      .leftJoin('collection.lead', 'lead')
      .leftJoin(LeadCustomer, 'customer', 'customer.leadId = lead.id')
      .leftJoin('collection.loan', 'loan')
      .leftJoin(CreditAnalysisMemo, 'cam', 'cam.leadId = collection.leadId')
      .leftJoin('lead.city', 'city')
      .where('collection.isDeleted = false')
      .select([
        'collection.id AS leadId',
        'customer.pancard AS pancard',
        'loan.loanNumber AS loanNumber',
        'customer.firstName AS customerFirstName',
        'customer.surName AS customerSurName',
        'customer.gender AS gender',
        'cam.netDisbursalAmount AS loanAmount',
        'loan.status AS disbursementStatus',
        'lead.userType AS userType',
        'city.name AS cityName',
        'lead.leadEntryDate AS leadInitiatedDate',
        'lead.utmSource AS utmSource',
      ]);
    if (includeContactDetails) {
      qb.addSelect('customer.mobile', 'mobile')
        .addSelect('customer.alternateMobile', 'alternateMobile')
        .addSelect('customer.email', 'email')
        .addSelect('customer.alternateEmail', 'alternateEmail');
    }
    this.applyDateRange(qb, 'collection.createdAt', query);
    return qb.getRawMany();
  }

  /** export_id 12 — `ExportTotalRecovery`: total recovery with closure detail. */
  async totalRecovery(query: DateRangeQueryDto) {
    const qb = this.collectionRepository
      .createQueryBuilder('collection')
      .leftJoin('collection.lead', 'lead')
      .leftJoin(LeadCustomer, 'customer', 'customer.leadId = lead.id')
      .leftJoin('collection.loan', 'loan')
      .leftJoin(CreditAnalysisMemo, 'cam', 'cam.leadId = collection.leadId')
      .leftJoin('lead.branch', 'branch')
      .leftJoin('lead.city', 'city')
      .leftJoin('lead.state', 'state')
      .leftJoin('collection.collectionExecutive', 'collector')
      .leftJoin('collection.closedBy', 'closer')
      .where('collection.isDeleted = false')
      .andWhere('collection.verificationStatus = :verified', {
        verified: CollectionVerificationStatus.APPROVED,
      })
      .andWhere('collection.receivedDate IS NOT NULL')
      .select([
        'collection.id AS leadId',
        'branch.name AS branchName',
        'city.name AS cityName',
        'state.name AS stateName',
        'loan.loanNumber AS loanNumber',
        'customer.firstName AS customerFirstName',
        'customer.surName AS customerSurName',
        'cam.netDisbursalAmount AS loanAmount',
        'collection.receivedAmount AS receivedAmount',
        'collection.receivedDate AS receivedDate',
        'loan.status AS loanStatus',
        'collection.discount AS discount',
        'collection.refund AS refund',
        'collector.name AS recoveryBy',
        'closer.name AS verifiedBy',
        'collection.closedAt AS verifiedDate',
        'collection.referenceNo AS referenceNo',
        'collection.remarks AS collectionRemarks',
        'collection.closureRemarks AS closureRemarks',
      ]);
    this.applyDateRange(qb, 'collection.closedAt', query);
    return qb.getRawMany();
  }

  /** export_id 21 — `ExportPreCollection`: pre-due-date collection list —
   * disbursed loans with a repayment date falling within the range. */
  async preCollection(query: DateRangeQueryDto) {
    const qb = this.leadRepository
      .createQueryBuilder('lead')
      .innerJoin(LeadCustomer, 'customer', 'customer.leadId = lead.id')
      .innerJoin(CreditAnalysisMemo, 'cam', 'cam.leadId = lead.id')
      .innerJoin(Loan, 'loan', 'loan.leadId = lead.id')
      .leftJoin('lead.state', 'state')
      .leftJoin('lead.city', 'city')
      .leftJoin('lead.creditAssignedTo', 'creditManager')
      .where('lead.isDeleted = false')
      .select([
        'lead.id AS leadId',
        'lead.source AS source',
        'customer.firstName AS customerFirstName',
        'customer.surName AS customerSurName',
        'lead.userType AS userType',
        'customer.email AS email',
        'customer.mobile AS mobile',
        'loan.loanNumber AS loanNumber',
        'cam.recommendedLoanAmount AS recommendedLoanAmount',
        'cam.roi AS roi',
        'cam.tenureDays AS tenureDays',
        'cam.repaymentDate AS repaymentDate',
        'cam.disbursalDate AS disbursalDate',
        'cam.repaymentAmount AS repaymentAmount',
        'creditManager.name AS creditManagerName',
        'state.name AS stateName',
        'city.name AS cityName',
      ]);
    this.applyDateRange(
      qb,
      'cam.repaymentDate',
      query,
      'fromDate',
      'toDate',
      false,
    );
    return qb.getRawMany();
  }

  /** export_id 22 — `ExportPendingCollectionverification`: payments pending
   * accounts (AC) verification. */
  async pendingCollectionVerification(query: DateRangeQueryDto) {
    const qb = this.collectionRepository
      .createQueryBuilder('collection')
      .leftJoin('collection.lead', 'lead')
      .leftJoin(LeadCustomer, 'customer', 'customer.leadId = lead.id')
      .leftJoin('collection.loan', 'loan')
      .leftJoin(CreditAnalysisMemo, 'cam', 'cam.leadId = collection.leadId')
      .leftJoin('lead.state', 'state')
      .leftJoin('lead.city', 'city')
      .leftJoin('collection.collectionExecutive', 'collector')
      .where('collection.isDeleted = false')
      .andWhere('collection.verificationStatus = :pending', {
        pending: CollectionVerificationStatus.PENDING,
      })
      .select([
        'collection.id AS leadId',
        'customer.firstName AS customerFirstName',
        'customer.surName AS customerSurName',
        'loan.loanNumber AS loanNumber',
        'cam.netDisbursalAmount AS loanAmount',
        'collection.receivedAmount AS receivedAmount',
        'collection.receivedDate AS receivedDate',
        'collector.name AS recoveryBy',
        'collection.referenceNo AS referenceNo',
        'collection.remarks AS remarks',
        'state.name AS stateName',
        'city.name AS cityName',
      ]);
    this.applyDateRange(qb, 'collection.createdAt', query);
    return qb.getRawMany();
  }

  /** export_id 23 — `ExportLegalData`: legal-notice case data — disbursed
   * loans with a repayment date in range (legacy scopes this to
   * DISBURSED/PART-PAYMENT loan statuses awaiting legal escalation). */
  async legalData(query: DateRangeQueryDto) {
    const qb = this.leadRepository
      .createQueryBuilder('lead')
      .innerJoin(Loan, 'loan', 'loan.leadId = lead.id')
      .leftJoin(LeadCustomer, 'customer', 'customer.leadId = lead.id')
      .innerJoin(CreditAnalysisMemo, 'cam', 'cam.leadId = lead.id')
      .leftJoin('lead.leadStatus', 'leadStatus')
      .leftJoin('lead.creditAssignedTo', 'creditManager')
      .leftJoin('lead.branch', 'branch')
      .where('lead.isDeleted = false')
      .andWhere('loan.status = :disbursed', { disbursed: 'DISBURSED' })
      .select([
        'lead.id AS leadId',
        'loan.loanNumber AS loanNumber',
        'customer.firstName AS customerFirstName',
        'customer.surName AS customerSurName',
        'customer.mobile AS mobile',
        'cam.recommendedLoanAmount AS recommendedLoanAmount',
        'cam.adminFee AS adminFee',
        'cam.tenureDays AS tenureDays',
        'cam.roi AS roi',
        'cam.repaymentAmount AS repaymentAmount',
        'cam.disbursalDate AS disbursalDate',
        'cam.repaymentDate AS repaymentDate',
        'lead.userType AS userType',
        'leadStatus.name AS leadStatus',
        'creditManager.name AS creditManagerName',
        'customer.currentAddressLine1 AS addressLine1',
        'customer.currentAddressLine2 AS addressLine2',
        'customer.pincode AS pincode',
        'branch.name AS branchName',
      ]);
    this.applyDateRange(
      qb,
      'cam.repaymentDate',
      query,
      'fromDate',
      'toDate',
      false,
    );
    return qb.getRawMany();
  }

  /** export_id 29 — `ExportOutstandingData`: outstanding-loan data. */
  async outstandingData(query: DateRangeQueryDto) {
    const qb = this.leadRepository
      .createQueryBuilder('lead')
      .innerJoin(LeadCustomer, 'customer', 'customer.leadId = lead.id')
      .innerJoin(CreditAnalysisMemo, 'cam', 'cam.leadId = lead.id')
      .innerJoin(Loan, 'loan', 'loan.leadId = lead.id')
      .leftJoin('lead.branch', 'branch')
      .leftJoin('lead.state', 'state')
      .leftJoin('lead.city', 'city')
      .leftJoin('lead.creditAssignedTo', 'creditManager')
      .where('lead.isDeleted = false')
      .select([
        'lead.id AS leadId',
        'lead.source AS source',
        'branch.name AS branchName',
        'customer.firstName AS customerFirstName',
        'customer.surName AS customerSurName',
        'customer.email AS email',
        'customer.mobile AS mobile',
        'customer.gender AS gender',
        'loan.loanNumber AS loanNumber',
        'cam.recommendedLoanAmount AS recommendedLoanAmount',
        'cam.roi AS roi',
        'cam.tenureDays AS tenureDays',
        'cam.repaymentDate AS repaymentDate',
        'cam.disbursalDate AS disbursalDate',
        'cam.repaymentAmount AS repaymentAmount',
        'lead.userType AS userType',
        'creditManager.name AS creditManagerName',
        'customer.currentAddressLine1 AS addressLine1',
        'state.name AS stateName',
        'city.name AS cityName',
        'customer.pincode AS pincode',
        'loan.principalOutstanding AS principalOutstanding',
        'loan.totalReceived AS totalReceived',
        'loan.totalOutstanding AS totalOutstanding',
      ]);
    this.applyDateRange(
      qb,
      'cam.repaymentDate',
      query,
      'fromDate',
      'toDate',
      false,
    );
    return qb.getRawMany();
  }

  /** export_id 30 — `ExportLoanPool`: loan pool export — disbursed,
   * active-lifecycle loans with cumulative collection-to-date figures.
   * Legacy computes 3 correlated-subquery collection sums (as-of a fixed
   * historical cutover date, after it, and as-of the report's `toDate`);
   * this schema doesn't track a payment-date-bucketed history the same
   * way, so this port returns the loan's current cumulative
   * `totalReceived` instead of the 3-way historical split — a real,
   * intentional simplification, not a missing feature to silently patch. */
  async loanPool(query: DateRangeQueryDto) {
    const qb = this.leadRepository
      .createQueryBuilder('lead')
      .innerJoin(LeadCustomer, 'customer', 'customer.leadId = lead.id')
      .innerJoin(CreditAnalysisMemo, 'cam', 'cam.leadId = lead.id')
      .innerJoin(Loan, 'loan', 'loan.leadId = lead.id')
      .where('lead.isDeleted = false')
      .andWhere('loan.status = :disbursed', { disbursed: 'DISBURSED' })
      .select([
        'lead.id AS leadId',
        'lead.createdAt AS leadCreatedAt',
        'lead.leadEntryDate AS leadEntryDate',
        'lead.source AS source',
        'loan.loanNumber AS loanNumber',
        'lead.userType AS userType',
        'lead.pancard AS pancard',
        'customer.firstName AS customerFirstName',
        'customer.surName AS customerSurName',
        'cam.recommendedLoanAmount AS sanctionLoanAmount',
        'cam.processingFeePercent AS sanctionProcessingFee',
        'cam.roi AS sanctionRoi',
        'cam.adminFee AS totalAdminFees',
        'cam.disbursalDate AS disbursalDate',
        'cam.repaymentDate AS repaymentDate',
        'cam.repaymentAmount AS repaymentAmount',
        'loan.totalReceived AS collectionAmountAsOnToDate',
      ])
      .orderBy('cam.disbursalDate', 'ASC');
    this.applyDateRange(
      qb,
      'cam.disbursalDate',
      query,
      'fromDate',
      'toDate',
      false,
    );
    return qb.getRawMany();
  }

  /** export_id 31 — `ExportFollowUp`: call/loan follow-up log — legacy
   * scopes this to `lcf_type_id=1` ("call" followups specifically); ported
   * as filtering `type.name` for a call-type followup rather than a
   * hardcoded legacy id. */
  async followUp(query: DateRangeQueryDto) {
    const qb = this.followupRepository
      .createQueryBuilder('followup')
      .innerJoin('followup.lead', 'lead')
      .innerJoin(Loan, 'loan', 'loan.leadId = lead.id')
      .innerJoin(CreditAnalysisMemo, 'cam', 'cam.leadId = lead.id')
      .innerJoin('followup.type', 'type')
      .leftJoin('followup.status', 'status')
      .leftJoin('followup.user', 'user')
      .where('followup.isDeleted = false')
      .select([
        'lead.id AS leadId',
        'loan.loanNumber AS loanNumber',
        'cam.repaymentDate AS repaymentDate',
        'type.name AS followupTypeName',
        'status.name AS followupStatusName',
        'followup.remarks AS remarks',
        'user.name AS userName',
        'followup.nextFollowupAt AS nextFollowupAt',
        'followup.createdAt AS createdAt',
      ]);
    this.applyDateRange(qb, 'followup.createdAt', query);
    return qb.getRawMany();
  }

  /** export_id 32 — `ExportRejectedPayments`: rejected payments. */
  async paymentRejected(query: DateRangeQueryDto) {
    const qb = this.collectionRepository
      .createQueryBuilder('collection')
      .leftJoin('collection.lead', 'lead')
      .leftJoin(LeadCustomer, 'customer', 'customer.leadId = lead.id')
      .leftJoin('lead.leadStatus', 'leadStatus')
      .leftJoin(
        MasterStatus,
        'repaymentType',
        'repaymentType.id = collection.repaymentTypeId',
      )
      .leftJoin('collection.collectionExecutive', 'uploadedBy')
      .leftJoin('collection.closedBy', 'closedBy')
      .where('collection.isDeleted = false')
      .andWhere('collection.verificationStatus = :rejected', {
        rejected: CollectionVerificationStatus.REJECTED,
      })
      .select([
        'collection.id AS leadId',
        'collection.receivedAmount AS receivedAmount',
        'leadStatus.name AS leadStatus',
        'customer.firstName AS customerFirstName',
        'customer.surName AS customerSurName',
        'customer.mobile AS mobile',
        'customer.email AS email',
        'uploadedBy.name AS uploadedByName',
        'collection.createdAt AS uploadedDate',
        'repaymentType.name AS executiveStatus',
        'closedBy.name AS closureName',
        'collection.closedAt AS closureUpdatedDate',
        'collection.receivedDate AS receivedDate',
        'collection.referenceNo AS referenceNo',
        'collection.remarks AS executiveRemarks',
        'collection.closureRemarks AS closureRemarks',
      ]);
    this.applyDateRange(qb, 'collection.closedAt', query);
    return qb.getRawMany();
  }

  /** export_id 35 — `ExportSuspenseRecoveryModel`: suspense-account
   * verified payments (paid but held in suspense pending closure), with
   * the day-gap between receipt and closure. */
  async suspenseVerified(query: DateRangeQueryDto) {
    const qb = this.collectionRepository
      .createQueryBuilder('collection')
      .leftJoin('collection.lead', 'lead')
      .leftJoin(LeadCustomer, 'customer', 'customer.leadId = lead.id')
      .leftJoin('collection.loan', 'loan')
      .leftJoin('lead.state', 'state')
      .leftJoin('lead.city', 'city')
      .leftJoin('lead.branch', 'branch')
      .leftJoin('collection.collectionExecutive', 'collector')
      .leftJoin('collection.closedBy', 'closer')
      .where('collection.isDeleted = false')
      .andWhere('collection.verificationStatus = :verified', {
        verified: CollectionVerificationStatus.APPROVED,
      })
      .andWhere('collection.receivedDate IS NOT NULL')
      .select([
        'collection.id AS leadId',
        'DATEDIFF(collection.closedAt, collection.receivedDate) AS suspenseDays',
        'customer.firstName AS customerFirstName',
        'customer.surName AS customerSurName',
        'loan.loanNumber AS loanNumber',
        'collection.receivedAmount AS receivedAmount',
        'collection.receivedDate AS receivedDate',
        'collector.name AS recoveryBy',
        'closer.name AS closureName',
        'collection.closedAt AS closedAt',
        'collection.referenceNo AS referenceNo',
        'collection.remarks AS remarks',
        'collection.closureRemarks AS closureRemarks',
        'state.name AS stateName',
        'city.name AS cityName',
        'branch.name AS branchName',
      ]);
    this.applyDateRange(qb, 'collection.closedAt', query);
    return qb.getRawMany();
  }

  /** export_id 38 — `ExportCollectionModel`: newer collection-report
   * variant, disbursed loans with a repayment date in range. */
  async newCollectionReport(query: DateRangeQueryDto) {
    const qb = this.leadRepository
      .createQueryBuilder('lead')
      .innerJoin(Loan, 'loan', 'loan.leadId = lead.id')
      .leftJoin(LeadCustomer, 'customer', 'customer.leadId = lead.id')
      .innerJoin(CreditAnalysisMemo, 'cam', 'cam.leadId = lead.id')
      .leftJoin('lead.leadStatus', 'leadStatus')
      .leftJoin('lead.branch', 'branch')
      .leftJoin('lead.city', 'city')
      .where('lead.isDeleted = false')
      .andWhere('loan.status = :disbursed', { disbursed: 'DISBURSED' })
      .select([
        'lead.id AS leadId',
        'branch.name AS branchName',
        'leadStatus.name AS currentStatus',
        'customer.firstName AS customerFirstName',
        'customer.surName AS customerSurName',
        'lead.userType AS userType',
        'lead.pancard AS pancard',
        'loan.loanNumber AS loanNumber',
        'customer.mobile AS mobile',
        'customer.email AS email',
        'cam.adminFee AS adminFee',
        'cam.roi AS roi',
        'cam.tenureDays AS tenureDays',
        'cam.repaymentAmount AS repaymentAmount',
        'cam.disbursalDate AS disbursalDate',
        'cam.repaymentDate AS repaymentDate',
        'city.name AS cityName',
        'loan.principalReceived AS principalReceived',
        'loan.principalOutstanding AS principalOutstanding',
        'loan.interestReceived AS interestReceived',
        'loan.penaltyReceived AS penaltyReceived',
        'loan.totalReceived AS totalReceived',
        'loan.totalOutstanding AS totalOutstanding',
        'loan.closedAt AS closedAt',
        'loan.settledAt AS settledAt',
      ]);
    this.applyDateRange(
      qb,
      'cam.repaymentDate',
      query,
      'fromDate',
      'toDate',
      false,
    );
    return qb.getRawMany();
  }

  /** export_id 44 — `ExportLegalNoticeSentLogModel`: legal notice send log.
   * **Real schema gap**: legacy's `loan_legal_notice_logs` table has no
   * equivalent entity in this schema at all — there is no dedicated
   * legal-notice-log entity yet. Built as a best-effort proxy using leads
   * with a rejection reason mentioning "legal" (case-insensitive), clearly
   * NOT equivalent to a real notice-send log — flagged in
   * REPORTING-QUESTIONS-FOR-CLIENT.md. A proper `LegalNoticeLog` entity
   * should be added in a future task once this is confirmed as still
   * needed. */
  async legalNoticeSentLog(query: DateRangeQueryDto) {
    const qb = this.leadRepository
      .createQueryBuilder('lead')
      .leftJoin(LeadCustomer, 'customer', 'customer.leadId = lead.id')
      .leftJoin('lead.rejectionReason', 'rejectionReason')
      .where('lead.isDeleted = false')
      .andWhere('LOWER(rejectionReason.reason) LIKE :legal', {
        legal: '%legal%',
      })
      .select([
        'lead.id AS leadId',
        'customer.firstName AS customerFirstName',
        'lead.pancard AS pancard',
        'rejectionReason.reason AS reason',
        'customer.mobile AS mobile',
      ]);
    this.applyDateRange(qb, 'lead.updatedAt', query);
    return qb.getRawMany();
  }

  private applyDateRange(
    qb: {
      andWhere: (cond: string, params?: Record<string, unknown>) => unknown;
    },
    column: string,
    query: DateRangeQueryDto,
    fromKey: keyof DateRangeQueryDto = 'fromDate',
    toKey: keyof DateRangeQueryDto = 'toDate',
    inclusiveDatetime = true,
  ): void {
    const from = query[fromKey];
    const to = query[toKey];
    if (from) {
      qb.andWhere(`${column} >= :from`, { from });
    }
    if (to) {
      qb.andWhere(inclusiveDatetime ? `${column} <= :to` : `${column} <= :to`, {
        to,
      });
    }
  }
}
