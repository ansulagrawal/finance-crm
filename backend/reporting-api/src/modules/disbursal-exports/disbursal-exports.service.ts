import {
  CreditAnalysisMemo,
  CustomerBanking,
  Lead,
  LeadCustomer,
  Loan,
  MasterStatus,
} from '@finance-crm/database';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { DateRangeQueryDto } from '../../common/dto/date-range-query.dto';

const DISBURSED_LEAD_STATUS_NAMES = [
  'DISBURSED',
  'CLOSED',
  'SETTLED',
  'WRITEOFF',
  'PART-PAYMENT',
];

/**
 * GST split (from `ExportDibsursalAccountModel`/`ExportMasterDisbursalModel`):
 * intra-state (customer's state = company's home state) splits admin_fee
 * into CGST+SGST; inter-state uses IGST. Legacy hardcodes this by
 * `state_id = 10`. Our `states` table isn't guaranteed to preserve legacy's
 * numeric ids (same class of drift confirmed for `master_status` — see
 * docs/TODO.md), so this looks the home state up by name via
 * `COMPANY_HOME_STATE_NAME` rather than assuming id 10 carries over.
 * Defaults to 'Rajasthan' (Finance CRM's registered office state per legacy
 * company config) — flagged in docs/TODO.md for explicit confirmation
 * since it changes real tax-line output.
 */
const COMPANY_HOME_STATE_NAME =
  process.env.COMPANY_HOME_STATE_NAME ?? 'Rajasthan';

function gstSplit(adminFee: number | null, customerStateName: string | null) {
  const fee = Number(adminFee ?? 0);
  const isHomeState = customerStateName === COMPANY_HOME_STATE_NAME;
  return {
    igst: isHomeState ? 0 : fee * 0.152542372881356,
    cgst: isHomeState ? fee * 0.076271186440678 : 0,
    sgst: isHomeState ? fee * 0.076271186440678 : 0,
  };
}

/**
 * Ports `Export_Model.php`'s disbursal-domain CSV exports. Every raw
 * plural table-name string join ('lead_customers'/'loans'/
 * 'credit_analysis_memos'/'customer_bankings') from the pre-rewrite
 * version of this file has been switched to joining the real entity
 * classes directly (real tables are singular:
 * lead_customer/loan/credit_analysis_memo/customer_banking) — this also
 * makes every `alias.property` reference inside these joins' ON
 * conditions and select clauses translate to the real column names
 * automatically. `LoanStatus` (an enum that doesn't exist — `Loan.status`
 * is a legacy free-string label) is replaced with the `'DISBURSED'`
 * string constant, matching `core-api`'s `disbursal.service.ts`.
 * `Lead.leadStatusId` (no such scalar property exists, only the
 * `leadStatus` relation) is replaced with the relation property itself —
 * TypeORM translates a bare many-to-one relation compared directly into
 * its underlying join-column condition.
 */
@Injectable()
export class DisbursalExportsService {
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

  private baseDisbursedQuery(query: DateRangeQueryDto, statusIds: number[]) {
    const qb = this.leadRepository
      .createQueryBuilder('lead')
      .innerJoin('lead.leadStatus', 'leadStatus')
      .innerJoin(LeadCustomer, 'customer', 'customer.leadId = lead.id')
      .innerJoin(Loan, 'loan', 'loan.leadId = lead.id')
      .leftJoin(CreditAnalysisMemo, 'cam', 'cam.leadId = lead.id')
      .leftJoin(CustomerBanking, 'banking', 'banking.leadId = lead.id')
      .leftJoin('loan.disbursementBank', 'disbursementBank')
      .where('leadStatus.id IN (:...statusIds)', { statusIds });

    if (query.fromDate) {
      qb.andWhere('lead.finalDisbursedAt >= :fromDate', {
        fromDate: query.fromDate,
      });
    }
    if (query.toDate) {
      qb.andWhere('lead.finalDisbursedAt <= :toDate', { toDate: query.toDate });
    }
    return qb;
  }

