import { randomInt } from 'node:crypto';
import { findOrFail, IntegrationsApiClient } from '@finance-crm/common';
import {
  CreditAnalysisMemo,
  CustomerBanking,
  DisbursalAuthorisedUser,
  DisbursementBank,
  DisbursementTransactionLog,
  DisbursementTransactionStatus,
  Lead,
  Loan,
  LoanPaymentMode,
  User,
} from '@finance-crm/database';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { assertLeadEditableBySupport } from '../../common/lead-editable.util';
import { CreateDisbursementBankDto } from './dto/create-disbursement-bank.dto';
import { CreateDisbursementTransactionDto } from './dto/create-disbursement-transaction.dto';
import { CreateLoanDto } from './dto/create-loan.dto';
import { DisburseLoanDto } from './dto/disburse-loan.dto';
import { UpdateDisbursementBankDto } from './dto/update-disbursement-bank.dto';

/**
 * `Loan.status` is legacy's free-string lifecycle label (same value space
 * as `Lead.legacyStatus`), not a `LoanStatus` enum — this port previously
 * assumed a simplified enum that doesn't exist in the real schema.
 */
const LOAN_STATUS = {
  PENDING: 'DISBURSE-PENDING',
  DISBURSED: 'DISBURSED',
  SETTLED: 'SETTLED',
  CLOSED: 'CLOSED',
  WRITTEN_OFF: 'WRITEOFF',
} as const;

/** Legacy's hard rupee bounds on an online disbursal, checked against the
 * CAM's *sanctioned* amount (`loan_recommended`), not the net disbursal —
 * ported verbatim from `icici_disburse_loan_amount_api()`. */
const MIN_ONLINE_DISBURSAL_AMOUNT = 7000;
const MAX_ONLINE_DISBURSAL_AMOUNT = 100000;

/**
 * Legacy's `"SLPRD" . date("YmdHis") . rand(100, 999)`. This value is the
 * idempotency key ICICI sees (`tranRefNo`, echoed as the envelope
 * `requestId`), so it must be unique per *intended* payment and stable across
 * a retry of the same one. `randomInt` rather than `Math.random` — a
 * predictable suffix would let a caller collide two distinct payments onto one
 * reference.
 */
function buildTransactionReferenceNo(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
  return `SLPRD${stamp}${randomInt(100, 1000)}`;
}

@Injectable()
export class DisbursalService {
  private readonly logger = new Logger(DisbursalService.name);

  constructor(
    @InjectRepository(Loan)
    private readonly loanRepository: Repository<Loan>,
    @InjectRepository(DisbursementBank)
    private readonly disbursementBankRepository: Repository<DisbursementBank>,
    @InjectRepository(DisbursementTransactionLog)
    private readonly disbursementTransactionLogRepository: Repository<DisbursementTransactionLog>,
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(CustomerBanking)
    private readonly customerBankingRepository: Repository<CustomerBanking>,
    @InjectRepository(CreditAnalysisMemo)
    private readonly creditAnalysisMemoRepository: Repository<CreditAnalysisMemo>,
    @InjectRepository(DisbursalAuthorisedUser)
    private readonly disbursalAuthorisedUserRepository: Repository<DisbursalAuthorisedUser>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly integrationsApiClient: IntegrationsApiClient,
  ) {}

  // Disbursal authorisation whitelist (who may run the ONLINE money path)
  listAuthorisedUsers(): Promise<DisbursalAuthorisedUser[]> {
    return this.disbursalAuthorisedUserRepository.find({
      where: { isActive: true, isDeleted: false },
      relations: { user: true },
      order: { id: 'ASC' },
    });
  }

  /** Idempotent: re-granting a revoked user reactivates the existing row
   * rather than colliding on the unique `userId` index. */
  async grantDisbursalAuthorisation(
    userId: number,
    grantedById: number,
  ): Promise<DisbursalAuthorisedUser> {
    const user = await findOrFail(this.userRepository, userId, 'User');
    const existing = await this.disbursalAuthorisedUserRepository.findOne({
      where: { userId: user.id },
    });
    const row =
      existing ?? this.disbursalAuthorisedUserRepository.create({ userId });
    row.isActive = true;
    row.isDeleted = false;
    row.grantedById = grantedById;
    return this.disbursalAuthorisedUserRepository.save(row);
  }

