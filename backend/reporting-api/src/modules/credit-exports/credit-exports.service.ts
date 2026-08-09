import {
  BreCategory,
  BreRule,
  BreRuleResult,
  CreditAnalysisMemo,
  CustomerBanking,
  CustomerBlacklist,
  LeadCustomer,
  Loan,
} from '@finance-crm/database';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { DateRangeQueryDto } from '../../common/dto/date-range-query.dto';

/**
 * Ports `Export_Model.php`'s credit/sanction-domain CSV exports
 * (`ExportSanction`, `ExportApprovedSanction`, `ExportBRERulesResultModel`,
 * `ExportCibilReport`, `ExportBlackListed`, `ExportLoanWaived`). Every
 * query uses TypeORM `QueryBuilder` against the real rewritten entities
 * (same rationale as `CreditReportsService` — the pre-rewrite entities'
 * invented plural table names/columns this module's raw SQL originally
 * targeted don't exist in the real legacy schema).
 */
@Injectable()
export class CreditExportsService {
  constructor(
    @InjectRepository(Loan) private readonly loanRepository: Repository<Loan>,
    @InjectRepository(BreRuleResult)
    private readonly breRuleResultRepository: Repository<BreRuleResult>,
    @InjectRepository(CustomerBlacklist)
    private readonly customerBlacklistRepository: Repository<CustomerBlacklist>,
  ) {}

  /** export_id 5 — exportCSVTotalSanction (ExportSanction): sanctioned
   * loans, disbursal window, verified bank account required (legacy
   * `CB.account_status_id=1 AND CB.customer_banking_active=1`).
   * `CustomerBanking` has no verified/verified-at state in the real
   * schema (see `core-api`'s `VerificationService.verifyBanking()` doc
   * comment, docs/TODO.md) — the `account_status_id=1` half of legacy's
   * filter isn't reproducible, so this only applies the still-real
   * `customer_banking_active` half. */
  totalSanction(query: DateRangeQueryDto) {
    if (!query.fromDate || !query.toDate) return [];
    return this.loanRepository
      .createQueryBuilder('loan')
      .leftJoin('loan.lead', 'lead')
      .leftJoin(LeadCustomer, 'lc', 'lc.leadId = lead.id')
      .leftJoin(
        CustomerBanking,
        'cb',
        'cb.leadId = lead.id AND cb.isActive = true',
      )
      .leftJoin(CreditAnalysisMemo, 'cam', 'cam.leadId = lead.id')
      .leftJoin('lead.creditAssignedTo', 'credit')
      .leftJoin('lead.screenerAssignedTo', 'screener')
      .select('lead.id', 'leadId')
      .addSelect(
        "CONCAT_WS(' ', lc.firstName, lc.middleName, lc.surName)",
        'fullName',
      )
      .addSelect('cam.recommendedLoanAmount', 'recommendedLoanAmount')
      .addSelect('lead.userType', 'userType')
      .addSelect('lead.pancard', 'pancard')
      .addSelect('loan.loanNumber', 'loanNumber')
      .addSelect('cam.adminFee', 'adminFee')
      .addSelect('cam.roi', 'roi')
      .addSelect('cam.tenureDays', 'tenureDays')
      .addSelect('cam.repaymentAmount', 'repaymentAmount')
      .addSelect('cam.disbursalDate', 'disbursalDate')
      .addSelect('cam.repaymentDate', 'repaymentDate')
      .addSelect('cb.accountNumber', 'accountNumber')
      .addSelect('cb.bankName', 'bankName')
      .addSelect('cb.ifscCode', 'ifscCode')
      .addSelect('loan.status', 'status')
      .addSelect('lead.leadEntryDate', 'leadEntryDate')
      .addSelect('credit.name', 'creditExecutive')
      .addSelect('lead.creditAssignedAt', 'creditAssignedAt')
      .addSelect('screener.name', 'screenerExecutive')
      .addSelect('lead.finalDisbursedAt', 'finalDisbursedAt')
      .where('loan.status = :status', { status: 'DISBURSED' })
      .andWhere('cam.disbursalDate IS NOT NULL')
      .andWhere('cam.disbursalDate BETWEEN :fromDate AND :toDate', {
        fromDate: query.fromDate,
        toDate: query.toDate,
      })
      .getRawMany();
  }