  /** export_id 7 (`exportCSVLoanDisbursed`) — disbursed loan detail. */
  async loanDisbursed(query: DateRangeQueryDto) {
    const statusIds = await this.statusIdsFor(DISBURSED_LEAD_STATUS_NAMES);
    return this.baseDisbursedQuery(query, statusIds)
      .andWhere('loan.status = :loanStatus', { loanStatus: 'DISBURSED' })
      .select('lead.applicationNo', 'applicationNo')
      .addSelect('lead.firstName', 'leadName')
      .addSelect('lead.mobile', 'mobile')
      .addSelect('lead.email', 'email')
      .addSelect('loan.loanNumber', 'loanNumber')
      .addSelect('cam.recommendedLoanAmount', 'loanRecommended')
      .addSelect('cam.roi', 'roi')
      .addSelect('cam.tenureDays', 'tenureDays')
      .addSelect('cam.adminFee', 'adminFee')
      .addSelect('cam.repaymentAmount', 'repaymentAmount')
      .addSelect('cam.disbursalDate', 'disbursalDate')
      .addSelect('cam.repaymentDate', 'repaymentDate')
      .addSelect('lead.userType', 'userType')
      .addSelect('loan.paymentMode', 'paymentMode')
      .addSelect('loan.paymentType', 'paymentType')
      .addSelect('loan.disbursementReferenceNo', 'disbursementReferenceNo')
      .addSelect('banking.bankName', 'bankName')
      .addSelect('banking.accountNumber', 'accountNumber')
      .addSelect('banking.ifscCode', 'ifscCode')
      .addSelect('lead.finalDisbursedAt', 'finalDisbursedAt')
      .orderBy('lead.finalDisbursedAt', 'ASC')
      .getRawMany();
  }

  /**
   * export_id 8 (`exportCSVLoanPending`) — disbursal-pending loans in the
   * exact NEFT bank-file column layout the finance team's bank portal
   * expects (beneficiary name, account, IFSC, amount — no extra columns).
   * Legacy's version reads `fromDate`/`toDate` params but never applies
   * them in its WHERE clause (dead params); this port applies them for
   * real against `lead.disbursalApprovedAt`, noted as an intentional fix.
   */
  async loanPendingNeftFile(query: DateRangeQueryDto) {
    const statusIds = await this.statusIdsFor(['DISBURSE-PENDING']);
    const qb = this.leadRepository
      .createQueryBuilder('lead')
      .innerJoin('lead.leadStatus', 'leadStatus')
      .innerJoin(LeadCustomer, 'customer', 'customer.leadId = lead.id')
      .innerJoin(CreditAnalysisMemo, 'cam', 'cam.leadId = lead.id')
      .leftJoin(CustomerBanking, 'banking', 'banking.leadId = lead.id')
      .where('leadStatus.id IN (:...statusIds)', { statusIds });

    if (query.fromDate) {
      qb.andWhere('lead.disbursalApprovedAt >= :fromDate', {
        fromDate: query.fromDate,
      });
    }
    if (query.toDate) {
      qb.andWhere('lead.disbursalApprovedAt <= :toDate', {
        toDate: query.toDate,
      });
    }

    return qb
      .select('banking.beneficiaryName', 'beneficiaryName')
      .addSelect('banking.accountNumber', 'accountNumber')
      .addSelect('banking.ifscCode', 'ifscCode')
      .addSelect('banking.bankName', 'bankName')
      .addSelect('cam.netDisbursalAmount', 'amount')
      .addSelect('lead.applicationNo', 'applicationNo')
      .orderBy('lead.disbursalApprovedAt', 'ASC')
      .getRawMany();
  }

  /** export_id 18 (`exportCSVLoanDisbursedSendback`) — leads in the
   * DISBURSAL-SEND-BACK stage (looked up by name — see MasterStatus
   * numbering gotcha in docs/TODO.md, this is NOT the legacy id 37). */
  async loanDisbursedSendback(query: DateRangeQueryDto) {
    const statusIds = await this.statusIdsFor(['DISBURSAL-SEND-BACK']);
    return this.sendbackOrHoldQuery(query, statusIds);
  }

