import {
  calculateLoanRepayment,
  findOrFail,
  type LoanRepaymentDetails,
} from '@finance-crm/common';
import {
  BlacklistReason,
  Collection,
  CollectionVerificationStatus,
  CreditAnalysisMemo,
  CustomerBlacklist,
  EmailTemplate,
  FollowupStatus,
  FollowupType,
  Lead,
  LeadCustomer,
  LeadFollowup,
  LeadUserType,
  Loan,
  LoanCollectionFollowup,
  LoanCollectionVisit,
  MasterStatus,
  PaymentMode,
  SmsTemplate,
  User,
} from '@finance-crm/database';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { AssignCollectionVisitDto } from './dto/assign-collection-visit.dto';
import { CreateCollectionFollowupDto } from './dto/create-collection-followup.dto';
import { CreateCollectionVisitDto } from './dto/create-collection-visit.dto';
import { CreateCustomerBlacklistDto } from './dto/create-customer-blacklist.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdateCollectionVisitStatusDto } from './dto/update-collection-visit-status.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';

/** `UpdatePayment()`'s AC1-branch gate — legacy's real `loan.loan_status_id`
 * FK isn't mapped here (only the free-string `Loan.status`, same value
 * space as `Lead.legacyStatus`); `loan_status_id = 14` is this schema's
 * `status === 'DISBURSED'`. */
const LOAN_DISBURSED_STATUS = 'DISBURSED';
/**
 * `UpdatePayment()`'s AC1 branch hardcodes repayment-type ids 16/17/18 for
 * Full-Payment/Settle/Writeoff — real legacy `master_status.status_id`
 * values that this schema's auto-incremented ids don't reliably preserve
 * (confirmed in the disbursal-reports audit, `docs/COMPLETED.md`). Resolved
 * by name instead; `Collection.repaymentTypeId` already stores THIS
 * schema's `MasterStatus.id` (see `createPayment()`'s doc comment), not
 * legacy's number.
 */
const REPAYMENT_STATUS_NAME = {
  CLOSED: 'CLOSED',
  SETTLED: 'SETTLED',
  WRITEOFF: 'WRITEOFF',
} as const;

