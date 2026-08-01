import { findOrFail } from '@finance-crm/common';
import {
  CreditAnalysisMemo,
  IncomeType,
  Lead,
  LeadCustomer,
  LeadEmployment,
  LeadFollowup,
  LeadUserType,
  Loan,
  MasterStatus,
  RejectionReason,
} from '@finance-crm/database';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Not, type Repository } from 'typeorm';
import { CustomerBlacklistCheckService } from '../collection/customer-blacklist-check.service';

export interface EligibilityCheckResult {
  eligible: boolean;
  remarks: string[];
  rejectionReasonText: string | null;
}

const MIN_AGE = 21;
const MAX_AGE = 54;
const MIN_SALARY = 30000;
const MAX_DPD = 15;
const REJECTED_STREAK_THRESHOLD = 5;
/** Legacy excludes rejection reason ids 1/15/29/52 (`tbl_rejection_master`
 * — confirmed via the legacy UAT dump: "DUPLICATE LEAD", "TEST LEAD" (two
 * rows share this text), "IMPORT LEAD DIRECT REJECT") from the "5 recent
 * rejects" streak — they're test/dedupe-type reasons, not real
 * eligibility fails, so they shouldn't compound against a customer. */
const REJECTED_STREAK_EXCLUDED_REASONS = [
  'DUPLICATE LEAD',
  'TEST LEAD',
  'IMPORT LEAD DIRECT REJECT',
];
/** Legacy's DPD lookback only considers a lead's most recent loan in one of
 * these terminal/near-terminal stages. */
const DPD_ELIGIBLE_STATUS_NAMES = [
  'DISBURSED',
  'CLOSED',
  'SETTLED',
  'WRITEOFF',
  'PART-PAYMENT',
];

/**
 * Ports `check_customer_eligibility()` (`aip_engine/check_eligibility.php`)
 * — legacy's lightweight pre-screen gate, distinct from the full 26-rule
 * `bre_rule_engine()` (see `BreEvaluationService`). Auto-rejects a lead to
 * `SYSTEM-REJECT`/S8 the first time this fails; callable repeatedly as more
 * data becomes available (legacy called it from CSV import, cron, and the
 * Task API — this port exposes it the same way: `LeadImportService` calls
 * it right after each row is created, and `POST /leads/:id/check-eligibility`
 * lets it be re-run later).
 *
 * Faithfully ports two real legacy quirks rather than "fixing" them:
 * - Every check runs (no short-circuit); `rejectionReasonText` ends up
 *   holding whichever check **fails last** in this method's fixed
 *   evaluation order, since legacy's `$rejection_id` is reused with no
 *   reset between checks.
 * - The DPD check is evaluated last and unconditionally, so if it fails it
 *   always wins as the recorded reason even if earlier checks also failed.
 *
 * Deviations, documented not fabricated:
 * - The "5 consecutive most-recent rejects" streak (checkCustomerRejected)
 *   walks matches ordered by id DESC and stops counting at the first
 *   non-matching row (a contiguous-streak check, not a lifetime total) —
 *   ported exactly.
 * - `checkCustomerDedupe` (same PAN/mobile/email already applied *today*)
 *   IS ported (`hasSameDayDuplicate`) — a prior pass here mistakenly
 *   attributed this check to the same dead `$settlementData` variable that
 *   actually belongs to the separate, genuinely-dead "Loan Active: Loan is
 *   Settled" check (its own data-fetch is what's commented out); confirmed
 *   by reading `checkCustomerDedupe`'s body directly, and its live caller
 *   chain `check_eligibility.php` -> `run_eligibility()` ->
 *   `CronSanctionController.php`'s automated-sanction cron. Legacy gates it
 *   on `COMP_ENVIRONMENT == 'production'`; not replicated here since this
 *   codebase has no equivalent environment flag and, like the whitelist
 *   bypass below, that gate reads as a UAT-testing convenience rather than
 *   a real business rule.
 * - The settlement-data check ("Loan Active: Loan is Settled") is **not
 *   ported**: it references an undefined `$settlementData` variable in
 *   legacy (dead code — its data-fetch call is commented out) and never
 *   actually rejects anyone.
 * - Legacy's hardcoded QA mobile-number whitelist bypass is not ported.
 */
@Injectable()
export class LeadEligibilityService {
  private readonly logger = new Logger(LeadEligibilityService.name);