  /** export_id 19 (`exportCSVLoanDisbursedHold`) — leads in the
   * DISBURSAL-HOLD stage (name lookup — NOT legacy id 35). */
  async loanDisbursedHold(query: DateRangeQueryDto) {
    const statusIds = await this.statusIdsFor(['DISBURSAL-HOLD']);
    return this.sendbackOrHoldQuery(query, statusIds);
  }

  private sendbackOrHoldQuery(query: DateRangeQueryDto, statusIds: number[]) {
    const qb = this.leadRepository
      .createQueryBuilder('lead')
      .innerJoin('lead.leadStatus', 'leadStatus')
      .innerJoin(LeadCustomer, 'customer', 'customer.leadId = lead.id')
      .leftJoin(CreditAnalysisMemo, 'cam', 'cam.leadId = lead.id')
      .where('leadStatus.id IN (:...statusIds)', { statusIds });

    if (query.fromDate) {
      qb.andWhere('lead.disbursalAssignedAt >= :fromDate', {
        fromDate: query.fromDate,
      });
    }
    if (query.toDate) {
      qb.andWhere('lead.disbursalAssignedAt <= :toDate', {
        toDate: query.toDate,
      });
    }

    return qb
      .select('lead.applicationNo', 'applicationNo')
      .addSelect('lead.firstName', 'leadName')
      .addSelect('lead.mobile', 'mobile')
      .addSelect('cam.recommendedLoanAmount', 'loanRecommended')
      .addSelect('leadStatus.name', 'status')
      .addSelect('lead.disbursalAssignedAt', 'disbursalAssignedAt')
      .orderBy('lead.disbursalAssignedAt', 'DESC')
      .getRawMany();
  }

  /** export_id 37 (`exportCSVNewLoanDisbursed`) — disbursed loans, NEW
   * user-type only. */
  async newLoanDisbursed(query: DateRangeQueryDto) {
    const statusIds = await this.statusIdsFor(DISBURSED_LEAD_STATUS_NAMES);
    return this.baseDisbursedQuery(query, statusIds)
      .andWhere('loan.status = :loanStatus', { loanStatus: 'DISBURSED' })
      .andWhere("lead.userType = 'NEW'")
      .select('lead.applicationNo', 'applicationNo')
      .addSelect('lead.firstName', 'leadName')
      .addSelect('lead.mobile', 'mobile')
      .addSelect('loan.loanNumber', 'loanNumber')
      .addSelect('cam.recommendedLoanAmount', 'loanRecommended')
      .addSelect('cam.disbursalDate', 'disbursalDate')
      .addSelect('banking.bankName', 'bankName')
      .addSelect('banking.accountNumber', 'accountNumber')
      .orderBy('lead.finalDisbursedAt', 'ASC')
      .getRawMany();
  }

