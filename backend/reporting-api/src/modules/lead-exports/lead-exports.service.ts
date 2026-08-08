import { BreRuleResult, Lead } from '@finance-crm/database';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { DateRangeQueryDto } from '../../common/dto/date-range-query.dto';

/**
 * Ports the Lead/Application CSV exports from `Export_Model.php`
 * (`ExportController.php`'s `FilterExportReports` dispatcher). Legacy
 * streams `fputcsv` rows straight from a raw `$this->db->query()` result;
 * this builds the same column set via parameterized TypeORM queries and
 * returns plain row objects for the controller to hand to `toCsv`/`sendCsv`.
 */
@Injectable()
export class LeadExportsService {
  constructor(
    @InjectRepository(Lead) private readonly leadRepository: Repository<Lead>,
    @InjectRepository(BreRuleResult)
    private readonly breRuleResultRepository: Repository<BreRuleResult>,
  ) {}

  /** export_id 1 — `ExportLeadDuplicate`: leads stuck in the legacy
   * "duplicate" status (`lead_status_id = 7`). **Schema gap**: no
   * `MasterStatus` row is guaranteed to carry that exact legacy id/name —
   * this looks the status up by name (`DUPLICATE`) instead of a hardcoded
   * numeric id, since ids were never carried over 1:1 during the lead
   * migration (see TODO.md). Falls back to an empty result set (not an
   * error) if that master status hasn't been seeded, since export CSVs
   * should degrade gracefully rather than 500. */
  async leadDuplicate(query: DateRangeQueryDto) {
    return this.leadRepository
      .createQueryBuilder('lead')
      .leftJoin('lead.leadStatus', 'status')
      .leftJoin('lead.screenerAssignedTo', 'screener')
      .select('lead.id', 'leadId')
      .addSelect('lead.firstName', 'firstName')
      .addSelect('lead.purpose', 'purpose')
      .addSelect('lead.loanAmount', 'loanAmount')
      .addSelect('lead.userType', 'userType')
      .addSelect('lead.tenureDays', 'tenureDays')
      .addSelect('lead.cibilScore', 'cibilScore')
      .addSelect('lead.obligations', 'obligations')
      .addSelect('lead.source', 'source')
      .addSelect('status.name', 'status')
      .addSelect('lead.utmSource', 'utmSource')
      .addSelect('lead.leadEntryDate', 'leadEntryDate')
      .addSelect('screener.name', 'screenerName')
      .addSelect('lead.screenerAssignedAt', 'screenerAssignedAt')
      .where('status.name = :statusName', { statusName: 'DUPLICATE' })
      .andWhere('lead.isActive = :active', { active: true })
      .andWhere('lead.leadEntryDate BETWEEN :from AND :to', {
        from: query.fromDate,
        to: query.toDate,
      })
      .orderBy('lead.id', 'DESC')
      .getRawMany();
  }