  async revokeDisbursalAuthorisation(userId: number): Promise<void> {
    const row = await this.disbursalAuthorisedUserRepository.findOne({
      where: { userId },
    });
    if (!row) {
      throw new NotFoundException(
        `User ${userId} is not authorised to disburse`,
      );
    }
    // Deactivated, not deleted — the grant history of a money permission stays.
    row.isActive = false;
    await this.disbursalAuthorisedUserRepository.save(row);
  }

  /**
   * Ports legacy's user whitelist
   * (`payday_disbursement_icici_helper.php:159`) off a hardcoded array and
   * onto `disbursal_authorised_users`. Fails closed: an absent acting user
   * is rejected, exactly like an unlisted one, so a caller that loses the
   * user id can never move money anonymously.
   */
  private async assertAuthorisedToDisburseOnline(
    actingUserId?: number,
  ): Promise<void> {
    const authorised =
      actingUserId !== undefined &&
      (await this.disbursalAuthorisedUserRepository.exists({
        where: { userId: actingUserId, isActive: true, isDeleted: false },
      }));
    if (!authorised) {
      throw new ForbiddenException(
        'Un-Authorized access of disbursement api — this user is not on the disbursal authorisation list.',
      );
    }
  }

  // Disbursement banks (company payout accounts)
  listBanks(): Promise<DisbursementBank[]> {
    return this.disbursementBankRepository.find({ order: { id: 'ASC' } });
  }

  findBankById(id: number): Promise<DisbursementBank> {
    return findOrFail(this.disbursementBankRepository, id, 'Disbursement bank');
  }

  createBank(
    dto: CreateDisbursementBankDto,
    actingUserId: number,
  ): Promise<DisbursementBank> {
    const bank = this.disbursementBankRepository.create({
      name: dto.name,
      accountNumber: dto.accountNumber,
      isImpsEnabled: dto.isImpsEnabled ?? false,
      isNeftEnabled: dto.isNeftEnabled ?? false,
      createdById: actingUserId,
      createdAt: new Date(),
    });
    return this.disbursementBankRepository.save(bank);
  }

  async updateBank(
    id: number,
    dto: UpdateDisbursementBankDto,
    actingUserId: number,
  ): Promise<DisbursementBank> {
    const bank = await this.findBankById(id);
    if (dto.name !== undefined) bank.name = dto.name;
    if (dto.accountNumber !== undefined) bank.accountNumber = dto.accountNumber;
    if (dto.isImpsEnabled !== undefined) bank.isImpsEnabled = dto.isImpsEnabled;
    if (dto.isNeftEnabled !== undefined) bank.isNeftEnabled = dto.isNeftEnabled;
    bank.updatedById = actingUserId;
    bank.updatedAt = new Date();
    return this.disbursementBankRepository.save(bank);
  }

  async removeBank(id: number): Promise<void> {
    const bank = await this.findBankById(id);
    bank.isActive = false;
    bank.isDeleted = true;
    await this.disbursementBankRepository.save(bank);
  }

  // Loan (one per lead)
  async findLoanByLead(leadId: number): Promise<Loan> {
    const loan = await this.loanRepository.findOne({
      where: { lead: { id: leadId } },
      relations: { lead: true, disbursementBank: true },
    });
    if (!loan) {
      throw new NotFoundException(`No loan found for lead ${leadId}`);
    }
    return loan;
  }

  async createLoan(leadId: number, dto: CreateLoanDto): Promise<Loan> {
    const lead = await findOrFail(this.leadRepository, leadId, 'Lead');
    const existing = await this.loanRepository.findOne({
      where: { lead: { id: leadId } },
    });
    if (existing) {
      throw new ConflictException(`Lead ${leadId} already has a loan`);
    }
    const loan = this.loanRepository.create({
      lead,
      loanNumber: dto.loanNumber,
      status: LOAN_STATUS.PENDING,
    });
    return this.loanRepository.save(loan);
  }

