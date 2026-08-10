import {
  CreditAnalysisMemo,
  Lead,
  Loan,
  MasterStatus,
  State,
} from '@finance-crm/database';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, MoreThanOrEqual, type Repository } from 'typeorm';
import { DateRangeQueryDto } from '../../common/dto/date-range-query.dto';

/** Legacy `lead_status_id` values for a "closed out" loan (disbursed/closed/
 * settled/written-off/part-payment) — real production `master_statuses`
 * names confirmed in Task #41b's extraction: DISBURSED, CLOSED, SETTLED,
 * WRITEOFF, PART-PAYMENT (legacy ids 14/16/17/18/19). */
const CLOSED_OUT_STATUS_NAMES = [
  'DISBURSED',
  'CLOSED',
  'SETTLED',
  'WRITEOFF',
  'PART-PAYMENT',
];

@Injectable()
export class FinancialExportsService {
  constructor(
    @InjectRepository(Loan) private readonly loanRepository: Repository<Loan>,
    @InjectRepository(Lead) private readonly leadRepository: Repository<Lead>,
    @InjectRepository(CreditAnalysisMemo)
    private readonly camRepository: Repository<CreditAnalysisMemo>,
    @InjectRepository(MasterStatus)
    private readonly masterStatusRepository: Repository<MasterStatus>,
    @InjectRepository(State)
    private readonly stateRepository: Repository<State>,
  ) {}

  private async closedOutStatusIds(): Promise<number[]> {
    const statuses = await this.masterStatusRepository.find({
      where: { name: In(CLOSED_OUT_STATUS_NAMES) },
    });
    return statuses.map((s) => s.id);
  }

  /** Ports `ExportACReport` (`Export_Model.php:530`) — accounts report with
   * a computed GST split. Legacy hardcodes state_id=10 (Delhi, the
   * company's home state) for intra-state (CGST+SGST) vs inter-state
   * (IGST) GST; looked up here by name rather than assuming the seeded
   * numeric id matches legacy's. */
  async acReport(_query: DateRangeQueryDto) {
    const [statusIds, homeState] = await Promise.all([
      this.closedOutStatusIds(),
      this.stateRepository.findOne({ where: { name: 'Delhi' } }),
    ]);

    const loans = await this.loanRepository.find({
      where: { lead: { leadStatus: { id: In(statusIds) } } },
      relations: { lead: { state: true, city: true }, disbursementBank: true },
    });

    const camByLeadId = new Map(
      (
        await this.camRepository.find({
          where: { lead: { id: In(loans.map((l) => l.lead.id)) } },
          relations: { lead: true },
        })
      ).map((cam) => [cam.lead.id, cam]),
    );

    return loans.map((loan) => {
      const cam = camByLeadId.get(loan.lead.id);
      const adminFee = Number(cam?.adminFee ?? 0);
      const isHomeState = homeState
        ? loan.lead.state?.id === homeState.id
        : false;
      return {
        leadId: loan.lead.id,
        loanNumber: loan.loanNumber,
        status: loan.status,
        customerCity: loan.lead.city?.name ?? null,
        disbursementReferenceNo: loan.disbursementReferenceNo,
        adminFee,
        igst: isHomeState
          ? 0
          : Number((adminFee * 0.152542372881356).toFixed(2)),
        cgst: isHomeState
          ? Number((adminFee * 0.076271186440678).toFixed(2))
          : 0,
        sgst: isHomeState
          ? Number((adminFee * 0.076271186440678).toFixed(2))
          : 0,
        processingFee: Number((adminFee * 0.847457627).toFixed(2)),
        roi: cam?.roi ?? null,
        tenureDays: cam?.tenureDays ?? null,
        disbursalDate: cam?.disbursalDate ?? null,
        repaymentDate: cam?.repaymentDate ?? null,
      };
    });
  }