function startOfDayMs(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Legacy's local convention on `CollectionController::
 * get_followup_template_lists()` (`2=>SMS, 3=>WHATSAPP, 4=>EMAIL`) — not
 * `master_followup_type` row ids. */
const FOLLOWUP_TEMPLATE_TYPE = {
  SMS: 2,
  WHATSAPP: 3,
  EMAIL: 4,
} as const;

/** `UpdatePayment()`'s role-conditional required fields: these roles
 * (recording a payment) require `scm_remarks`; `AC1` (verifying one)
 * requires `ops_remarks` (`date_of_recived` isn't re-collected here —
 * this port already captures `receivedDate` at creation, not at verify
 * time, so there's nothing to require it against). Exported so
 * `PaymentsController` can gate the two actions with the same real
 * legacy role sets, not a separately-maintained guess. */
export const PAYMENT_REMARKS_REQUIRED_ROLES = [
  'CO1',
  'CO2',
  'CR2',
  'CAGY',
  'CO4',
];
export const PAYMENT_VERIFIER_ROLE = 'AC1';

/** `master_sms_template`/`master_email_template`'s own `m_st_type_id`/
 * `m_et_type_id` convention (`1=>collection`) — a different axis from
 * `FOLLOWUP_TEMPLATE_TYPE` above (SMS vs. email vs. WhatsApp), always `1`
 * for the collection-followup use case. */
const TEMPLATE_CATALOG_TYPE_COLLECTION = 1;

@Injectable()
export class CollectionService {
  constructor(
    @InjectRepository(Collection)
    private readonly collectionRepository: Repository<Collection>,
    @InjectRepository(PaymentMode)
    private readonly paymentModeRepository: Repository<PaymentMode>,
    @InjectRepository(FollowupType)
    private readonly followupTypeRepository: Repository<FollowupType>,
    @InjectRepository(FollowupStatus)
    private readonly followupStatusRepository: Repository<FollowupStatus>,
    @InjectRepository(BlacklistReason)
    private readonly blacklistReasonRepository: Repository<BlacklistReason>,
    @InjectRepository(LoanCollectionFollowup)
    private readonly loanCollectionFollowupRepository: Repository<LoanCollectionFollowup>,
    @InjectRepository(LoanCollectionVisit)
    private readonly loanCollectionVisitRepository: Repository<LoanCollectionVisit>,
    @InjectRepository(CustomerBlacklist)
    private readonly customerBlacklistRepository: Repository<CustomerBlacklist>,
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(LeadCustomer)
    private readonly leadCustomerRepository: Repository<LeadCustomer>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(SmsTemplate)
    private readonly smsTemplateRepository: Repository<SmsTemplate>,
    @InjectRepository(EmailTemplate)
    private readonly emailTemplateRepository: Repository<EmailTemplate>,
    @InjectRepository(CreditAnalysisMemo)
    private readonly creditAnalysisMemoRepository: Repository<CreditAnalysisMemo>,
    @InjectRepository(Loan)
    private readonly loanRepository: Repository<Loan>,
    @InjectRepository(LeadFollowup)
    private readonly leadFollowupRepository: Repository<LeadFollowup>,
    @InjectRepository(MasterStatus)
    private readonly masterStatusRepository: Repository<MasterStatus>,
    private readonly configService: ConfigService,
  ) {}

  // Lookups
  listPaymentModes(): Promise<PaymentMode[]> {
    return this.paymentModeRepository.find({
      where: { isActive: true },
      order: { id: 'ASC' },
    });
  }

  listFollowupTypes(): Promise<FollowupType[]> {
    return this.followupTypeRepository.find({
      where: { isActive: true },
      order: { id: 'ASC' },
    });
  }

  listFollowupStatuses(): Promise<FollowupStatus[]> {
    return this.followupStatusRepository.find({
      where: { isActive: true },
      order: { id: 'ASC' },
    });
  }

  listBlacklistReasons(): Promise<BlacklistReason[]> {
    return this.blacklistReasonRepository.find({
      where: { isActive: true },
      order: { id: 'ASC' },
    });
  }

  /**
   * Ports `Collection_Model::get_template_lists()`'s SMS/email dispatch.
   * WhatsApp (`FOLLOWUP_TEMPLATE_TYPE.WHATSAPP`) always returns empty —
   * legacy's own `get_whatsapp_template_lists()` is called but never
   * defined anywhere in the codebase (a PHP fatal error if ever hit), and
   * the frontend has an empty branch for it too. `master_whatsapp_template`
   * never existed; this isn't a gap this port left open, legacy never
   * finished it.
   */
  async listFollowupTemplates(
    typeId: number,
  ): Promise<Array<SmsTemplate | EmailTemplate>> {
    if (typeId === FOLLOWUP_TEMPLATE_TYPE.SMS) {
      return this.smsTemplateRepository.find({
        where: {
          typeId: TEMPLATE_CATALOG_TYPE_COLLECTION,
          isActive: true,
          isDeleted: false,
        },
        order: { id: 'ASC' },
      });
    }
    if (typeId === FOLLOWUP_TEMPLATE_TYPE.EMAIL) {
      return this.emailTemplateRepository.find({
        where: {
          typeId: TEMPLATE_CATALOG_TYPE_COLLECTION,
          isActive: true,
          isDeleted: false,
        },
        order: { id: 'ASC' },
      });
    }
    return [];
  }

  /**
   * Ports `Collection_Model::get_sms_template_content()`/
   * `get_email_template_content()`'s merge-field substitution — real
   * per-lead data for both, joined the same way legacy's SMS path does
   * (active loan + active CAM for the lead). **Not a faithful port of the
   * email path**: legacy's `get_email_template_content()` never actually
   * uses its own `$lead_id` parameter — it substitutes hardcoded preview
   * values (`"NFPL01"`/`"Manish"`/`"1000"`/a fixed date) regardless of
   * which lead is being viewed, and `{#PAYMENT_LINK#}` is actually the
   * `BRAND_NAME` env var (a legacy `WEBSITE` constant misnamed for what it
   * holds), not a URL. Per this project's "real adapters, not mocks"
   * principle (see `EnachService`), this port does the real merge for
   * email too instead of reproducing the dummy-data stub; `{#PAYMENT_LINK#}`
   * still resolves to the company name (`COMPANY_NAME`), matching legacy's
   * actual behavior rather than fabricating a URL that doesn't exist
   * anywhere in this system.
   */
  async renderFollowupTemplateContent(
    leadId: number,
    templateId: number,
    typeId: number,
  ): Promise<{ subject: string | null; content: string }> {
    if (typeId === FOLLOWUP_TEMPLATE_TYPE.WHATSAPP) {
      throw new NotFoundException('No WhatsApp followup templates exist.');
    }

    const isEmail = typeId === FOLLOWUP_TEMPLATE_TYPE.EMAIL;
    const template = isEmail
      ? await this.emailTemplateRepository.findOne({
          where: {
            id: templateId,
            typeId: TEMPLATE_CATALOG_TYPE_COLLECTION,
            isActive: true,
            isDeleted: false,
          },
        })
      : await this.smsTemplateRepository.findOne({
          where: {
            id: templateId,
            typeId: TEMPLATE_CATALOG_TYPE_COLLECTION,
            isActive: true,
            isDeleted: false,
          },
        });
    if (!template) {
      throw new NotFoundException(`Followup template ${templateId} not found`);
    }

    const loan = await this.loanRepository.findOne({
      where: { lead: { id: leadId }, isActive: true },
    });
    const leadCustomer = await this.leadCustomerRepository.findOne({
      where: { lead: { id: leadId }, isActive: true },
    });
    const cam = await this.creditAnalysisMemoRepository.findOne({
      where: { lead: { id: leadId }, isActive: true },
    });

    const customerName = [
      leadCustomer?.firstName,
      leadCustomer?.middleName,
      leadCustomer?.surName,
    ]
      .filter((part): part is string => Boolean(part))
      .join(' ');

    const substitutions: Record<string, string> = {
      '{#LOAN_NO#}': loan?.loanNumber ?? '',
      '{#CUSTOMER_NAME#}': customerName,
      '{#REPAY_AMOUNT#}': cam?.repaymentAmount?.toString() ?? '',
      '{#REPAY_DATE#}': cam?.repaymentDate?.toString() ?? '',
      '{#PAYMENT_LINK#}': this.configService.get<string>('COMPANY_NAME', ''),
    };
    const render = (text: string): string =>
      Object.entries(substitutions).reduce(
        (acc, [token, value]) => acc.split(token).join(value),
        text,
      );

    if (isEmail) {
      const emailTemplate = template as EmailTemplate;
      return {
        subject: render(emailTemplate.title),
        content: render(emailTemplate.content),
      };
    }
    return {
      subject: null,
      content: render((template as SmsTemplate).content),
    };
  }

  // Payments
  async listPayments(leadId: number): Promise<Collection[]> {
    await findOrFail(this.leadRepository, leadId, 'Lead');
    return this.collectionRepository.find({
      where: { lead: { id: leadId } },
      relations: {
        paymentMode: true,
        collectionExecutive: true,
        closedBy: true,
      },
      order: { id: 'DESC' },
    });
  }

  async createPayment(
    leadId: number,
    dto: CreatePaymentDto,
    actingUserId: number,
    actingUserRoles: string[] = [],
  ): Promise<Collection> {
    if (
      actingUserRoles.some((role) =>
        PAYMENT_REMARKS_REQUIRED_ROLES.includes(role),
      ) &&
      !dto.remarks?.trim()
    ) {
      throw new BadRequestException('SCM Remarks is required.');
    }

    const lead = await findOrFail(this.leadRepository, leadId, 'Lead');
    const collectionExecutive = await findOrFail(
      this.userRepository,
      actingUserId,
      'User',
    );

    // Ports `CollectionController::UpdatePayment()`'s duplicate-reference
    // guard ("Duplicate payment not allowed.") — a global check across all
    // leads, not scoped to this one, matching legacy's unscoped
    // `WHERE refrence_no = '$refrence_no'`.
    const duplicate = await this.collectionRepository.findOne({
      where: { referenceNo: dto.referenceNo },
    });
    if (duplicate) {
      throw new ConflictException(
        `Payment reference "${dto.referenceNo}" has already been recorded.`,
      );
    }

    const payment = this.collectionRepository.create({
      lead,
      collectionExecutive,
      loanNumber: dto.loanNumber,
      // `Collection.repaymentTypeId` is a plain varchar column mirroring
      // `master_status.status_id` (legacy stores it as a numeric string
      // against an int PK, not a real FK — see that column's doc comment).
      repaymentTypeId: String(dto.repaymentTypeId),
      receivedAmount: dto.receivedAmount,
      // `discount`/`remarks` are NOT NULL with no default in the real legacy
      // schema (unlike the pre-rewrite entity, which allowed both to be
      // omitted).
      discount: dto.discount ?? 0,
      refund: dto.refund ?? null,
      referenceNo: dto.referenceNo,
      receivedDate: dto.receivedDate ? new Date(dto.receivedDate) : null,
      remarks: dto.remarks ?? '',
      createdAt: new Date(),
      paymentMode: dto.paymentModeId
        ? await findOrFail(
            this.paymentModeRepository,
            dto.paymentModeId,
            'Payment mode',
          )
        : null,
    });
    const saved = await this.collectionRepository.save(payment);

    // Ports `UpdatePayment()`'s `lead_followup` write — legacy resolves
    // the followup's status/stage from the selected repayment type's
    // `master_status` row, not the lead's own current status.
    const repaymentStatus = await this.masterStatusRepository.findOneBy({
      id: dto.repaymentTypeId,
    });
    await this.leadFollowupRepository.save(
      this.leadFollowupRepository.create({
        lead,
        user: collectionExecutive,
        status: repaymentStatus,
        remarks: `Update for ${repaymentStatus?.name ?? dto.repaymentTypeId} | ${dto.remarks ?? ''}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    return saved;
  }

  /**
   * Ports `CommonComponent::get_loan_repayment_details()` →
   * `LeadModel::getLoanRepaymentDetails()` (353 lines,
   * `components/classes/model/LeadModel.class.php:640`) — the loan-closure
   * reconciliation engine `CollectionController::UpdatePayment()`'s AC1
   * branch depends on to hard-reject a mismatched full-payment/settle/
   * writeoff amount (see `verifyPayment()`). Every quirk below is a
   * faithful port of what legacy actually does, not a guess:
   *
   * - The "which loan/collection rows count" gate is `loan_status_id = 14`
   *   (`LOAN_DISBURSED_STATUS` here) — if the loan isn't currently
   *   DISBURSED, legacy's whole detail block never runs and every
   *   payable/received/outstanding figure comes back 0 (only
   *   `loanRecommended`/`leadId`/`status`/`isBlacklisted` still populate).
   *   Replicated via `gatePassed` below rather than returning early, since
   *   legacy still persists the (zeroed) figures back onto `loan`
   *   regardless.
   * - Legacy computes the loan's discount amounts TWICE with the same
   *   variable names, so the second silently shadows the first: the first
   *   pass (using whatever discount is *currently stored* on `loan`) feeds
   *   the principal/interest/penalty received-vs-pending split and
   *   `total_due_amount`; a second, unconditional pass right before the
   *   function returns recomputes discount from scratch by comparing the
   *   scheduled repayment amount against a "real interest" scenario, and
   *   *that* value is what gets both returned and persisted back onto
   *   `loan`. Kept as distinctly-named locals here (`stored*Discount` vs.
   *   `final*Discount`) to avoid reproducing the shadowing while still
   *   matching which round feeds which output.
   * - Persists back onto `Loan` (payable/received/outstanding/discount)
   *   and `CreditAnalysisMemo` (tenure/repaymentAmount/disbursalDate) on
   *   *every* call, exactly like legacy — even a read-only preview mutates
   *   state. This is also what keeps the figures self-refreshing without a
   *   dedicated cron job (see `docs/TODO.md`'s history on the missing
   *   `calculationAllLoans()` nightly job) — every verification or preview
   *   call now keeps `loan`'s outstanding fields current for that one
   *   lead, though a lead nobody looks at still won't recompute daily.
   */
  async calculateRepaymentDetails(
    leadId: number,
  ): Promise<LoanRepaymentDetails> {
    const lead = await findOrFail(this.leadRepository, leadId, 'Lead');
    const cam = await this.creditAnalysisMemoRepository.findOne({
      where: { lead: { id: leadId }, isActive: true },
    });
    const loan = await this.loanRepository.findOne({
      where: { lead: { id: leadId } },
    });
    const loanRecommended = cam?.recommendedLoanAmount ?? 0;
    const gatePassed = Boolean(
      loan && loan.status === LOAN_DISBURSED_STATUS && cam,
    );

    let terminalCollection: {
      receivedDate: Date | null;
      closedAt: Date | null;
    } | null = null;
    let totalReceivedAmount = 0;
    if (gatePassed) {
      const statuses = await this.resolveClosureStatuses();
      const [firstSettled, firstClosed, firstWrittenOff] = await Promise.all([
        this.findFirstVerifiedCollectionByType(leadId, statuses.settled),
        this.findFirstVerifiedCollectionByType(leadId, statuses.closed),
        this.findFirstVerifiedCollectionByType(leadId, statuses.writtenOff),
      ]);
      // Priority settle > close > writeoff — matches legacy's execution
      // order (checked 17 then 16 then 18; whichever query matches first
      // locks the "date of receive" flag and later blocks never overwrite it).
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
      loanNumber: loan?.loanNumber ?? null,
      isBlacklisted: lead.isBlacklisted,
      leadStatusName: lead.leadStatus?.name ?? null,
      gatePassed,
      finalDisbursedAt: lead.finalDisbursedAt,
      loanRecommended,
      roi: cam?.roi ?? null,
      repaymentAmount: cam?.repaymentAmount ?? null,
      repaymentDate: cam?.repaymentDate ?? null,
      advanceInterestAmount: cam?.advanceInterestAmount ?? null,
      storedPrincipalDiscount: loan?.principalDiscount ?? 0,
      storedInterestDiscount: loan?.interestDiscount ?? 0,
      storedPenaltyDiscount: loan?.penaltyDiscount ?? 0,
      storedTotalDiscount: loan?.totalDiscount ?? 0,
      terminalCollection,
      totalReceivedAmount,
    });

    if (loan) {
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
        await this.creditAnalysisMemoRepository.update(
          { lead: { id: leadId } },
          camUpdate,
        );
      }
    }

    return details;
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
        'Missing CLOSED/SETTLED/WRITEOFF master_status rows — cannot reconcile payments.',
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

  /**
   * Ports the `agent == 'AC1'` branch of `CollectionController::
   * UpdatePayment()` — the real "verify a collected payment" action
   * (confirmed live; the separate `verifyCustomerPayment()` is dead code
   * against a `recovery` table that doesn't exist in the real schema).
   *
   * On approval (`dto.verificationStatus === APPROVED`), legacy *always*
   * resets the loan's discount fields, recomputes them via
   * `calculateRepaymentDetails()`, and transitions the lead's status to
   * the payment's own `repaymentTypeId` — for *every* repayment type, not
   * just closures. Only the **amount hard-reject** is specific to
   * Full-Payment/Settle/Writeoff (`CLOSED`/`SETTLED`/`WRITEOFF`): legacy
   * rejects the verification outright (before touching the collection row
   * at all) unless `receivedAmount + discount [- refund]` exactly matches
   * the computed total repayment — the exact formula differs per type and
   * per whether verification happens before/after the scheduled repayment
   * date (see inline comments; `refund` is only subtracted in the
   * pre-due-date Full-Payment case — nowhere else, a real legacy quirk,
   * not an omission here).
   */
  async verifyPayment(
    leadId: number,
    paymentId: number,
    dto: VerifyPaymentDto,
    actingUserId: number,
    actingUserRoles: string[] = [],
  ): Promise<Collection> {
    if (
      actingUserRoles.includes(PAYMENT_VERIFIER_ROLE) &&
      !dto.closureRemarks?.trim()
    ) {
      throw new BadRequestException('OPs Remarks is required.');
    }

    const payment = await this.collectionRepository.findOne({
      where: { id: paymentId, lead: { id: leadId } },
    });
    if (!payment) {
      throw new NotFoundException(
        `Payment ${paymentId} not found for lead ${leadId}`,
      );
    }
    if (payment.verificationStatus !== CollectionVerificationStatus.PENDING) {
      throw new ConflictException(`Payment ${paymentId} is already verified.`);
    }

    // Segregation of duties: whoever recorded a payment cannot be the one who
    // approves it. Nothing enforced this before, and because RolesGuard's
    // ADMIN_OVERRIDE_ROLES lets SA/CA satisfy both `@Roles(...PAYMENT_
    // REMARKS_REQUIRED_ROLES)` on createPayment and `@Roles(PAYMENT_VERIFIER_
    // ROLE)` here, a single admin could book a collection against a loan and
    // sign it off in two requests — including the discount/refund figures
    // this method then writes into the loan's closure amounts.
    if (
      payment.collectionExecutiveId !== null &&
      Number(payment.collectionExecutiveId) === Number(actingUserId)
    ) {
      throw new ForbiddenException(
        'A payment cannot be verified by the user who recorded it.',
      );
    }

    let repaymentStatus: MasterStatus | null = null;
    if (dto.verificationStatus === CollectionVerificationStatus.APPROVED) {
      const statuses = await this.resolveClosureStatuses();
      const loan = await this.loanRepository.findOne({
        where: { lead: { id: leadId } },
      });

      // Legacy always resets discount to 0 before recomputing, regardless
      // of repayment type.
      if (loan) {
        loan.principalDiscount = 0;
        loan.interestDiscount = 0;
        loan.penaltyDiscount = 0;
        loan.totalDiscount = 0;
        await this.loanRepository.save(loan);
      }

      const repaymentDetails = await this.calculateRepaymentDetails(leadId);
      const receivedAmount = payment.receivedAmount;
      const discount = payment.discount ?? 0;
      const refund = payment.refund ?? 0;
      const totalPaymentReceived = repaymentDetails.totalReceivedAmount;
      const totalRepaymentAmount = repaymentDetails.totalRepaymentAmount;
      const repaymentAmountWithAdvance =
        repaymentDetails.repaymentAmount +
        repaymentDetails.advanceInterestAmountDeducted;
      const todayMs = startOfDayMs(new Date());
      const repaymentDateMs = repaymentDetails.repaymentDate
        ? startOfDayMs(repaymentDetails.repaymentDate)
        : null;

      const typeId = Number(payment.repaymentTypeId);
      let principalDiscountWrite = 0;
      let interestDiscountWrite = 0;
      let penaltyDiscountWrite = 0;

      if (typeId === statuses.closed) {
        if (repaymentDateMs !== null && todayMs <= repaymentDateMs) {
          const netWithRefund =
            totalPaymentReceived + receivedAmount + discount - refund;
          if (netWithRefund === totalRepaymentAmount) {
            interestDiscountWrite = discount;
          } else if (
            netWithRefund === repaymentDetails.repaymentWithRealInterest
          ) {
            // matches the "real interest" scenario — no discount recorded
          } else {
            throw new BadRequestException(
              `Loan closure amount(s) is incorrect. (${netWithRefund} vs ${totalRepaymentAmount})`,
            );
          }
        } else {
          // Post-due-date close: legacy has NO rejection here even when the
          // amounts don't reconcile (the `else { throw }` is commented out
          // in the real source) — replicated as-is, not "fixed".
          if (
            totalPaymentReceived + receivedAmount >=
              repaymentAmountWithAdvance &&
            totalPaymentReceived + receivedAmount + discount ===
              totalRepaymentAmount
          ) {
            penaltyDiscountWrite = discount;
          }
        }
      } else if (typeId === statuses.settled) {
        if (repaymentDateMs !== null && todayMs < repaymentDateMs) {
          throw new BadRequestException(
            'Loan cannot be settled as date of received is less than repayment date.',
          );
        }
        if (
          totalPaymentReceived + receivedAmount + discount ===
          totalRepaymentAmount
        ) {
          if (
            totalPaymentReceived + receivedAmount <
            repaymentAmountWithAdvance
          ) {
            principalDiscountWrite =
              repaymentAmountWithAdvance -
              (totalPaymentReceived + receivedAmount);
            penaltyDiscountWrite = discount - principalDiscountWrite;
          } else {
            penaltyDiscountWrite = discount;
          }
        } else {
          throw new BadRequestException('Loan settled amount is incorrect.');
        }
      } else if (typeId === statuses.writtenOff) {
        if (repaymentDateMs !== null && todayMs < repaymentDateMs) {
          throw new BadRequestException(
            'Loan cannot be settled as date of received is less than repayment date.',
          );
        }
      }

      if (loan) {
        loan.principalDiscount = principalDiscountWrite;
        loan.interestDiscount = interestDiscountWrite;
        loan.penaltyDiscount = penaltyDiscountWrite;
        loan.totalDiscount = discount;
        await this.loanRepository.save(loan);
      }

      repaymentStatus = await this.masterStatusRepository.findOneBy({
        id: typeId,
      });
    }

    payment.verificationStatus = dto.verificationStatus;
    if (dto.closureRemarks !== undefined)
      payment.closureRemarks = dto.closureRemarks;
    const closedBy = await findOrFail(
      this.userRepository,
      actingUserId,
      'User',
    );
    payment.closedBy = closedBy;
    payment.closedAt = new Date();
    const saved = await this.collectionRepository.save(payment);

    if (dto.verificationStatus === CollectionVerificationStatus.APPROVED) {
      const lead = await findOrFail(this.leadRepository, leadId, 'Lead');
      lead.leadStatus = repaymentStatus;
      await this.leadRepository.save(lead);

      await this.leadFollowupRepository.save(
        this.leadFollowupRepository.create({
          lead,
          user: closedBy,
          status: repaymentStatus,
          remarks: `Approved for ${repaymentStatus?.name ?? payment.repaymentTypeId} | ${dto.closureRemarks ?? ''}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );

      // Cross-lead side effect: a customer who's now fully repaid one loan
      // becomes eligible as a repeat borrower — flips the single most
      // recent OTHER lead with the same PAN still marked UNPAID-REPEAT.
      if (lead.pancard) {
        const repeatCandidate = await this.leadRepository.findOne({
          where: {
            pancard: lead.pancard,
            userType: LeadUserType.UNPAID_REPEAT,
            isActive: true,
          },
          order: { id: 'DESC' },
        });
        if (repeatCandidate) {
          repeatCandidate.userType = LeadUserType.REPEAT;
          await this.leadRepository.save(repeatCandidate);
        }
      }

      // Refresh the loan's payable/received/outstanding figures now that
      // the final discount is in place — matches legacy's trailing
      // `calculateRepaymentAmount()` call.
      await this.calculateRepaymentDetails(leadId);
    }

    return saved;
  }

  // Collection follow-ups
  async listFollowups(leadId: number): Promise<LoanCollectionFollowup[]> {
    await findOrFail(this.leadRepository, leadId, 'Lead');
    return this.loanCollectionFollowupRepository.find({
      where: { lead: { id: leadId } },
      relations: { type: true, status: true, user: true },
      order: { id: 'DESC' },
    });
  }

  async createFollowup(
    leadId: number,
    dto: CreateCollectionFollowupDto,
    actingUserId: number,
  ): Promise<LoanCollectionFollowup> {
    const lead = await findOrFail(this.leadRepository, leadId, 'Lead');
    const user = await findOrFail(this.userRepository, actingUserId, 'User');
    const type = await findOrFail(
      this.followupTypeRepository,
      dto.typeId,
      'Followup type',
    );
    const status = dto.statusId
      ? await findOrFail(
          this.followupStatusRepository,
          dto.statusId,
          'Followup status',
        )
      : null;

    const followup = this.loanCollectionFollowupRepository.create({
      lead,
      user,
      type,
      status,
      remarks: dto.remarks ?? null,
      nextFollowupAt: dto.nextFollowupAt ? new Date(dto.nextFollowupAt) : null,
      createdAt: new Date(),
    });
    return this.loanCollectionFollowupRepository.save(followup);
  }

  // Collection visits
  async listVisits(leadId: number): Promise<LoanCollectionVisit[]> {
    await findOrFail(this.leadRepository, leadId, 'Lead');
    return this.loanCollectionVisitRepository.find({
      where: { lead: { id: leadId } },
      relations: { requestedBy: true, allocatedTo: true },
      order: { id: 'DESC' },
    });
  }

  async createVisit(
    leadId: number,
    dto: CreateCollectionVisitDto,
    actingUserId: number,
  ): Promise<LoanCollectionVisit> {
    const lead = await findOrFail(this.leadRepository, leadId, 'Lead');
    const requestedBy = await findOrFail(
      this.userRepository,
      actingUserId,
      'User',
    );

    const visit = this.loanCollectionVisitRepository.create({
      lead,
      requestedBy,
      visitAddress: dto.visitAddress ?? null,
      remarks: dto.remarks ?? null,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
      createdAt: new Date(),
    });
    return this.loanCollectionVisitRepository.save(visit);
  }

  async assignVisit(
    leadId: number,
    visitId: number,
    dto: AssignCollectionVisitDto,
  ): Promise<LoanCollectionVisit> {
    const visit = await this.getVisitOrFail(leadId, visitId);
    visit.allocatedTo = await findOrFail(
      this.userRepository,
      dto.allocatedToUserId,
      'User',
    );
    return this.loanCollectionVisitRepository.save(visit);
  }

  async updateVisitStatus(
    leadId: number,
    visitId: number,
    dto: UpdateCollectionVisitStatusDto,
  ): Promise<LoanCollectionVisit> {
    const visit = await this.getVisitOrFail(leadId, visitId);
    if (dto.remarks !== undefined) visit.remarks = dto.remarks;
    if (dto.rejectReason !== undefined) visit.rejectReason = dto.rejectReason;
    if (dto.completed) visit.completedAt = new Date();
    return this.loanCollectionVisitRepository.save(visit);
  }

  private async getVisitOrFail(
    leadId: number,
    visitId: number,
  ): Promise<LoanCollectionVisit> {
    const visit = await this.loanCollectionVisitRepository.findOne({
      where: { id: visitId, lead: { id: leadId } },
    });
    if (!visit) {
      throw new NotFoundException(
        `Visit ${visitId} not found for lead ${leadId}`,
      );
    }
    return visit;
  }

  // Customer blacklist
  async listBlacklistEntries(leadId: number): Promise<CustomerBlacklist[]> {
    await findOrFail(this.leadRepository, leadId, 'Lead');
    return this.customerBlacklistRepository.find({
      where: { lead: { id: leadId } },
      relations: { reason: true, createdBy: true },
      order: { id: 'DESC' },
    });
  }

  async blacklistLead(
    leadId: number,
    dto: CreateCustomerBlacklistDto,
    actingUserId: number,
  ): Promise<CustomerBlacklist> {
    await findOrFail(this.leadRepository, leadId, 'Lead');
    const lead = (await this.leadRepository.findOne({
      where: { id: leadId },
      relations: { leadStatus: true },
    })) as Lead;
    // Ports `CollectionController::addToBlackList()`'s guard against
    // double-blacklisting ("Application already added in black list.").
    if (lead.isBlacklisted) {
      throw new ConflictException(`Lead ${leadId} is already blacklisted.`);
    }
    const createdBy = await findOrFail(
      this.userRepository,
      actingUserId,
      'User',
    );
    const customer = await this.leadCustomerRepository.findOne({
      where: { lead: { id: leadId } },
    });
    const reason = dto.reasonId
      ? await findOrFail(
          this.blacklistReasonRepository,
          dto.reasonId,
          'Blacklist reason',
        )
      : null;

    const entry = this.customerBlacklistRepository.create({
      lead,
      createdBy,
      reason,
      remarks: dto.remarks ?? null,
      firstName: customer?.firstName ?? null,
      dob: customer?.dob ?? null,
      // `CustomerBlacklist.pancard`/`.email` are NOT NULL in the real legacy
      // schema even though `Lead.pancard`/`.email` are nullable — blacklisting
      // is only meaningful once both are on file, so this assumes the caller
      // has already collected them.
      pancard: lead.pancard ?? '',
      mobile: lead.mobile,
      alternateMobile: customer?.alternateMobile ?? null,
      email: lead.email ?? '',
      alternateEmail: customer?.alternateEmail ?? null,
      createdAt: new Date(),
    });
    const saved = await this.customerBlacklistRepository.save(entry);

    lead.isBlacklisted = true;
    await this.leadRepository.save(lead);

    // Ports `addToBlackList()`'s `lead_followup` write — reuses the lead's
    // *current* status/stage (not a transition), matching legacy.
    await this.leadFollowupRepository.save(
      this.leadFollowupRepository.create({
        lead,
        user: createdBy,
        status: lead.leadStatus,
        remarks: `Application has been black listed.\nBlacklist Reason : ${reason?.name ?? ''}\nExecutive Remark : ${dto.remarks ?? ''}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    return saved;
  }
}