  /**
   * Ports `DisbursalController::allowDisbursalToBank_new()` +
   * `payday_loan_disbursement_call()`.
   *
   * OFFLINE mode is a bookkeeping action: a human already moved the money and
   * supplies the reference. ONLINE mode calls ICICI and actually moves it.
   *
   * The in-flight/already-done guard below is the single most important thing
   * in this method. Legacy's ordering is preserved deliberately: the
   * transaction log row is written BEFORE the vendor call, and a vendor call
   * whose outcome is unknown leaves that row `PENDING` — which the guard then
   * treats as blocking. That is what makes a double disbursal impossible
   * without a human first inspecting the pending row.
   */
  async disburse(
    leadId: number,
    dto: DisburseLoanDto,
    actingUserId?: number,
  ): Promise<Loan> {
    const loan = await this.findLoanByLead(leadId);
    if (loan.status !== LOAN_STATUS.PENDING) {
      throw new ConflictException(
        `Loan for lead ${leadId} is ${loan.status}, not PENDING — cannot disburse`,
      );
    }
    const disbursementBank = await findOrFail(
      this.disbursementBankRepository,
      dto.disbursementBankId,
      'Disbursement bank',
    );

    await this.assertNoDisbursalInFlight(leadId, loan);

    if (dto.paymentMode === LoanPaymentMode.OFFLINE) {
      return this.recordOfflineDisbursal(loan, disbursementBank, dto);
    }
    return this.disburseOnlineViaIcici(
      loan,
      disbursementBank,
      dto,
      actingUserId,
    );
  }

  /**
   * Ports the status guard in `payday_loan_disbursement_call()` plus the
   * `loan_disbursement_trans_status_id`/`disburse_refrence_no` check inside
   * `icici_disburse_loan_amount_api()` — legacy has two, at different layers,
   * and both matter.
   *
   * INITIATED/PENDING/HOLD all block: an in-flight transfer must never be
   * re-sent. Only FAILED permits a fresh attempt, because that is the one
   * state where legacy knows the money did not move.
   */
  private async assertNoDisbursalInFlight(
    leadId: number,
    loan: Loan,
  ): Promise<void> {
    if (loan.disbursementReferenceNo) {
      throw new ConflictException(
        'Loan amount has already been disbursed — a bank reference is already recorded.',
      );
    }

    const previous = await this.disbursementTransactionLogRepository.findOne({
      where: { lead: { id: leadId } },
      order: { id: 'DESC' },
    });
    if (!previous) {
      return;
    }
    if (previous.status === DisbursementTransactionStatus.COMPLETE) {
      throw new ConflictException(
        'Disbursement already done to this application.',
      );
    }
    if (
      previous.status === DisbursementTransactionStatus.INITIATED ||
      previous.status === DisbursementTransactionStatus.PENDING ||
      previous.status === DisbursementTransactionStatus.HOLD
    ) {
      throw new ConflictException(
        `Disbursement not allowed — transaction ${previous.referenceNo ?? previous.id} is still in flight (${DisbursementTransactionStatus[previous.status]}). Resolve it against the bank before retrying.`,
      );
    }
    // FAILED falls through: a new transaction reference will be created.
  }

  private async recordOfflineDisbursal(
    loan: Loan,
    disbursementBank: DisbursementBank,
    dto: DisburseLoanDto,
  ): Promise<Loan> {
    loan.disbursementBank = disbursementBank;
    loan.paymentMode = dto.paymentMode;
    loan.paymentType = dto.paymentType;
    loan.disbursementReferenceNo = dto.disbursementReferenceNo ?? null;
    loan.status = LOAN_STATUS.DISBURSED;
    const saved = await this.loanRepository.save(loan);

    // `DisbursementTransactionLog` has no relation back to `Loan` — `Loan`
    // FKs to it via `disbursementTransactionLog`/`disbursementTransactionLogId`
    // (see that column's doc comment), so the log is created first and the
    // loan updated to point at it afterward.
    const log = this.disbursementTransactionLogRepository.create({
      lead: loan.lead,
      bank: disbursementBank,
      referenceNo: dto.disbursementReferenceNo ?? loan.loanNumber,
      paymentMode: dto.paymentMode,
      paymentType: dto.paymentType,
      status: DisbursementTransactionStatus.COMPLETE,
      createdAt: new Date(),
    });
    const savedLog = await this.disbursementTransactionLogRepository.save(log);

    saved.disbursementTransactionLog = savedLog;
    return this.loanRepository.save(saved);
  }

