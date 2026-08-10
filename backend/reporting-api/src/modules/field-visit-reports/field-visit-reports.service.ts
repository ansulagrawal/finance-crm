import {
  Collection,
  CollectionVerificationStatus,
  Loan,
  LoanCollectionVisit,
} from '@finance-crm/database';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { DateRangeQueryDto } from '../../common/dto/date-range-query.dto';

/**
 * Field/visit MIS reports — ports `Report_Model.php`'s `BranchwiseVisitModel`
 * / `RMwiseVisitModel` / `RMConveyanceModel`. Legacy scopes all three to
 * `lead_status_id IN (14,16,17,18,19)` (the post-disbursal/collection-stage
 * lead statuses); this schema has no equivalent numeric-status filter, so
 * these queries instead scope to leads with a DISBURSED loan — the closest
 * real proxy for "in the collection/recovery stage".
 *
 * **Real schema gap**: `LoanCollectionVisit` (legacy `tbl_collection_followup`)
 * has no workflow-status column at all — the old pre-rewrite file referenced
 * a `visit.fieldStatus` with PENDING/ASSIGNED/CANCELLED/HOLD/COMPLETED
 * values that doesn't exist on this entity (it's GPS/visit-shaped only: lat/
 * long, address, a completion timestamp). The only workflow signal this
 * schema actually carries is `completedAt` (null vs. set), so every report
 * below is simplified to a completed/not-completed split rather than the
 * full 5-state breakdown — flagged in REPORTING-QUESTIONS-FOR-CLIENT.md, not
 * silently dropped. `totalDistanceKm` DOES exist on this entity (unlike what
 * the old `rmConveyance` doc comment claimed) and is wired into that report;
 * there is still no visit/RTO distance split or conveyance-amount column, so
 * those two fields stay null.
 */
@Injectable()
export class FieldVisitReportsService {
  constructor(
    @InjectRepository(LoanCollectionVisit)
    private readonly visitRepository: Repository<LoanCollectionVisit>,
    @InjectRepository(Collection)
    private readonly collectionRepository: Repository<Collection>,
  ) {}

  /** report_id 16 — `BranchwiseVisitModel`: visit counts by branch, with a
   * completed/pending split and completion %. */
  async branchwiseVisit(query: DateRangeQueryDto) {
    const qb = this.visitRepository
      .createQueryBuilder('visit')
      .innerJoin('visit.lead', 'lead')
      .innerJoin(
        Loan,
        'loan',
        'loan.leadId = lead.id AND loan.status = :disbursed',
        {
          disbursed: 'DISBURSED',
        },
      )
      .innerJoin('lead.branch', 'branch')
      .where('visit.isDeleted = false')
      .andWhere('branch.id IS NOT NULL')
      .select('branch.id', 'branchId')
      .addSelect('branch.name', 'branchName')
      .addSelect('COUNT(*)', 'totalCount')
      .addSelect(
        'SUM(CASE WHEN visit.completedAt IS NOT NULL THEN 1 ELSE 0 END)',
        'completedCount',
      )
      .groupBy('branch.id')
      .addGroupBy('branch.name')
      .orderBy('branch.id', 'ASC');
    this.applyDateRange(qb, 'visit.createdAt', query);
    const rows = await qb.getRawMany<{
      branchId: number;
      branchName: string;
      totalCount: string;
      completedCount: string;
    }>();
    return rows.map((row) => {
      const total = Number(row.totalCount);
      const completed = Number(row.completedCount);
      const pending = total - completed;
      return {
        branchId: row.branchId,
        branchName: row.branchName,
        totalVisits: total,
        pending,
        completed,
        pendingPercent:
          total > 0 ? Number(((pending / total) * 100).toFixed(2)) : 0,
        completedPercent:
          total > 0 ? Number(((completed / total) * 100).toFixed(2)) : 0,
      };
    });
  }