  constructor(
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(LeadCustomer)
    private readonly leadCustomerRepository: Repository<LeadCustomer>,
    @InjectRepository(LeadEmployment)
    private readonly leadEmploymentRepository: Repository<LeadEmployment>,
    @InjectRepository(RejectionReason)
    private readonly rejectionReasonRepository: Repository<RejectionReason>,
    @InjectRepository(MasterStatus)
    private readonly masterStatusRepository: Repository<MasterStatus>,
    @InjectRepository(LeadFollowup)
    private readonly leadFollowupRepository: Repository<LeadFollowup>,
    @InjectRepository(Loan)
    private readonly loanRepository: Repository<Loan>,
    @InjectRepository(CreditAnalysisMemo)
    private readonly camRepository: Repository<CreditAnalysisMemo>,
    private readonly blacklistCheck: CustomerBlacklistCheckService,
  ) {}

  async evaluate(leadId: number): Promise<EligibilityCheckResult> {
    await findOrFail(this.leadRepository, leadId, 'Lead');
    const lead = (await this.leadRepository.findOne({
      where: { id: leadId },
      relations: { state: true, city: true },
    })) as Lead;
    const [customer, employment] = await Promise.all([
      this.leadCustomerRepository.findOne({ where: { lead: { id: leadId } } }),
      this.leadEmploymentRepository.findOne({
        where: { lead: { id: leadId } },
      }),
    ]);

    const remarks: string[] = [];
    let eligible = true;
    let rejectionReasonText: string | null = null;

    const fail = (remark: string, reasonText: string) => {
      eligible = false;
      rejectionReasonText = reasonText;
      remarks.push(remark);
    };

    if (employment?.incomeType === IncomeType.SALARIED) {
      remarks.push('Employment Type: Salaried | Status: Pass');
    } else if (employment?.incomeType === IncomeType.SELF_EMPLOYED) {
      fail('Employment Type: Self-Employed | Status: Fail', 'SELF EMPLOYED');
    } else {
      remarks.push('Employment Type: Not available | Status: NA');
    }

    if (employment?.salaryMode === 'BANK') {
      remarks.push('Salary Mode: Bank | Status: Pass');
    } else if (employment?.salaryMode) {
      fail('Salary Mode: Cash | Status: Fail', 'NE: SALARY CASH/ NOT RECEIVED');
    } else {
      remarks.push('Salary Mode: Not available | Status: NA');
    }

    const salary = lead.monthlySalaryAmount ?? 0;
    if (salary >= MIN_SALARY || lead.userType === LeadUserType.REPEAT) {
      remarks.push(`Monthly Salary: ${salary} | Status: Pass`);
    } else {
      fail(`Monthly Salary: ${salary} | Status: Fail`, 'NE: SALARY LOW');
    }

    const dob = customer?.dob;
    if (dob) {
      const age = this.ageInYears(new Date(dob));
      if (age >= MIN_AGE && age <= MAX_AGE) {
        remarks.push(`DOB: ${dob} | Age: ${age} | Status: Pass`);
      } else {
        fail(
          `DOB: ${dob} | Age: ${age} | Status: Fail`,
          'INTERNAL CRITERIA DO NOT MATCH',
        );
      }
    } else {
      remarks.push('DOB: Not available | Status: NA');
    }

    if (lead.state) {
      if (lead.state.isSourcing) {
        remarks.push(`State: ${lead.state.name} | Status: Pass`);
      } else {
        fail(
          `State: ${lead.state.name} | Status: Fail`,
          'OUTSIDE GEO LIMITS (OGL)',
        );
      }
    } else {
      remarks.push('State: Not available | Status: NA');
    }

    if (lead.city) {
      if (lead.city.isSourcing) {
        remarks.push(`City: ${lead.city.name} | Status: Pass`);
      } else {
        fail(
          `City: ${lead.city.name} | Status: Fail`,
          'OUTSIDE GEO LIMITS (OGL)',
        );
      }
    } else {
      remarks.push('City: Not available | Status: NA');
    }

    const isBlacklisted = await this.blacklistCheck.isBlacklisted({
      firstName: customer?.firstName,
      dob: customer?.dob,
      pancard: lead.pancard,
      mobile: lead.mobile,
      alternateMobile: customer?.alternateMobile,
      email: lead.email,
      alternateEmail: customer?.alternateEmail,
    });
    if (isBlacklisted) {
      fail('Blacklisted: Match found | Status: Fail', 'BLACK LISTED CUSTOMER');
    } else {
      remarks.push('Blacklisted: Not available | Status: Pass');
    }

    const rejectedStreak = await this.hasRecentRejectStreak(lead);
    if (rejectedStreak) {
      fail(
        'Rejected Customer: Applied more than 5 times and rejected | Status: Fail',
        'DUPLICATE LEAD',
      );
    } else {
      remarks.push('Rejected Customer: Not available | Status: Pass');
    }

    const isSameDayDuplicate = await this.hasSameDayDuplicate(lead);
    if (isSameDayDuplicate) {
      fail(
        'Duplicate Customer: Already applied today | Status: Fail',
        'DUPLICATE LEAD',
      );
    } else {
      remarks.push('Duplicate Customer: Not available | Status: Pass');
    }

    const dpd = await this.getMostRecentDpd(lead.pancard);
    if (dpd !== null && dpd > MAX_DPD) {
      fail(
        `Loan DPD: ${dpd} | Status: Fail`,
        'NOT ELIGIBLE - RECENT 30+ DPD IN PL',
      );
    }

    if (!eligible && rejectionReasonText) {
      await this.reject(lead, remarks, rejectionReasonText);
    }

    return { eligible, remarks, rejectionReasonText };
  }

