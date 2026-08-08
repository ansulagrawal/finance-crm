import { Lead, MasterStatus } from '@finance-crm/database';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { DateRangeQueryDto } from '../../common/dto/date-range-query.dto';

/**
 * Ports the Lead/Application MIS reports from `Report_Model.php`
 * (`ReportsController.php`'s dispatcher). Legacy returns pre-rendered HTML
 * tables; this returns structured JSON rows instead (the new frontend
 * renders its own tables) — a deliberate modernization, not a fidelity gap,
 * since the underlying filter/join/group-by logic is what's actually being
 * ported.
 *
 * `leads.lead_active = 1` in every legacy query maps to `isActive: true` on
 * `Lead` here; `lead_entry_date` maps to `Lead.leadEntryDate`.
 */
@Injectable()
export class LeadReportsService {
  constructor(
    @InjectRepository(Lead) private readonly leadRepository: Repository<Lead>,
    @InjectRepository(MasterStatus)
    private readonly masterStatusRepository: Repository<MasterStatus>,
  ) {}

  /** report_id 1 — `LeadSourceReport`: leads by status in a date range,
   * including zero-count statuses (legacy left-joins every active
   * master_status row so the report always shows every status). */
  async leadSource(query: DateRangeQueryDto) {
    const statuses = await this.masterStatusRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC' },
    });
    const counts = await this.leadRepository
      .createQueryBuilder('lead')
      .innerJoin('lead.leadStatus', 'status')
      .select('status.id', 'statusId')
      .addSelect('COUNT(*)', 'count')
      .where('lead.isActive = :active', { active: true })
      .andWhere('lead.leadEntryDate BETWEEN :from AND :to', {
        from: query.fromDate,
        to: query.toDate,
      })
      .groupBy('status.id')
      .getRawMany<{ statusId: number; count: string }>();

    const countMap = new Map(counts.map((c) => [c.statusId, Number(c.count)]));
    const rows = statuses.map((status) => ({
      statusId: status.id,
      statusName: status.name,
      count: countMap.get(status.id) ?? 0,
    }));
    return {
      rows,
      totalLeads: rows.reduce((sum, r) => sum + r.count, 0),
    };
  }

  /** report_id 8 — `LeadSourceStatusModel`: lead counts pivoted by
   * source × status. Returned flat (not pre-pivoted); the frontend pivots. */
  async leadSourceStatus(query: DateRangeQueryDto) {
    return this.leadRepository
      .createQueryBuilder('lead')
      .innerJoin('lead.leadStatus', 'status')
      .select('lead.source', 'source')
      .addSelect('status.name', 'statusName')
      .addSelect('status.sortOrder', 'sortOrder')
      .addSelect('COUNT(*)', 'count')
      .where('lead.isActive = :active', { active: true })
      .andWhere('lead.leadEntryDate BETWEEN :from AND :to', {
        from: query.fromDate,
        to: query.toDate,
      })
      .andWhere('lead.source IS NOT NULL')
      .groupBy('lead.source')
      .addGroupBy('status.name')
      .addGroupBy('status.sortOrder')
      .orderBy('status.sortOrder', 'ASC')
      .addOrderBy('lead.source', 'ASC')
      .getRawMany();
  }

  /**
   * report_id 18/19 — `SanctionProductivityNew`/`SanctionProductivityRepeat`:
   * per-screener productivity (leads screened / sanctioned / disbursed),
   * "today" vs month-to-date. **Simplified from legacy**: the original
   * additionally splits executives into two hardcoded office teams via a
   * literal array of legacy user ids (`[258, 259, 260, 257, 180, 51]`) —
   * that's install-specific, non-portable data with no schema equivalent
   * (no "office/team" concept exists anywhere in this schema), so this port
   * omits the team split and reports per-executive productivity only. Flag
   * this simplification if the business relies on the team-level rollup.
   */
  async sanctionProductivity(userType: 'NEW' | 'REPEAT', toDate: string) {
    const monthStart = `${toDate.slice(0, 8)}01`;
    return this.leadRepository
      .createQueryBuilder('lead')
      .innerJoin('lead.screenerAssignedTo', 'screener')
      .select('screener.id', 'screenerId')
      .addSelect('screener.name', 'screenerName')
      .addSelect(
        'SUM(CASE WHEN DATE(lead.screenerAssignedAt) = :toDate THEN 1 ELSE 0 END)',
        'screenedToday',
      )
      .addSelect(
        'SUM(CASE WHEN DATE(lead.creditApprovedAt) = :toDate THEN 1 ELSE 0 END)',
        'sanctionedToday',
      )
      .addSelect(
        'SUM(CASE WHEN DATE(lead.finalDisbursedAt) = :toDate THEN 1 ELSE 0 END)',
        'disbursedToday',
      )
      .addSelect('COUNT(*)', 'screenedMtd')
      .addSelect(
        'SUM(CASE WHEN lead.creditApprovedAt IS NOT NULL THEN 1 ELSE 0 END)',
        'sanctionedMtd',
      )
      .addSelect(
        'SUM(CASE WHEN lead.finalDisbursedAt IS NOT NULL THEN 1 ELSE 0 END)',
        'disbursedMtd',
      )
      .where('lead.isActive = :active', { active: true })
      .andWhere('lead.userType = :userType', { userType })
      .andWhere('lead.leadEntryDate BETWEEN :monthStart AND :toDate', {
        monthStart,
        toDate,
      })
      .setParameter('toDate', toDate)
      .groupBy('screener.id')
      .addGroupBy('screener.name')
      .orderBy('screener.name', 'ASC')
      .getRawMany();
  }

  /** report_id 27 — `HourlyStatusWiseModel`: lead status counts bucketed by
   * hour of day (legacy uses 6 fixed clock-time buckets; ported as an
   * hour-of-day integer 0-23 instead, letting the frontend bucket however
   * it needs — equivalent information, more flexible). */
  async hourlyStatusWise(query: DateRangeQueryDto) {
    return this.leadRepository
      .createQueryBuilder('lead')
      .innerJoin('lead.leadStatus', 'status')
      .select('status.id', 'statusId')
      .addSelect('status.name', 'statusName')
      .addSelect('HOUR(lead.createdAt)', 'hour')
      .addSelect('lead.userType', 'userType')
      .addSelect('COUNT(*)', 'count')
      .where('lead.isActive = :active', { active: true })
      .andWhere('lead.leadEntryDate BETWEEN :from AND :to', {
        from: query.fromDate,
        to: query.toDate,
      })
      .groupBy('status.id')
      .addGroupBy('status.name')
      .addGroupBy('hour')
      .addGroupBy('lead.userType')
      .orderBy('status.id', 'ASC')
      .getRawMany();
  }

  /** report_id 28 — `LeadUTMSourceStatusModel`: leads by utm_source × status. */
  async leadUtmSourceStatus(query: DateRangeQueryDto) {
    return this.leadRepository
      .createQueryBuilder('lead')
      .innerJoin('lead.leadStatus', 'status')
      .select('UPPER(lead.utmSource)', 'utmSource')
      .addSelect('status.id', 'statusId')
      .addSelect('status.name', 'statusName')
      .addSelect('COUNT(*)', 'count')
      .where('lead.leadEntryDate BETWEEN :from AND :to', {
        from: query.fromDate,
        to: query.toDate,
      })
      .groupBy('lead.utmSource')
      .addGroupBy('status.id')
      .addGroupBy('status.name')
      .orderBy('status.id', 'ASC')
      .addOrderBy('lead.utmSource', 'ASC')
      .getRawMany();
  }

  /** report_id 50 — `LeadUTMCampaignStatusModel`: leads by utm_campaign × status. */
  async leadUtmCampaignStatus(query: DateRangeQueryDto) {
    return this.leadRepository
      .createQueryBuilder('lead')
      .innerJoin('lead.leadStatus', 'status')
      .select('lead.utmCampaign', 'utmCampaign')
      .addSelect('status.id', 'statusId')
      .addSelect('status.name', 'statusName')
      .addSelect('COUNT(*)', 'count')
      .where('lead.leadEntryDate BETWEEN :from AND :to', {
        from: query.fromDate,
        to: query.toDate,
      })
      .groupBy('lead.utmCampaign')
      .addGroupBy('status.id')
      .addGroupBy('status.name')
      .orderBy('status.id', 'ASC')
      .getRawMany();
  }

  /** report_id 52 — `Source_utm_source_status_Model`: combined
   * source/utm_source/utm_campaign × status matrix. */
  async sourceUtmSourceStatus(query: DateRangeQueryDto) {
    return this.leadRepository
      .createQueryBuilder('lead')
      .innerJoin('lead.leadStatus', 'status')
      .select('lead.source', 'source')
      .addSelect('lead.utmSource', 'utmSource')
      .addSelect('lead.utmCampaign', 'utmCampaign')
      .addSelect('status.id', 'statusId')
      .addSelect('status.name', 'statusName')
      .addSelect('COUNT(*)', 'count')
      .where('lead.leadEntryDate BETWEEN :from AND :to', {
        from: query.fromDate,
        to: query.toDate,
      })
      .groupBy('lead.source')
      .addGroupBy('lead.utmSource')
      .addGroupBy('lead.utmCampaign')
      .addGroupBy('status.id')
      .addGroupBy('status.name')
      .getRawMany();
  }

  /** report_id 31 — `LeadSourcingCityWiseStatusModel`: leads by sourcing
   * city × status. **Schema gap**: legacy filters to cities flagged
   * `m_city_is_sourcing=1`; the new `City` entity has no such flag (not
   * carried over during the geography migration) — this port reports
   * across all cities instead of just "sourcing" ones, flagged here rather
   * than silently narrowing/fabricating a flag. */
  async leadSourcingCityWiseStatus(query: DateRangeQueryDto) {
    return this.leadRepository
      .createQueryBuilder('lead')
      .innerJoin('lead.city', 'city')
      .innerJoin('lead.leadStatus', 'status')
      .select('city.name', 'cityName')
      .addSelect('status.id', 'statusId')
      .addSelect('status.name', 'statusName')
      .addSelect('COUNT(*)', 'count')
      .where('lead.isActive = :active', { active: true })
      .andWhere('lead.leadEntryDate BETWEEN :from AND :to', {
        from: query.fromDate,
        to: query.toDate,
      })
      .groupBy('city.name')
      .addGroupBy('status.id')
      .addGroupBy('status.name')
      .orderBy('city.name', 'ASC')
      .getRawMany();
  }

  /** report_id 32 — `LeadCityWiseStatusModel`: leads pan-India by city × status. */
  async leadCityWiseStatus(query: DateRangeQueryDto) {
    return this.leadRepository
      .createQueryBuilder('lead')
      .innerJoin('lead.city', 'city')
      .innerJoin('lead.leadStatus', 'status')
      .select('city.name', 'cityName')
      .addSelect('status.id', 'statusId')
      .addSelect('status.name', 'statusName')
      .addSelect('COUNT(*)', 'count')
      .where('lead.isActive = :active', { active: true })
      .andWhere('lead.leadEntryDate BETWEEN :from AND :to', {
        from: query.fromDate,
        to: query.toDate,
      })
      .groupBy('city.name')
      .addGroupBy('status.id')
      .addGroupBy('status.name')
      .orderBy('city.name', 'ASC')
      .getRawMany();
  }

  /** report_id 49 — `RejectionAnalysisModel`: rejected-lead breakdown by
   * rejection reason × data source. **Schema gap**: legacy additionally
   * breaks system-rejections down by granular flag (employment type,
   * income, DOB, city, state, salary mode, duplicate, reject-5-times,
   * blacklisted, blacklisted-pincode) via `lead_eligibility_rules_result` —
   * this schema has no equivalent entity for that granular result (only
   * the generic `BreRuleResult`), so this port reports rejection reason ×
   * source only, not the granular system-rejection flag matrix. */
  async rejectionAnalysis(query: DateRangeQueryDto) {
    return this.leadRepository
      .createQueryBuilder('lead')
      .innerJoin('lead.rejectionReason', 'reason')
      .leftJoin('lead.dataSource', 'dataSource')
      .select('dataSource.name', 'dataSourceName')
      .addSelect('reason.reason', 'rejectionReason')
      .addSelect('COUNT(*)', 'count')
      .where('lead.leadEntryDate BETWEEN :from AND :to', {
        from: query.fromDate,
        to: query.toDate,
      })
      .groupBy('dataSource.name')
      .addGroupBy('reason.reason')
      .getRawMany();
  }

  /** report_id 74 — `SystemRejecetedStatusReport`/`LeadSystemRejectAnalysisModel`:
   * leads auto-rejected by the system rule engine (status = SYSTEM-REJECT). */
  async systemRejectedStatus(query: DateRangeQueryDto) {
    const systemRejectStatus = await this.masterStatusRepository.findOne({
      where: { name: 'SYSTEM-REJECT' },
    });
    if (!systemRejectStatus) {
      return { rows: [], note: 'SYSTEM-REJECT master status not seeded' };
    }
    const rows = await this.leadRepository
      .createQueryBuilder('lead')
      .leftJoin('lead.dataSource', 'dataSource')
      .select('dataSource.name', 'dataSourceName')
      .addSelect('COUNT(*)', 'count')
      .where('lead.leadStatus = :statusId', { statusId: systemRejectStatus.id })
      .andWhere('lead.leadEntryDate BETWEEN :from AND :to', {
        from: query.fromDate,
        to: query.toDate,
      })
      .groupBy('dataSource.name')
      .getRawMany();
    return { rows };
  }

  /** report_id 51 — `LeadAssignmentSummaryModel`: current open-lead
   * assignment counts per user (no date params in legacy). **Schema gap**:
   * legacy additionally checks `user_lead_allocation_log` for a
   * daily-activation-status flag per user — no equivalent entity exists in
   * this schema (allocation-log wasn't modeled), so this port reports raw
   * current assignment counts only, not the daily-activation flag. */
  async leadAssignmentSummary() {
    return this.leadRepository
      .createQueryBuilder('lead')
      .innerJoin('lead.creditAssignedTo', 'creditUser')
      .select('creditUser.id', 'userId')
      .addSelect('creditUser.name', 'userName')
      .addSelect('creditUser.email', 'email')
      .addSelect('lead.userType', 'userType')
      .addSelect('COUNT(*)', 'totalLeads')
      .where('lead.isActive = :active', { active: true })
      .groupBy('creditUser.id')
      .addGroupBy('creditUser.name')
      .addGroupBy('creditUser.email')
      .addGroupBy('lead.userType')
      .orderBy('creditUser.name', 'ASC')
      .getRawMany();
  }

  /** report_id 53 — `LeadRejectionAnalysisCampaignModel`: lead rejection
   * analysis with campaign filter (report_id 54 is a legacy bug that just
   * re-invokes this same method with a drifted DB label — not built as a
   * separate endpoint, see TODO.md). */
  async leadRejectionAnalysisCampaign(
    query: DateRangeQueryDto & { utmCampaign?: string },
  ) {
    const qb = this.leadRepository
      .createQueryBuilder('lead')
      .innerJoin('lead.rejectionReason', 'reason')
      .select('lead.utmCampaign', 'utmCampaign')
      .addSelect('reason.reason', 'rejectionReason')
      .addSelect('COUNT(*)', 'count')
      .where('lead.leadEntryDate BETWEEN :from AND :to', {
        from: query.fromDate,
        to: query.toDate,
      });
    if (query.utmCampaign) {
      qb.andWhere('lead.utmCampaign = :utmCampaign', {
        utmCampaign: query.utmCampaign,
      });
    }
    return qb
      .groupBy('lead.utmCampaign')
      .addGroupBy('reason.reason')
      .getRawMany();
  }

  /**
   * report_id 75 — `LeadConversionReport`/`LeadConversionModel`: lead
   * conversion by monthly-income bracket, max 30-day range. **Legacy is
   * fully broken today** — `LeadConversionModel()` literally starts with
   * `print_r(1);die;` (a leftover debug statement), so calling this report
   * in production just prints "1" and halts; the real query logic below it
   * is dead code, never reached. Reconstructed here from that dead code's
   * evident intent: NEW leads bucketed by monthly income, with a
   * conversion-to-application-stage flag.
   */
  async leadConversion(query: DateRangeQueryDto) {
    if (query.fromDate && query.toDate) {
      const days =
        (new Date(query.toDate).getTime() -
          new Date(query.fromDate).getTime()) /
        (1000 * 60 * 60 * 24);
      if (days > 30) {
        throw new BadRequestException(
          'Date range for this report cannot exceed 30 days',
        );
      }
    }
    return this.leadRepository
      .createQueryBuilder('lead')
      .select(
        `CASE
          WHEN lead.monthlySalaryAmount < 15000 THEN '< 15,000'
          WHEN lead.monthlySalaryAmount < 25000 THEN '15,000 - 24,999'
          WHEN lead.monthlySalaryAmount < 50000 THEN '25,000 - 49,999'
          ELSE '50,000+'
        END`,
        'incomeBracket',
      )
      .addSelect('COUNT(*)', 'totalLeads')
      .addSelect(
        'SUM(CASE WHEN lead.applicationNo IS NOT NULL THEN 1 ELSE 0 END)',
        'converted',
      )
      .where('lead.isActive = :active', { active: true })
      .andWhere('lead.userType = :userType', { userType: 'NEW' })
      .andWhere('lead.leadEntryDate BETWEEN :from AND :to', {
        from: query.fromDate,
        to: query.toDate,
      })
      .groupBy('incomeBracket')
      .getRawMany();
  }

  /**
   * report_id 81 — `Lead_Digital_Summary_Report`: digital (app/web) journey
   * funnel summary. **Simplified from legacy**: the original derives an
   * "Organic"/"Organic Repeat"/utm_source channel classification and joins
   * a dozen verification-stage columns via a complex multi-CTE query;
   * ported here as a per-utm_source funnel (total leads, disbursed count +
   * total loan amount) using this schema's actual `Lead` fields. A fuller
   * port joining `EkycLog`/`VideoKycLog`/`DomainVerificationLog`/
   * `UanVerificationLog`/`CrifBureauLog`/`BreRuleResult` per-lead
   * verification-step completion is a reasonable follow-up once those
   * per-step funnel breakdowns are actually needed — flagged as a
   * simplification, not silently dropped.
   */
  async leadDigitalSummary(query: DateRangeQueryDto) {
    return this.leadRepository
      .createQueryBuilder('lead')
      .select('lead.utmSource', 'utmSource')
      .addSelect('COUNT(*)', 'totalLeads')
      .addSelect(
        'SUM(CASE WHEN lead.finalDisbursedAt IS NOT NULL THEN 1 ELSE 0 END)',
        'disbursed',
      )
      .addSelect('SUM(lead.loanAmount)', 'totalLoanAmount')
      .where('lead.leadEntryDate BETWEEN :from AND :to', {
        from: query.fromDate,
        to: query.toDate,
      })
      .groupBy('lead.utmSource')
      .getRawMany();
  }

  /**
   * No `master_mis_report` row exists for this one (code-only, see
   * TODO.md) — `ProcessTATReport`/`exportProcessTATModel`: process-stage
   * turnaround time (screener/credit/disbursal), from-date only. Legacy
   * uses a window-function CTE (ROW_NUMBER/LAG over ordered
   * `lead_followup` rows) to compute stage-to-stage time diffs; ported
   * here by fetching the relevant timestamp columns directly off `Lead`
   * (already denormalized on this entity: `screenerAssignedAt`,
   * `creditApprovedAt`, `disbursalApprovedAt`, `finalDisbursedAt`) and
   * computing the diffs in application code rather than a correlated SQL
   * window function — simpler, still a real parameterized query, same
   * result.
   */
  async processTat(fromDate: string) {
    const leads = await this.leadRepository
      .createQueryBuilder('lead')
      .select([
        'lead.id',
        'lead.screenerAssignedAt',
        'lead.creditApprovedAt',
        'lead.disbursalApprovedAt',
        'lead.finalDisbursedAt',
      ])
      .where('lead.userType = :userType', { userType: 'NEW' })
      .andWhere('DATE(lead.creditApprovedAt) = :fromDate', { fromDate })
      .getMany();

    const diffHours = (a: Date | null, b: Date | null) =>
      a && b ? (b.getTime() - a.getTime()) / (1000 * 60 * 60) : null;

    return leads.map((lead) => ({
      leadId: lead.id,
      screenerToSanctionHours: diffHours(
        lead.screenerAssignedAt,
        lead.creditApprovedAt,
      ),
      sanctionToDisbursalApprovalHours: diffHours(
        lead.creditApprovedAt,
        lead.disbursalApprovedAt,
      ),
      disbursalApprovalToDisbursedHours: diffHours(
        lead.disbursalApprovedAt,
        lead.finalDisbursedAt,
      ),
    }));
  }
}