  /**
   * export_id 39 (`exportCSVLoanDumpReport`) — best-effort full-entity
   * dump. Legacy's original is a ~150+ column dump including fields with
   * no equivalent in the current simplified schema (OCR sub-statuses,
   * AA-specific address fields, individual salary-credit instances,
   * geo-coordinates, IP tracking) — those are not portable and are
   * omitted rather than faked. Includes every field that does exist on
   * current entities; gap flagged in docs/TODO.md.
   */
  async loanDumpReport(query: DateRangeQueryDto) {
    const qb = this.leadRepository
      .createQueryBuilder('lead')
      .leftJoin('lead.leadStatus', 'leadStatus')
      .leftJoin(LeadCustomer, 'customer', 'customer.leadId = lead.id')
      .leftJoin(CreditAnalysisMemo, 'cam', 'cam.leadId = lead.id')
      .leftJoin(Loan, 'loan', 'loan.leadId = lead.id')
      .leftJoin(CustomerBanking, 'banking', 'banking.leadId = lead.id');

    if (query.fromDate) {
      qb.andWhere('lead.createdAt >= :fromDate', { fromDate: query.fromDate });
    }
    if (query.toDate) {
      qb.andWhere('lead.createdAt <= :toDate', { toDate: query.toDate });
    }

    return qb
      .select('lead.applicationNo', 'applicationNo')
      .addSelect('lead.leadReferenceNo', 'leadReferenceNo')
      .addSelect('customer.firstName', 'firstName')
      .addSelect('customer.middleName', 'middleName')
      .addSelect('customer.surName', 'surName')
      .addSelect('customer.fatherName', 'fatherName')
      .addSelect('customer.gender', 'gender')
      .addSelect('customer.dob', 'dob')
      .addSelect('customer.mobile', 'mobile')
      .addSelect('customer.email', 'email')
      .addSelect('customer.pancard', 'pancard')
      .addSelect('customer.aadhaarNumber', 'aadhaarNumber')
      .addSelect('customer.currentAddressLine1', 'currentAddressLine1')
      .addSelect('customer.currentAddressLine2', 'currentAddressLine2')
      .addSelect('customer.pincode', 'pincode')
      .addSelect('lead.userType', 'userType')
      .addSelect('leadStatus.name', 'status')
      .addSelect('cam.recommendedLoanAmount', 'loanRecommended')
      .addSelect('cam.roi', 'roi')
      .addSelect('cam.tenureDays', 'tenureDays')
      .addSelect('cam.adminFee', 'adminFee')
      .addSelect('cam.disbursalDate', 'disbursalDate')
      .addSelect('cam.repaymentDate', 'repaymentDate')
      .addSelect('loan.loanNumber', 'loanNumber')
      .addSelect('loan.status', 'loanStatus')
      .addSelect('loan.totalReceived', 'totalReceived')
      .addSelect('loan.totalOutstanding', 'totalOutstanding')
      .addSelect('banking.bankName', 'bankName')
      .addSelect('banking.accountNumber', 'accountNumber')
      .addSelect('banking.ifscCode', 'ifscCode')
      .addSelect('lead.createdAt', 'createdAt')
      .addSelect('lead.finalDisbursedAt', 'finalDisbursedAt')
      .orderBy('lead.createdAt', 'ASC')
      .getRawMany();
  }

  /** export_id 45 (`exportCSVMasterDisbursalReport`) — disbursal detail
   * with GST split columns. */
  async masterDisbursalReport(query: DateRangeQueryDto) {
    const statusIds = await this.statusIdsFor(DISBURSED_LEAD_STATUS_NAMES);
    const rows = await this.baseDisbursedQuery(query, statusIds)
      .andWhere('loan.status = :loanStatus', { loanStatus: 'DISBURSED' })
      .leftJoin('customer.state', 'customerState')
      .select('lead.applicationNo', 'applicationNo')
      .addSelect('lead.firstName', 'leadName')
      .addSelect('loan.loanNumber', 'loanNumber')
      .addSelect('cam.adminFee', 'adminFee')
      .addSelect('cam.disbursalDate', 'disbursalDate')
      .addSelect('customerState.name', 'stateName')
      .addSelect('disbursementBank.accountNumber', 'companyAccountNumber')
      .getRawMany<{
        applicationNo: string;
        leadName: string;
        loanNumber: string;
        adminFee: string;
        disbursalDate: Date;
        stateName: string | null;
        companyAccountNumber: string | null;
      }>();

    return rows.map((row) => ({
      ...row,
      ...gstSplit(Number(row.adminFee), row.stateName),
    }));
  }