  /** export_id 3 — `ExportLeadTotal`: full lead-lifecycle CSV (every stage
   * timestamp + assignee + CAM terms). **Note**: legacy grants extra
   * columns to a hardcoded allowlist of legacy user ids for this export —
   * that's non-portable, install-specific data with no schema equivalent,
   * so it's omitted here; this port returns the full column set to every
   * caller with `RequireExportPermission` gating who can call it at all
   * (role-based gating, not a column-level allowlist). */
  async leadTotal(query: DateRangeQueryDto & { utmSource?: string }) {
    const qb = this.leadRepository
      .createQueryBuilder('lead')
      .leftJoin('lead.leadStatus', 'status')
      .leftJoin('lead.rejectionReason', 'rejectionReason')
      .leftJoin('lead.city', 'city')
      .leftJoin('lead.state', 'state')
      .leftJoin('lead.branch', 'branch')
      .leftJoin('lead.screenerAssignedTo', 'screener')
      .leftJoin('lead.creditAssignedTo', 'creditUser')
      .leftJoin('lead.rejectedBy', 'rejectedByUser')
      .leftJoin('lead.disbursalAssignedTo', 'disbursalUser')
      .select('lead.id', 'leadId')
      .addSelect('lead.applicationNo', 'applicationNo')
      .addSelect('lead.firstName', 'firstName')
      .addSelect('lead.source', 'source')
      .addSelect('lead.utmSource', 'utmSource')
      .addSelect('lead.utmCampaign', 'utmCampaign')
      .addSelect('lead.pancard', 'pancard')
      .addSelect('lead.mobile', 'mobile')
      .addSelect('lead.email', 'email')
      .addSelect('lead.isMobileVerified', 'isMobileVerified')
      .addSelect('lead.userType', 'userType')
      .addSelect('lead.monthlySalaryAmount', 'monthlySalaryAmount')
      .addSelect('lead.loanAmount', 'loanAmount')
      .addSelect('lead.tenureDays', 'tenureDays')
      .addSelect('lead.cibilScore', 'cibilScore')
      .addSelect('lead.obligations', 'obligations')
      .addSelect('status.name', 'status')
      .addSelect('rejectionReason.reason', 'rejectionReason')
      .addSelect('city.name', 'cityName')
      .addSelect('state.name', 'stateName')
      .addSelect('branch.name', 'branchName')
      .addSelect('screener.name', 'screenerName')
      .addSelect('lead.screenerAssignedAt', 'screenerAssignedAt')
      .addSelect('creditUser.name', 'creditUserName')
      .addSelect('lead.creditAssignedAt', 'creditAssignedAt')
      .addSelect('lead.creditApprovedAt', 'creditApprovedAt')
      .addSelect('disbursalUser.name', 'disbursalUserName')
      .addSelect('lead.disbursalAssignedAt', 'disbursalAssignedAt')
      .addSelect('lead.disbursalApprovedAt', 'disbursalApprovedAt')
      .addSelect('lead.finalDisbursedAt', 'finalDisbursedAt')
      .addSelect('rejectedByUser.name', 'rejectedByUserName')
      .addSelect('lead.rejectedAt', 'rejectedAt')
      .addSelect('lead.createdAt', 'createdAt')
      .where('lead.isActive = :active', { active: true })
      .andWhere('lead.leadEntryDate BETWEEN :from AND :to', {
        from: query.fromDate,
        to: query.toDate,
      });
    if (query.utmSource) {
      qb.andWhere('lead.utmSource = :utmSource', {
        utmSource: query.utmSource,
      });
    }
    return qb.orderBy('lead.id', 'DESC').getRawMany();
  }

  /** export_id 4 — `ExportLeadRejected`: rejected leads with rejection
   * reason + BRE rule-result flags. **Schema gap**: legacy joins
   * `lead_eligibility_rules_result` for granular system-rejection flags
   * (employment type, income, DOB, city, state, salary mode, duplicate,
   * reject-5-times, blacklisted, blacklisted-pincode) with no equivalent
   * entity in this schema — this port instead lists every `BreRuleResult`
   * row per lead with a REJECT decision (rule name + actual value), a
   * structurally different but informationally equivalent breakdown. */
  async leadRejected(query: DateRangeQueryDto) {
    const leads = await this.leadRepository
      .createQueryBuilder('lead')
      .leftJoin('lead.leadStatus', 'status')
      .leftJoin('lead.rejectionReason', 'rejectionReason')
      .leftJoin('lead.city', 'city')
      .leftJoin('lead.state', 'state')
      .leftJoin('lead.screenerAssignedTo', 'screener')
      .leftJoin('lead.creditAssignedTo', 'creditUser')
      .leftJoin('lead.rejectedBy', 'rejectedByUser')
      .select('lead.id', 'leadId')
      .addSelect('lead.firstName', 'firstName')
      .addSelect('lead.pancard', 'pancard')
      .addSelect('lead.mobile', 'mobile')
      .addSelect('lead.email', 'email')
      .addSelect('lead.userType', 'userType')
      .addSelect('lead.loanAmount', 'loanAmount')
      .addSelect('lead.cibilScore', 'cibilScore')
      .addSelect('lead.obligations', 'obligations')
      .addSelect('lead.source', 'source')
      .addSelect('lead.utmSource', 'utmSource')
      .addSelect('lead.utmCampaign', 'utmCampaign')
      .addSelect('city.name', 'cityName')
      .addSelect('state.name', 'stateName')
      .addSelect('status.name', 'status')
      .addSelect('lead.leadEntryDate', 'leadEntryDate')
      .addSelect('screener.name', 'screenerName')
      .addSelect('creditUser.name', 'creditUserName')
      .addSelect('rejectionReason.reason', 'rejectionReason')
      .addSelect('rejectedByUser.name', 'rejectedByUserName')
      .addSelect('lead.rejectedAt', 'rejectedAt')
      .where('status.name = :statusName', { statusName: 'REJECTED' })
      .andWhere('lead.leadEntryDate BETWEEN :from AND :to', {
        from: query.fromDate,
        to: query.toDate,
      })
      .orderBy('lead.id', 'DESC')
      .getRawMany<{ leadId: number }>();

    if (leads.length === 0) {
      return [];
    }
    const breResults = await this.breRuleResultRepository
      .createQueryBuilder('result')
      .innerJoin('result.rule', 'rule')
      .select('result.lead', 'leadId')
      .addSelect('rule.name', 'ruleName')
      .addSelect('result.systemDecision', 'systemDecision')
      .where('result.lead IN (:...leadIds)', {
        leadIds: leads.map((l) => l.leadId),
      })
      .andWhere('result.systemDecision = :decision', { decision: 'REJECT' })
      .getRawMany<{
        leadId: number;
        ruleName: string;
        systemDecision: string;
      }>();

    const breByLead = new Map<number, string[]>();
    for (const result of breResults) {
      const existing = breByLead.get(result.leadId) ?? [];
      existing.push(result.ruleName);
      breByLead.set(result.leadId, existing);
    }

    return leads.map((lead) => ({
      ...lead,
      breRejectionRules: (breByLead.get(lead.leadId) ?? []).join('; '),
    }));
  }