  /** report_id 17 — `RMwiseVisitModel`: visit counts + collection amount by
   * allocated RM. */
  async rmwiseVisit(query: DateRangeQueryDto) {
    const visitQb = this.visitRepository
      .createQueryBuilder('visit')
      .innerJoin('visit.lead', 'lead')
      .innerJoin(
        Loan,
        'loan',
        'loan.leadId = lead.id AND loan.status = :disbursed',
        {
          disbursed: 'DISBURSED',
        },
      )
      .innerJoin('visit.allocatedTo', 'rm')
      .where('visit.isDeleted = false')
      .select('rm.id', 'rmId')
      .addSelect('rm.name', 'rmName')
      .addSelect('COUNT(*)', 'totalCount')
      .addSelect(
        'SUM(CASE WHEN visit.completedAt IS NOT NULL THEN 1 ELSE 0 END)',
        'completedCount',
      )
      .groupBy('rm.id')
      .addGroupBy('rm.name')
      .orderBy('rm.name', 'ASC');
    this.applyDateRange(visitQb, 'visit.scheduledAt', query);
    const visitRows = await visitQb.getRawMany<{
      rmId: number;
      rmName: string;
      totalCount: string;
      completedCount: string;
    }>();

    const collectionQb = this.collectionRepository
      .createQueryBuilder('collection')
      .innerJoin('collection.collectionExecutive', 'rm')
      .where('collection.isDeleted = false')
      .andWhere('collection.verificationStatus = :verified', {
        verified: CollectionVerificationStatus.APPROVED,
      })
      .andWhere('collection.receivedDate IS NOT NULL')
      .select('rm.id', 'rmId')
      .addSelect('SUM(collection.receivedAmount)', 'collectionAmount')
      .groupBy('rm.id');
    this.applyDateRange(collectionQb, 'collection.receivedDate', query);
    const collectionRows = await collectionQb.getRawMany<{
      rmId: number;
      collectionAmount: string;
    }>();
    const collectionByRm = new Map(
      collectionRows.map((row) => [row.rmId, Number(row.collectionAmount)]),
    );

    return visitRows.map((row) => {
      const total = Number(row.totalCount);
      const completed = Number(row.completedCount);
      return {
        rmId: row.rmId,
        rmName: row.rmName,
        totalVisitsAssigned: total,
        completed,
        pending: total - completed,
        collectionAmount: collectionByRm.get(row.rmId) ?? 0,
        completedPercent:
          total > 0 ? Number(((completed / total) * 100).toFixed(2)) : 0,
      };
    });
  }

  /** report_id 20 — `RMConveyanceModel`: RM travel-conveyance summary,
   * completed visits only. `totalDistanceKm` is real data on this entity;
   * the visit/RTO distance split and conveyance amount are not (see class
   * doc comment) and stay null rather than fabricated. */
  async rmConveyance(query: DateRangeQueryDto) {
    const qb = this.visitRepository
      .createQueryBuilder('visit')
      .innerJoin('visit.lead', 'lead')
      .innerJoin(
        Loan,
        'loan',
        'loan.leadId = lead.id AND loan.status = :disbursed',
        {
          disbursed: 'DISBURSED',
        },
      )
      .innerJoin('visit.allocatedTo', 'rm')
      .where('visit.isDeleted = false')
      .andWhere('visit.completedAt IS NOT NULL')
      .select('rm.id', 'rmId')
      .addSelect('rm.name', 'rmName')
      .addSelect('COUNT(*)', 'completedVisitCount')
      .addSelect('SUM(visit.totalDistanceKm)', 'totalDistanceKm')
      .groupBy('rm.id')
      .addGroupBy('rm.name')
      .orderBy('rm.name', 'ASC');
    this.applyDateRange(qb, 'visit.completedAt', query);
    const rows = await qb.getRawMany<{
      rmId: number;
      rmName: string;
      completedVisitCount: string;
      totalDistanceKm: string | null;
    }>();
    return rows.map((row) => ({
      rmId: row.rmId,
      rmName: row.rmName,
      completedVisitCount: Number(row.completedVisitCount),
      visitDistanceKm: null,
      rthDistanceKm: null,
      totalDistanceKm:
        row.totalDistanceKm === null ? null : Number(row.totalDistanceKm),
      totalConveyanceAmount: null,
    }));
  }

  private applyDateRange(
    qb: {
      andWhere: (cond: string, params?: Record<string, unknown>) => unknown;
    },
    column: string,
    query: DateRangeQueryDto,
  ): void {
    if (query.fromDate) {
      qb.andWhere(`${column} >= :from`, { from: query.fromDate });
    }
    if (query.toDate) {
      qb.andWhere(`${column} <= :to`, { to: query.toDate });
    }
  }
}