  /** export_id 46 (`exportCSVDisbursalAccountReport`) — disbursal
   * account/finance view with GST split columns. */
  async disbursalAccountReport(query: DateRangeQueryDto) {
    const statusIds = await this.statusIdsFor(DISBURSED_LEAD_STATUS_NAMES);
    const rows = await this.baseDisbursedQuery(query, statusIds)
      .andWhere('loan.status = :loanStatus', { loanStatus: 'DISBURSED' })
      .leftJoin('customer.state', 'customerState')
      .select('lead.applicationNo', 'applicationNo')
      .addSelect('loan.loanNumber', 'loanNumber')
      .addSelect('cam.netDisbursalAmount', 'netDisbursalAmount')
      .addSelect('cam.adminFee', 'adminFee')
      .addSelect('cam.disbursalDate', 'disbursalDate')
      .addSelect('customerState.name', 'stateName')
      .addSelect('disbursementBank.accountNumber', 'companyAccountNumber')
      .addSelect('loan.disbursementReferenceNo', 'disbursementReferenceNo')
      .getRawMany<{
        applicationNo: string;
        loanNumber: string;
        netDisbursalAmount: string;
        adminFee: string;
        disbursalDate: Date;
        stateName: string | null;
        companyAccountNumber: string | null;
        disbursementReferenceNo: string | null;
      }>();

    return rows.map((row) => ({
      ...row,
      ...gstSplit(Number(row.adminFee), row.stateName),
    }));
  }

  /**
   * export_id 48 (`exportClosedLoan`) — the final CLOSED loan per
   * customer (by PAN), excluding any PAN that also has a lead in one of
   * the other "still active-ish" statuses (DISBURSED/SETTLED/WRITEOFF/
   * PART-PAYMENT). Legacy does this via `MAX(lead_id)` grouped by pancard
   * among CLOSED leads, with a NOT EXISTS-equivalent filter against the
   * other statuses; reproduced here with a subquery instead of a
   * correlated string-built one.
   */
  async closedLoan(query: DateRangeQueryDto) {
    const [closedStatusIds, activeStatusIds] = await Promise.all([
      this.statusIdsFor(['CLOSED']),
      this.statusIdsFor(['DISBURSED', 'SETTLED', 'WRITEOFF', 'PART-PAYMENT']),
    ]);

    const activePancardsSubQuery = this.leadRepository
      .createQueryBuilder('activeLead')
      .select('activeLead.pancard')
      .where('activeLead.leadStatus IN (:...activeStatusIds)', {
        activeStatusIds,
      });

    const latestClosedIdSubQuery = this.leadRepository
      .createQueryBuilder('closedLead')
      .select('MAX(closedLead.id)', 'maxId')
      .where('closedLead.leadStatus IN (:...closedStatusIds)', {
        closedStatusIds,
      })
      .groupBy('closedLead.pancard');

    const qb = this.leadRepository
      .createQueryBuilder('lead')
      .innerJoin(LeadCustomer, 'customer', 'customer.leadId = lead.id')
      .innerJoin(Loan, 'loan', 'loan.leadId = lead.id')
      .leftJoin(CreditAnalysisMemo, 'cam', 'cam.leadId = lead.id')
      .where(`lead.id IN (${latestClosedIdSubQuery.getQuery()})`)
      .andWhere(`lead.pancard NOT IN (${activePancardsSubQuery.getQuery()})`)
      .setParameters({
        ...latestClosedIdSubQuery.getParameters(),
        ...activePancardsSubQuery.getParameters(),
      });

    if (query.fromDate) {
      qb.andWhere('loan.closedAt >= :fromDate', { fromDate: query.fromDate });
    }
    if (query.toDate) {
      qb.andWhere('loan.closedAt <= :toDate', { toDate: query.toDate });
    }

    return qb
      .select('lead.applicationNo', 'applicationNo')
      .addSelect('lead.firstName', 'leadName')
      .addSelect('lead.pancard', 'pancard')
      .addSelect('loan.loanNumber', 'loanNumber')
      .addSelect('cam.recommendedLoanAmount', 'loanRecommended')
      .addSelect('cam.repaymentDate', 'repaymentDate')
      .addSelect('loan.closedAt', 'loanClosureDate')
      .addSelect('TIMESTAMPDIFF(DAY, cam.repaymentDate, loan.closedAt)', 'dpd')
      .orderBy('loan.closedAt', 'DESC')
      .getRawMany();
  }
}