  /**
   * The real money path. Ordering is load-bearing and mirrors legacy:
   *
   *   1. write an INITIATED transaction row (so a crash mid-call still leaves
   *      a blocking record — the guard treats INITIATED as in-flight),
   *   2. call ICICI,
   *   3. map the outcome:
   *        SUCCESS  -> loan DISBURSED + bank reference, row COMPLETE
   *        REJECTED -> row FAILED, loan untouched (a retry is then allowed —
   *                    the only outcome where we know no money moved)
   *        UNKNOWN  -> row stays PENDING, loan untouched, and the guard now
   *                    blocks every further attempt until a human resolves it
   *                    via the status API.
   *
   * Legacy collapsed REJECTED and UNKNOWN into one `PENDING` write, blocking
   * retries even for calls that provably never left the building. The split
   * here is strictly safer in one direction only: nothing legacy treated as
   * blocking becomes retryable.
   */
  private async disburseOnlineViaIcici(
    loan: Loan,
    disbursementBank: DisbursementBank,
    dto: DisburseLoanDto,
    actingUserId?: number,
  ): Promise<Loan> {
    // Legacy's named-individual whitelist, before anything is written or sent.
    await this.assertAuthorisedToDisburseOnline(actingUserId);

    const banking = await this.customerBankingRepository.findOne({
      where: { lead: { id: loan.lead.id } },
      order: { id: 'DESC' },
    });
    if (!banking?.accountNumber || !banking.ifscCode) {
      throw new BadRequestException(
        'Please verify the customer banking details before disbursing.',
      );
    }
    const cam = await this.creditAnalysisMemoRepository.findOne({
      where: { lead: { id: loan.lead.id } },
    });
    const netDisbursalAmount = Number(cam?.netDisbursalAmount ?? 0);
    if (!netDisbursalAmount) {
      throw new BadRequestException('Loan amount cannot be zero or blank.');
    }
    if (!loan.loanNumber) {
      throw new BadRequestException(
        'Please generate a loan account number before disbursing.',
      );
    }

    // Legacy's hard rupee bounds on the *sanctioned* amount, ported verbatim.
    const loanAmount = Number(cam?.recommendedLoanAmount ?? 0);
    if (loanAmount < MIN_ONLINE_DISBURSAL_AMOUNT) {
      throw new BadRequestException(
        `Loan amount cannot be lesser than Rs. ${MIN_ONLINE_DISBURSAL_AMOUNT}.`,
      );
    }
    if (loanAmount > MAX_ONLINE_DISBURSAL_AMOUNT) {
      throw new BadRequestException(
        `Loan amount cannot be greater than Rs. ${MAX_ONLINE_DISBURSAL_AMOUNT}.`,
      );
    }

    const transactionReferenceNo = buildTransactionReferenceNo();
    const transaction = await this.disbursementTransactionLogRepository.save(
      this.disbursementTransactionLogRepository.create({
        lead: loan.lead,
        bank: disbursementBank,
        referenceNo: transactionReferenceNo,
        paymentMode: dto.paymentMode,
        paymentType: dto.paymentType,
        status: DisbursementTransactionStatus.INITIATED,
        createdAt: new Date(),
      }),
    );

    let outcome: {
      outcome?: string;
      bankReferenceNo?: string | null;
      errors?: string | null;
    };
    try {
      outcome = await this.integrationsApiClient.post(
        '/icici-disbursement/disburse',
        {
          leadId: loan.lead.id,
          transactionReferenceNo,
          paymentType: dto.paymentType,
          amount: netDisbursalAmount,
          loanNumber: loan.loanNumber,
          beneficiaryAccountNumber: banking.accountNumber,
          beneficiaryIfscCode: banking.ifscCode,
          beneficiaryName: banking.beneficiaryName ?? loan.lead.firstName,
          disbursementBankId: disbursementBank.id,
          ...(actingUserId ? { requestedByUserId: actingUserId } : {}),
        },
      );
    } catch (error) {
      // No verdict came back at all. The request may still have reached ICICI,
      // so this is UNKNOWN: leave the row PENDING so the guard blocks retries.
      transaction.status = DisbursementTransactionStatus.PENDING;
      await this.disbursementTransactionLogRepository.save(transaction);
      this.logger.error(
        `ICICI disbursal outcome unknown for lead ${loan.lead.id}, transaction ${transactionReferenceNo}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      throw new ServiceUnavailableException(
        `Disbursal outcome is unknown for transaction ${transactionReferenceNo}. It is left pending — check with the bank before any retry.`,
      );
    }

    if (outcome.outcome === 'SUCCESS' && outcome.bankReferenceNo) {
      transaction.status = DisbursementTransactionStatus.COMPLETE;
      await this.disbursementTransactionLogRepository.save(transaction);

      loan.disbursementBank = disbursementBank;
      loan.paymentMode = dto.paymentMode;
      loan.paymentType = dto.paymentType;
      loan.disbursementReferenceNo = outcome.bankReferenceNo;
      loan.status = LOAN_STATUS.DISBURSED;
      loan.disbursementTransactionLog = transaction;
      return this.loanRepository.save(loan);
    }

    if (outcome.outcome === 'REJECTED') {
      transaction.status = DisbursementTransactionStatus.FAILED;
      await this.disbursementTransactionLogRepository.save(transaction);
      throw new BadRequestException(
        outcome.errors ?? 'ICICI rejected the disbursal.',
      );
    }

    // UNKNOWN — the dangerous case. Stay PENDING and block.
    transaction.status = DisbursementTransactionStatus.PENDING;
    await this.disbursementTransactionLogRepository.save(transaction);
    throw new ServiceUnavailableException(
      `Disbursal outcome is unknown for transaction ${transactionReferenceNo}: ${outcome.errors ?? 'no verdict from the bank'}. It is left pending — resolve it with the bank before any retry.`,
    );
  }

  async settle(leadId: number): Promise<Loan> {
    const loan = await this.findLoanByLead(leadId);
    loan.status = LOAN_STATUS.SETTLED;
    loan.settledAt = new Date();
    return this.loanRepository.save(loan);
  }

  async close(leadId: number): Promise<Loan> {
    const loan = await this.findLoanByLead(leadId);
    loan.status = LOAN_STATUS.CLOSED;
    loan.closedAt = new Date();
    return this.loanRepository.save(loan);
  }

  async writeOff(leadId: number): Promise<Loan> {
    const loan = await this.findLoanByLead(leadId);
    loan.status = LOAN_STATUS.WRITTEN_OFF;
    loan.writtenOffAt = new Date();
    return this.loanRepository.save(loan);
  }

  // Disbursement transaction logs (one per disbursal API attempt)
  async listTransactions(
    leadId: number,
  ): Promise<DisbursementTransactionLog[]> {
    await findOrFail(this.leadRepository, leadId, 'Lead');
    return this.disbursementTransactionLogRepository.find({
      where: { lead: { id: leadId } },
      relations: { bank: true },
      order: { id: 'DESC' },
    });
  }

  async createTransaction(
    leadId: number,
    dto: CreateDisbursementTransactionDto,
  ): Promise<DisbursementTransactionLog> {
    const lead = await findOrFail(this.leadRepository, leadId, 'Lead');
    const bank = await findOrFail(
      this.disbursementBankRepository,
      dto.disbursementBankId,
      'Disbursement bank',
    );
    const log = this.disbursementTransactionLogRepository.create({
      lead,
      bank,
      referenceNo: dto.referenceNo,
      status: dto.status,
      createdAt: new Date(),
    });
    return this.disbursementTransactionLogRepository.save(log);
  }

  async removeTransaction(
    leadId: number,
    transactionId: number,
  ): Promise<void> {
    const lead = await this.leadRepository.findOne({
      where: { id: leadId },
      relations: { leadStatus: true },
    });
    if (!lead) {
      throw new NotFoundException(`Lead ${leadId} not found`);
    }
    assertLeadEditableBySupport(lead);

    const transaction = await this.disbursementTransactionLogRepository.findOne(
      { where: { id: transactionId, lead: { id: leadId } } },
    );
    if (!transaction) {
      throw new NotFoundException(
        `Transaction ${transactionId} not found for lead ${leadId}`,
      );
    }
    transaction.isActive = false;
    transaction.isDeleted = true;
    await this.disbursementTransactionLogRepository.save(transaction);
  }
}