  /** export_id 40 — exportCSVtotalApprovedSanction (ExportApprovedSanction):
   * same shape, filtered by credit-approval date rather than disbursal
   * date, no verified-bank-account requirement. */
  totalApprovedSanction(query: DateRangeQueryDto) {
    if (!query.fromDate || !query.toDate) return [];
    return this.loanRepository
      .createQueryBuilder('loan')
      .leftJoin('loan.lead', 'lead')
      .leftJoin(LeadCustomer, 'lc', 'lc.leadId = lead.id')
      .leftJoin(
        CustomerBanking,
        'cb',
        'cb.leadId = lead.id AND cb.isActive = true',
      )
      .leftJoin(CreditAnalysisMemo, 'cam', 'cam.leadId = lead.id')
      .leftJoin('lead.creditAssignedTo', 'credit')
      .leftJoin('lead.screenerAssignedTo', 'screener')
      .select('lead.id', 'leadId')
      .addSelect(
        "CONCAT_WS(' ', lc.firstName, lc.middleName, lc.surName)",
        'fullName',
      )
      .addSelect('cam.recommendedLoanAmount', 'recommendedLoanAmount')
      .addSelect('lead.userType', 'userType')
      .addSelect('lead.pancard', 'pancard')
      .addSelect('loan.loanNumber', 'loanNumber')
      .addSelect('cam.adminFee', 'adminFee')
      .addSelect('cam.roi', 'roi')
      .addSelect('cam.tenureDays', 'tenureDays')
      .addSelect('cam.repaymentAmount', 'repaymentAmount')
      .addSelect('cam.disbursalDate', 'disbursalDate')
      .addSelect('cam.repaymentDate', 'repaymentDate')
      .addSelect('cb.accountNumber', 'accountNumber')
      .addSelect('cb.bankName', 'bankName')
      .addSelect('cb.ifscCode', 'ifscCode')
      .addSelect('loan.status', 'status')
      .addSelect('lead.leadEntryDate', 'leadEntryDate')
      .addSelect('credit.name', 'creditExecutive')
      .addSelect('lead.creditAssignedAt', 'creditAssignedAt')
      .addSelect('lead.creditApprovedAt', 'creditApprovedAt')
      .addSelect('screener.name', 'screenerExecutive')
      .addSelect('lead.finalDisbursedAt', 'finalDisbursedAt')
      .addSelect('lead.utmSource', 'utmSource')
      .where('lead.creditApprovedAt IS NOT NULL')
      .andWhere('DATE(lead.creditApprovedAt) BETWEEN :fromDate AND :toDate', {
        fromDate: query.fromDate,
        toDate: query.toDate,
      })
      .getRawMany();
  }

  /** export_id 41 — exportCSVbrerulesresult (ExportBRERulesResultModel):
   * raw BRE evaluation results in the date range, joined to the rule's
   * category name. */
  breRulesResult(query: DateRangeQueryDto) {
    if (!query.fromDate || !query.toDate) return [];
    return this.breRuleResultRepository
      .createQueryBuilder('r')
      .innerJoin(BreRule, 'br', 'br.id = r.ruleId')
      .innerJoin(BreCategory, 'bc', 'bc.id = br.categoryId')
      .select('bc.name', 'categoryName')
      .addSelect('r.leadId', 'leadId')
      .addSelect('br.name', 'ruleName')
      .addSelect('r.cutoffValue', 'cutoffValue')
      .addSelect('r.actualValue', 'actualValue')
      .addSelect('r.systemDecision', 'systemDecision')
      .addSelect('r.manualDecision', 'manualDecision')
      .addSelect('r.manualDecisionRemarks', 'manualDecisionRemarks')
      .addSelect('r.createdAt', 'createdAt')
      .where('DATE(r.createdAt) BETWEEN :fromDate AND :toDate', {
        fromDate: query.fromDate,
        toDate: query.toDate,
      })
      .getRawMany();
  }

  /** export_id 16 — exportCibilReport (ExportCibilReport): disbursed-loan
   * customer/bureau data dump. Legacy filters `loan_bureau_report_flag !=
   * 2` (a bureau-report-suppression flag) — no equivalent field exists on
   * `Loan` in this schema yet, so that exclusion isn't applied here; noted
   * as a gap in docs/TODO.md rather than silently dropped or fabricated. */
  cibilReport(query: DateRangeQueryDto) {
    if (!query.toDate) return [];
    return this.loanRepository
      .createQueryBuilder('loan')
      .innerJoin('loan.lead', 'lead')
      .innerJoin(LeadCustomer, 'lc', 'lc.leadId = lead.id')
      .innerJoin(CreditAnalysisMemo, 'cam', 'cam.leadId = lead.id')
      .select('lead.id', 'leadId')
      .addSelect(
        "CONCAT_WS(' ', lc.firstName, lc.middleName, lc.surName)",
        'fullName',
      )
      .addSelect('lc.email', 'email')
      .addSelect('loan.loanNumber', 'loanNumber')
      .addSelect('cam.disbursalDate', 'disbursalDate')
      .addSelect('cam.recommendedLoanAmount', 'recommendedLoanAmount')
      .addSelect('cam.repaymentAmount', 'repaymentAmount')
      .addSelect('lc.pancard', 'pancard')
      .addSelect('lc.dob', 'dob')
      .addSelect('lc.gender', 'gender')
      .addSelect('lc.mobile', 'mobile')
      .addSelect('cam.repaymentDate', 'repaymentDate')
      .addSelect('cam.roi', 'roi')
      .where('loan.status = :status', { status: 'DISBURSED' })
      .andWhere('cam.disbursalDate IS NOT NULL')
      .andWhere('cam.disbursalDate <= :toDate', { toDate: query.toDate })
      .getRawMany();
  }