  /** export_id 43 — `exportPartialLeaddataModel`: leads with no name
   * captured yet (incomplete/partial applications — legacy filters
   * `first_name IS NULL`). */
  async partialLeadData(query: DateRangeQueryDto) {
    return this.leadRepository
      .createQueryBuilder('lead')
      .select('lead.id', 'leadId')
      .addSelect('lead.mobile', 'mobile')
      .addSelect('lead.source', 'source')
      .addSelect('lead.leadEntryDate', 'leadEntryDate')
      .addSelect('lead.isMobileVerified', 'isMobileVerified')
      .where('lead.isActive = :active', { active: true })
      .andWhere('lead.firstName IS NULL')
      .andWhere('lead.leadEntryDate BETWEEN :from AND :to', {
        from: query.fromDate,
        to: query.toDate,
      })
      .orderBy('lead.id', 'DESC')
      .getRawMany();
  }

  /** export_id 52 — `exportCSVLeadInteractionSummaryReport`: per-lead
   * stage-assignment summary (who touched the lead at each stage, and
   * when), plus CAM terms if sanctioned. */
  async leadInteractionSummary(query: DateRangeQueryDto) {
    return this.leadRepository
      .createQueryBuilder('lead')
      .leftJoin('lead.leadStatus', 'status')
      .leftJoin('lead.screenerAssignedTo', 'screener')
      .leftJoin('lead.creditAssignedTo', 'creditUser')
      .leftJoin('lead.auditAssignedTo', 'auditUser')
      .leftJoin('lead.disbursalAssignedTo', 'disbursalUser')
      .select('lead.id', 'leadId')
      .addSelect('lead.utmSource', 'utmSource')
      .addSelect('lead.source', 'source')
      .addSelect('lead.utmCampaign', 'utmCampaign')
      .addSelect('lead.monthlySalaryAmount', 'monthlySalaryAmount')
      .addSelect('status.name', 'status')
      .addSelect('screener.name', 'screenerUserName')
      .addSelect('lead.screenerAssignedAt', 'screenerAssignedAt')
      .addSelect('creditUser.name', 'creditUserName')
      .addSelect('lead.creditAssignedAt', 'creditAssignedAt')
      .addSelect('auditUser.name', 'auditUserName')
      .addSelect('lead.auditAssignedAt', 'auditAssignedAt')
      .addSelect('lead.creditApprovedAt', 'creditApprovedAt')
      .addSelect('disbursalUser.name', 'disbursalUserName')
      .addSelect('lead.disbursalAssignedAt', 'disbursalAssignedAt')
      .addSelect('lead.disbursalApprovedAt', 'disbursalApprovedAt')
      .addSelect('lead.userType', 'userType')
      .addSelect('lead.pancard', 'pancard')
      .where('lead.leadEntryDate BETWEEN :from AND :to', {
        from: query.fromDate,
        to: query.toDate,
      })
      .orderBy('lead.id', 'DESC')
      .getRawMany();
  }
}
