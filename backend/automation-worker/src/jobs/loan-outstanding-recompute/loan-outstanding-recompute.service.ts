import {
  calculateLoanRepayment,
  JOB_RUNNER,
  type JobRunner,
} from '@finance-crm/common';
import {
  Collection,
  CollectionVerificationStatus,
  CreditAnalysisMemo,
  Lead,
  Loan,
  MasterStatus,
} from '@finance-crm/database';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

const LOAN_DISBURSED_STATUS = 'DISBURSED';
const REPAYMENT_STATUS_NAME = {
  CLOSED: 'CLOSED',
  SETTLED: 'SETTLED',
  WRITEOFF: 'WRITEOFF',
} as const;

/**
 * Ports `CronCollectionController::calculationAllLoans()` — a nightly job
 * that recomputes every currently-disbursed loan's outstanding
 * interest/principal/penalty via `CommonComponent::
 * get_loan_repayment_details()`, so those figures stay fresh day over day
 * even when no payment event happens for a given loan (interest/penalty
 * accrue purely with time).
 *
 * Uses the exact same `calculateLoanRepayment()` (`@finance-crm/common`) that
 * `core-api`'s `CollectionService.calculateRepaymentDetails()` calls on
 * every payment verification/preview — see that function's doc comment
 * for the two legacy quirks it faithfully reproduces (the shadowed
 * double-discount computation, and every call persisting even when
 * read-only). `automation-worker` reads/writes the shared database
 * directly rather than calling `core-api` over HTTP (this repo's standing
 * architecture — see root `CLAUDE.md`), so this is its own port of the
 * same DB-fetching glue `CollectionService` has, not a call into it.
 *
 * **Disabled by default** — no real production crontab entry/time was
 * confirmed during the audit that found this gap (`docs/COMPLETED.md`
 * Task #126), only that legacy calls this nightly. Built and tested, off
 * everywhere unless `CRON_LOAN_OUTSTANDING_RECOMPUTE` is set to a real
 * cron expression.
 */
@Injectable()
export class LoanOutstandingRecomputeService implements OnModuleInit {
  private readonly logger = new Logger(LoanOutstandingRecomputeService.name);

  private static readonly CRON_EXPRESSION = 'disabled';

  constructor(
    @Inject(JOB_RUNNER) private readonly jobRunner: JobRunner,
    @InjectRepository(Loan) private readonly loanRepository: Repository<Loan>,
    @InjectRepository(Lead) private readonly leadRepository: Repository<Lead>,
    @InjectRepository(CreditAnalysisMemo)
    private readonly camRepository: Repository<CreditAnalysisMemo>,
    @InjectRepository(Collection)
    private readonly collectionRepository: Repository<Collection>,
    @InjectRepository(MasterStatus)
    private readonly masterStatusRepository: Repository<MasterStatus>,
  ) {}

  onModuleInit(): void {
    this.jobRunner.schedule(
      'loan-outstanding-recompute',
      LoanOutstandingRecomputeService.CRON_EXPRESSION,
      async () => {
        await this.run();
      },
    );
  }

  async run(): Promise<{ processed: number; failed: number }> {
    const statuses = await this.resolveClosureStatuses();
    const loans = await this.loanRepository.find({
      where: {
        status: LOAN_DISBURSED_STATUS,
        isActive: true,
        isDeleted: false,
      },
      relations: { lead: true },
    });
    if (loans.length === 0) {
      this.logger.debug('loan-outstanding-recompute: no disbursed loans');
      return { processed: 0, failed: 0 };
    }

    let processed = 0;
    let failed = 0;
    for (const loan of loans) {
      try {
        await this.recompute(loan, statuses);
        processed += 1;
      } catch (error) {
        failed += 1;
        this.logger.error(
          `loan-outstanding-recompute: failed for lead ${loan.lead.id}: ${(error as Error).message}`,
        );
      }
    }

    this.logger.log(
      `loan-outstanding-recompute: processed=${processed} failed=${failed}`,
    );
    return { processed, failed };
  }