  private async reject(
    lead: Lead,
    remarks: string[],
    reasonText: string,
  ): Promise<void> {
    const [status, reason] = await Promise.all([
      this.masterStatusRepository.findOne({
        where: { name: 'SYSTEM-REJECT' },
      }),
      this.rejectionReasonRepository.findOne({
        where: { reason: reasonText },
      }),
    ]);
    if (!status) {
      this.logger.error(
        `checkEligibility: missing required 'SYSTEM-REJECT' master_statuses row`,
      );
      return;
    }

    lead.leadStatus = status;
    lead.rejectionReason = reason ?? null;
    lead.rejectedAt = new Date();
    lead.rejectedBy = null;
    await this.leadRepository.save(lead);

    const now = new Date();
    await this.leadFollowupRepository.save(
      this.leadFollowupRepository.create({
        lead,
        user: null,
        status,
        remarks: `Eligibility Rules\n${remarks.join('\n')}`,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  private ageInYears(dob: Date): number {
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const monthDiff = now.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
      age -= 1;
    }
    return age;
  }

  private async hasRecentRejectStreak(lead: Lead): Promise<boolean> {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const identityWhere: Array<Record<string, unknown>> = [];
    if (lead.pancard) identityWhere.push({ pancard: lead.pancard });
    if (lead.mobile) identityWhere.push({ mobile: lead.mobile });
    if (lead.email) identityWhere.push({ email: lead.email });
    if (identityWhere.length === 0) return false;

    const rejectStatus = await this.masterStatusRepository.findOne({
      where: { name: 'REJECT' },
    });
    if (!rejectStatus) return false;

    const candidates = await this.leadRepository.find({
      where: identityWhere.map((clause) => ({
        ...clause,
        isActive: true,
        isDeleted: false,
        // Legacy filters `lead_entry_date`, not the row's insert timestamp.
        leadEntryDate: MoreThanOrEqual(threeMonthsAgo),
      })),
      relations: { leadStatus: true, rejectionReason: true },
      order: { id: 'DESC' },
    });

    let streak = 0;
    for (const candidate of candidates) {
      if (candidate.id === lead.id) continue;
      const isReject = candidate.leadStatus?.id === rejectStatus.id;
      const excluded =
        candidate.rejectionReason &&
        REJECTED_STREAK_EXCLUDED_REASONS.includes(
          candidate.rejectionReason.reason,
        );
      if (isReject && !excluded) {
        streak += 1;
      } else {
        break;
      }
    }
    return streak >= REJECTED_STREAK_THRESHOLD;
  }

  /** Ports `checkCustomerDedupe()` — same PAN/mobile/email already applied
   * today (exact-day match on `lead_entry_date`, not a rolling window). */
  private async hasSameDayDuplicate(lead: Lead): Promise<boolean> {
    const identityWhere: Array<Record<string, unknown>> = [];
    if (lead.pancard) identityWhere.push({ pancard: lead.pancard });
    if (lead.mobile) identityWhere.push({ mobile: lead.mobile });
    if (lead.email) identityWhere.push({ email: lead.email });
    if (identityWhere.length === 0) return false;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const count = await this.leadRepository.count({
      where: identityWhere.map((clause) => ({
        ...clause,
        id: Not(lead.id),
        isActive: true,
        isDeleted: false,
        leadEntryDate: today,
      })),
    });
    return count > 0;
  }

  private async getMostRecentDpd(
    pancard: string | null,
  ): Promise<number | null> {
    if (!pancard) return null;

    const statuses = await this.masterStatusRepository.find({
      where: { name: In(DPD_ELIGIBLE_STATUS_NAMES) },
    });
    if (statuses.length === 0) return null;

    const loan = await this.loanRepository.findOne({
      where: {
        lead: { pancard, leadStatus: { id: In(statuses.map((s) => s.id)) } },
      },
      relations: { lead: true },
      order: { id: 'DESC' },
    });
    if (!loan) return null;

    const cam = await this.camRepository.findOne({
      where: { lead: { id: loan.lead.id } },
    });
    if (!cam?.repaymentDate) return null;

    const endDate =
      loan.closedAt ?? loan.settledAt ?? loan.writtenOffAt ?? new Date();
    const diffMs =
      new Date(endDate).getTime() - new Date(cam.repaymentDate).getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  }
}