  /** export_id 20 — exportCSVBlackListed (ExportBlackListed): blacklisted
   * customers, by creation date range. `CustomerBlacklist` is a global
   * identity blacklist keyed on its own snapshot columns, not the
   * originating lead's live profile (see that entity's doc comment,
   * already relied on in `automation-worker`'s `reloan-pitch-email` job)
   * — this selects the blacklist row's own `firstName`/`mobile` snapshot
   * rather than joining back through `lead`, matching that precedent. */
  blacklisted(query: DateRangeQueryDto) {
    if (!query.fromDate || !query.toDate) return [];
    return this.customerBlacklistRepository
      .createQueryBuilder('b')
      .leftJoin('b.createdBy', 'u')
      .leftJoin('b.reason', 'r')
      .select('b.id', 'id')
      .addSelect('b.leadId', 'leadId')
      .addSelect('b.firstName', 'firstName')
      .addSelect('b.mobile', 'mobile')
      .addSelect('u.name', 'addedBy')
      .addSelect('b.createdAt', 'createdAt')
      .addSelect('r.name', 'reasonName')
      .addSelect('b.remarks', 'remarks')
      .where('b.isActive = :active', { active: true })
      .andWhere('DATE(b.createdAt) BETWEEN :fromDate AND :toDate', {
        fromDate: query.fromDate,
        toDate: query.toDate,
      })
      .orderBy('b.id', 'DESC')
      .getRawMany();
  }

  /** export_id 27 — exportCSVLoanWaived (ExportLoanWaived): loans in the
   * "DISBURSED-WAIVED" lifecycle stage (legacy `loan_status_id = 40`).
   * `Loan.status` (this schema's legacy free-string label) has no WAIVED
   * value in the values this codebase writes — legacy's `loan_status_id`
   * is really the `Lead.leadStatus` (`MasterStatus`) lifecycle stage, not
   * `Loan.status`, so this filters on `master_status.status_name =
   * 'DISBURSED-WAIVED'` (a real seeded row) via the lead instead. */
  loanWaived(query: DateRangeQueryDto) {
    if (!query.fromDate || !query.toDate) return [];
    return this.loanRepository
      .createQueryBuilder('loan')
      .leftJoin('loan.lead', 'lead')
      .leftJoin(LeadCustomer, 'lc', 'lc.leadId = lead.id')
      .leftJoin(CreditAnalysisMemo, 'cam', 'cam.leadId = lead.id')
      .leftJoin('lead.creditAssignedTo', 'credit')
      .innerJoin('lead.leadStatus', 'ms')
      .select('lead.id', 'leadId')
      .addSelect(
        "CONCAT_WS(' ', lc.firstName, lc.middleName, lc.surName)",
        'fullName',
      )
      .addSelect('cam.recommendedLoanAmount', 'recommendedLoanAmount')
      .addSelect('lead.userType', 'userType')
      .addSelect('lead.pancard', 'pancard')
      .addSelect('loan.loanNumber', 'loanNumber')
      .addSelect('cam.adminFee', 'adminFee')
      .addSelect('cam.roi', 'roi')
      .addSelect('cam.tenureDays', 'tenureDays')
      .addSelect('cam.repaymentAmount', 'repaymentAmount')
      .addSelect('cam.disbursalDate', 'disbursalDate')
      .addSelect('cam.repaymentDate', 'repaymentDate')
      .addSelect('ms.name', 'leadStatus')
      .addSelect('credit.name', 'creditExecutive')
      .addSelect('lead.creditAssignedAt', 'creditAssignedAt')
      .addSelect('lead.finalDisbursedAt', 'finalDisbursedAt')
      .where('ms.name = :status', { status: 'DISBURSED-WAIVED' })
      .andWhere('cam.disbursalDate IS NOT NULL')
      .andWhere('cam.disbursalDate BETWEEN :fromDate AND :toDate', {
        fromDate: query.fromDate,
        toDate: query.toDate,
      })
      .getRawMany();
  }
}