  private async recompute(
    loan: Loan,
    statuses: { closed: number; settled: number; writtenOff: number },
  ): Promise<void> {
    const leadId = loan.lead.id;
    const lead = await this.leadRepository.findOne({
      where: { id: leadId },
      relations: { leadStatus: true },
    });
    if (!lead) return;
    const cam = await this.camRepository.findOne({
      where: { lead: { id: leadId }, isActive: true },
    });
    const loanRecommended = cam?.recommendedLoanAmount ?? 0;
    const gatePassed = Boolean(cam);

    let terminalCollection: {
      receivedDate: Date | null;
      closedAt: Date | null;
    } | null = null;
    let totalReceivedAmount = 0;
    if (gatePassed) {
      const [firstSettled, firstClosed, firstWrittenOff] = await Promise.all([
        this.findFirstVerifiedCollectionByType(leadId, statuses.settled),
        this.findFirstVerifiedCollectionByType(leadId, statuses.closed),
        this.findFirstVerifiedCollectionByType(leadId, statuses.writtenOff),
      ]);
      terminalCollection = firstSettled ?? firstClosed ?? firstWrittenOff;

      const totalReceivedRow = await this.collectionRepository
        .createQueryBuilder('collection')
        .select('SUM(collection.receivedAmount)', 'total')
        .where('collection.leadId = :leadId', { leadId })
        .andWhere('collection.verificationStatus = :status', {
          status: CollectionVerificationStatus.APPROVED,
        })
        .andWhere('collection.isActive = 1')
        .andWhere('collection.isDeleted = 0')
        .getRawOne<{ total: string | null }>();
      totalReceivedAmount = Number(totalReceivedRow?.total ?? 0);
    }

    const { details, camUpdate } = calculateLoanRepayment({
      leadId,
      loanNumber: loan.loanNumber,
      isBlacklisted: lead.isBlacklisted,
      leadStatusName: lead.leadStatus?.name ?? null,
      gatePassed,
      finalDisbursedAt: lead.finalDisbursedAt,
      loanRecommended,
      roi: cam?.roi ?? null,
      repaymentAmount: cam?.repaymentAmount ?? null,
      repaymentDate: cam?.repaymentDate ?? null,
      advanceInterestAmount: cam?.advanceInterestAmount ?? null,
      storedPrincipalDiscount: loan.principalDiscount ?? 0,
      storedInterestDiscount: loan.interestDiscount ?? 0,
      storedPenaltyDiscount: loan.penaltyDiscount ?? 0,
      storedTotalDiscount: loan.totalDiscount ?? 0,
      terminalCollection,
      totalReceivedAmount,
    });

    loan.principalPayable = details.loanRecommended;
    loan.interestPayable = details.totalInterestAmount;
    loan.penaltyPayable = details.penaltyInterest;
    loan.principalReceived = details.totalPrincipleAmountReceived;
    loan.interestReceived = details.totalInterestAmountReceived;
    loan.penaltyReceived = details.totalPenaltyInterestReceived;
    loan.principalOutstanding = details.totalPrincipleAmountPending;
    loan.interestOutstanding = details.totalInterestAmountPending;
    loan.penaltyOutstanding = details.totalPenaltyInterestPending;
    loan.totalPayable = details.totalRepaymentAmount;
    loan.totalReceived = details.totalReceivedAmount;
    loan.totalOutstanding = details.totalDueAmount;
    loan.principalDiscount = details.principleDiscountAmount;
    loan.interestDiscount = details.interestDiscountAmount;
    loan.penaltyDiscount = details.penaltyDiscountAmount;
    loan.totalDiscount = details.totalDiscountAmount;
    await this.loanRepository.save(loan);

    if (camUpdate) {
      await this.camRepository.update({ lead: { id: leadId } }, camUpdate);
    }
  }

  private async resolveClosureStatuses(): Promise<{
    closed: number;
    settled: number;
    writtenOff: number;
  }> {
    const rows = await this.masterStatusRepository.find({
      where: { name: In(Object.values(REPAYMENT_STATUS_NAME)) },
    });
    const byName = new Map(rows.map((row) => [row.name, row.id]));
    const closed = byName.get(REPAYMENT_STATUS_NAME.CLOSED);
    const settled = byName.get(REPAYMENT_STATUS_NAME.SETTLED);
    const writtenOff = byName.get(REPAYMENT_STATUS_NAME.WRITEOFF);
    if (!closed || !settled || !writtenOff) {
      throw new Error(
        'Missing CLOSED/SETTLED/WRITEOFF master_status rows — cannot recompute loans.',
      );
    }
    return { closed, settled, writtenOff };
  }

  private async findFirstVerifiedCollectionByType(
    leadId: number,
    statusId: number,
  ): Promise<Collection | null> {
    return this.collectionRepository.findOne({
      where: {
        lead: { id: leadId },
        repaymentTypeId: String(statusId),
        verificationStatus: CollectionVerificationStatus.APPROVED,
        isActive: true,
        isDeleted: false,
      },
      order: { id: 'ASC' },
    });
  }
}