  /** Ports `ExportDashboardDataModel` (`Export_Model.php:1269`) — raw
   * dashboard-collection-data dump, filtered by CAM repayment_date. */
  async dashboardData(query: DateRangeQueryDto) {
    const statusIds = await this.closedOutStatusIds();
    const where: Record<string, unknown> = {
      lead: { leadStatus: { id: In(statusIds) } },
    };
    const camDateFilters: Record<string, unknown> = {};
    if (query.fromDate)
      camDateFilters.repaymentDateFrom = new Date(query.fromDate);
    if (query.toDate) camDateFilters.repaymentDateTo = new Date(query.toDate);

    const loans = await this.loanRepository.find({
      where,
      relations: { lead: { branch: true } },
    });
    const camRows = await this.camRepository.find({
      where: { lead: { id: In(loans.map((l) => l.lead.id)) } },
      relations: { lead: true, sanctionedBy: true },
    });
    const camByLeadId = new Map(
      camRows
        .filter((cam) => {
          if (!cam.repaymentDate) return false;
          const repaymentDate = new Date(cam.repaymentDate);
          if (
            camDateFilters.repaymentDateFrom &&
            repaymentDate < (camDateFilters.repaymentDateFrom as Date)
          ) {
            return false;
          }
          if (
            camDateFilters.repaymentDateTo &&
            repaymentDate > (camDateFilters.repaymentDateTo as Date)
          ) {
            return false;
          }
          return true;
        })
        .map((cam) => [cam.lead.id, cam]),
    );

    return loans
      .filter((loan) => camByLeadId.has(loan.lead.id))
      .map((loan) => {
        const cam = camByLeadId.get(loan.lead.id);
        return {
          leadId: loan.lead.id,
          loanNumber: loan.loanNumber,
          recommendedAmount: cam?.recommendedLoanAmount ?? null,
          repaymentAmount: cam?.repaymentAmount ?? null,
          totalReceived: loan.totalReceived,
          principalOutstanding: loan.principalOutstanding,
          totalOutstanding: loan.totalOutstanding,
          userType: loan.lead.userType,
          branchName: loan.lead.branch?.name ?? null,
          sanctionedBy: cam?.sanctionedBy?.name ?? null,
          disbursalDate: cam?.disbursalDate ?? null,
          repaymentDate: cam?.repaymentDate ?? null,
          roi: cam?.roi ?? null,
          tenureDays: cam?.tenureDays ?? null,
        };
      });
  }

  /** Ports `ExportAuditTatModel` (`Export_Model.php:1490`) — per-stage
   * turnaround time (credit / audit / disbursal), using this schema's
   * `Lead` assignment timestamps as the closest equivalent to legacy's
   * `lead_credit_assign_datetime` etc. columns. */
  async auditTatReport(query: DateRangeQueryDto) {
    const statusIds = await this.closedOutStatusIds();
    const where: Record<string, unknown> = {
      userType: 'NEW',
      leadStatus: { id: In(statusIds) },
    };
    if (query.fromDate)
      where.finalDisbursedAt = MoreThanOrEqual(new Date(query.fromDate));
    if (query.toDate)
      where.finalDisbursedAt = LessThanOrEqual(new Date(query.toDate));

    const leads = await this.leadRepository.find({
      where,
      relations: {
        creditAssignedTo: true,
        auditAssignedTo: true,
        disbursalAssignedTo: true,
      },
    });
    return leads.map((lead) => ({
      leadId: lead.id,
      applicationNo: lead.applicationNo,
      userType: lead.userType,
      creditAssignedTo: lead.creditAssignedTo?.name ?? null,
      creditAssignedAt: lead.creditAssignedAt,
      auditAssignedTo: lead.auditAssignedTo?.name ?? null,
      auditAssignedAt: lead.auditAssignedAt,
      disbursalAssignedTo: lead.disbursalAssignedTo?.name ?? null,
      disbursalAssignedAt: lead.disbursalAssignedAt,
      finalDisbursedAt: lead.finalDisbursedAt,
    }));
  }

  /** Ports `exportCSVReloanTatModel` (`Export_Model.php:1555`) — closed
   * (fully-repaid, non-blacklisted) leads eligible for a repeat loan. */
  async reloanTatReport() {
    const closedStatus = await this.masterStatusRepository.findOne({
      where: { name: 'CLOSED' },
    });
    if (!closedStatus) return [];
    const leads = await this.leadRepository.find({
      where: { leadStatus: { id: closedStatus.id }, isBlacklisted: false },
    });
    return leads.map((lead) => ({
      leadId: lead.id,
      applicationNo: lead.applicationNo,
      firstName: lead.firstName,
      pancard: lead.pancard,
      mobile: lead.mobile,
    }));
  }

  /** Ports `exportCSVLowConversionTatReportModel` /
   * `exportCSVHighConversionTatReportModel` (`Export_Model.php:1602`,
   * `:1636`) — per-screener lead-status funnel counts + disbursement %.
   * **Legacy quirk noted, not silently hidden**: both queries are
   * functionally identical in the live code today — each has a
   * commented-out `user_allocation_type_id` filter (1 vs 2) meant to
   * distinguish them, but since it's commented out, both currently
   * return the same result set. Implemented as two distinct endpoints
   * anyway (matching the two real permission ids), sharing this method. */
  async conversionTatReport(query: DateRangeQueryDto) {
    const qb = this.leadRepository
      .createQueryBuilder('lead')
      .leftJoin('lead.screenerAssignedTo', 'screener')
      .leftJoin('lead.leadStatus', 'leadStatus')
      .select('screener.id', 'screenerId')
      .addSelect('screener.name', 'screenerName')
      .addSelect('COUNT(lead.id)', 'totalLeads')
      .addSelect(
        "SUM(CASE WHEN leadStatus.name = 'DISBURSED' THEN 1 ELSE 0 END)",
        'disbursedCount',
      )
      .where('lead.userType = :userType', { userType: 'NEW' })
      .andWhere('lead.screenerAssignedTo IS NOT NULL')
      .groupBy('screener.id')
      .addGroupBy('screener.name');
    if (query.fromDate)
      qb.andWhere('lead.createdAt >= :fromDate', { fromDate: query.fromDate });
    if (query.toDate)
      qb.andWhere('lead.createdAt <= :toDate', { toDate: query.toDate });

    const rows = await qb.getRawMany<{
      screenerId: number;
      screenerName: string;
      totalLeads: string;
      disbursedCount: string;
    }>();
    return rows.map((row) => ({
      screenerId: row.screenerId,
      screenerName: row.screenerName,
      totalLeads: Number(row.totalLeads),
      disbursedCount: Number(row.disbursedCount),
      disbursementPercentage:
        Number(row.totalLeads) > 0
          ? Number(
              (
                (Number(row.disbursedCount) * 100) /
                Number(row.totalLeads)
              ).toFixed(2),
            )
          : 0,
    }));
  }

  /** `exportCSVCSVTally` is a stub in legacy (always "No Records Found"),
   * and its `master_export` row is itself marked deleted — inconsistent
   * with the export still being switched on. Rebuilt as a standard
   * Tally-compatible voucher-import CSV (date/ledger/debit/credit/
   * narration are Tally's conventional minimum import columns), reusing
   * the AC report's underlying data since it's the closest working
   * accounts-domain export. **Needs accounts-team sign-off** — see
   * REPORTING-QUESTIONS-FOR-CLIENT.md. */
  async tallyExport(query: DateRangeQueryDto) {
    const acRows = await this.acReport(query);
    return acRows.map((row) => ({
      voucherDate: row.disbursalDate ?? new Date().toISOString().slice(0, 10),
      ledgerName: `Loan ${row.loanNumber}`,
      debitAmount: row.adminFee,
      creditAmount: 0,
      narration: `Admin fee (incl. GST) for loan ${row.loanNumber}, lead ${row.leadId}`,
    }));
  }
}
