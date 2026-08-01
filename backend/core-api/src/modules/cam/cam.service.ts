import {
  adjustForNonWorkingDay,
  findOrFail,
  type WorkingDayDirection,
} from '@finance-crm/common';
import {
  CamStatus,
  CifCustomer,
  CreditAnalysisMemo,
  Lead,
  LeadCustomer,
  LeadEmployment,
  LeadFollowup,
  LeadUserType,
  MasterStatus,
  User,
} from '@finance-crm/database';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { CompanyHolidaysService } from '../company/company-holidays.service';
import { SendBackCamDto } from './dto/send-back-cam.dto';
import { UpsertCamDto } from './dto/upsert-cam.dto';

const CIF_NUMBER_PREFIX = 'FTC';
const CIF_NUMBER_DIGITS = 8;

/** Ports `CAMController::reEditCAM()` — legacy writes `status = "SEND BACK"`
 * to both the lead and the CAM row. This schema collapses legacy's
 * `status`/`stage`/`lead_status_id` into one `MasterStatus` FK — the
 * closest seeded equivalent is `APPLICATION-SEND-BACK` (same status name
 * `AuditService.sendToPreAudit()`'s own send-back path already uses). */
const APPLICATION_SEND_BACK = 'APPLICATION-SEND-BACK';

/** Legacy `savePaydayCAMDetails()` only allows a CAM save while the lead is
 * in one of `lead_status_id in (5, 6, 11)` — confirmed against
 * `LEAD_STATUS_CODES`' 1-indexed ordering (`Lead.ts`), which independently
 * lines up with two other already-verified ids elsewhere in this codebase
 * (`SYSTEM-REJECT`=8, `REJECT`=9). */
const CAM_EDITABLE_STATUSES = [
  'APPLICATION-INPROCESS',
  'APPLICATION-HOLD',
  'APPLICATION-SEND-BACK',
];

/** Legacy's flat `FOIR_PERCENTAGE` constant (`config.php:265-268`), same
 * one `bre-evaluation.service.ts`'s `finalFoirPercentage` rule uses — not
 * the dead city/salary-tiered table from `bre_quote_engine()`. */
const FOIR_PERCENTAGE = { NEW: 0.45, REPEAT: 0.5 };

@Injectable()
export class CamService {
  constructor(
    @InjectRepository(CreditAnalysisMemo)
    private readonly creditAnalysisMemoRepository: Repository<CreditAnalysisMemo>,
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(CifCustomer)
    private readonly cifCustomerRepository: Repository<CifCustomer>,
    @InjectRepository(MasterStatus)
    private readonly masterStatusRepository: Repository<MasterStatus>,
    @InjectRepository(LeadFollowup)
    private readonly leadFollowupRepository: Repository<LeadFollowup>,
    @InjectRepository(LeadCustomer)
    private readonly leadCustomerRepository: Repository<LeadCustomer>,
    @InjectRepository(LeadEmployment)
    private readonly leadEmploymentRepository: Repository<LeadEmployment>,
    private readonly companyHolidaysService: CompanyHolidaysService,
    private readonly configService: ConfigService,
  ) {}

  async findByLead(leadId: number): Promise<CreditAnalysisMemo> {
    const cam = await this.creditAnalysisMemoRepository.findOne({
      where: { lead: { id: leadId } },
      relations: { lead: true, sanctionedBy: true },
    });
    if (!cam) {
      throw new NotFoundException(`No CAM found for lead ${leadId}`);
    }
    return cam;
  }

  /**
   * `enforceStatusGate` defaults to true for the normal CAM-entry flow
   * (`CamController`). `SupportService.overrideCamDetail()` passes false:
   * legacy's own support-override path (`SupportController::
   * updateCAMDetail()`) is a narrower, separate action gated by the much
   * wider `$allow_status_id` list (`assertLeadEditableBySupport`, already
   * enforced by its caller), not `savePaydayCAMDetails()`'s 3-status gate —
   * applying the narrower gate here would wrongly block legitimate support
   * fixes on e.g. a SANCTION or DISBURSAL-stage lead. The loan-amount caps
   * stay in effect either way — real ₹ limits, not a workflow-stage rule.
   */
  async upsert(
    leadId: number,
    dto: UpsertCamDto,
    enforceStatusGate = true,
  ): Promise<CreditAnalysisMemo> {
    await findOrFail(this.leadRepository, leadId, 'Lead');
    const lead = (await this.leadRepository.findOne({
      where: { id: leadId },
      relations: { leadStatus: true },
    })) as Lead;
    if (enforceStatusGate) {
      await this.assertEditable(lead);
      await this.assertMandatoryAddressFields(leadId);
    }
    await this.assertWithinLoanLimits(lead, dto);

    let cam = await this.creditAnalysisMemoRepository.findOne({
      where: { lead: { id: leadId } },
    });
    if (!cam) {
      cam = this.creditAnalysisMemoRepository.create({
        lead,
        status: CamStatus.DRAFT,
        createdAt: new Date(),
      });
    }

    cam.recommendedLoanAmount = dto.recommendedLoanAmount;
    cam.roi = dto.roi;
    if (dto.penalRoi !== undefined) cam.penalRoi = dto.penalRoi;
    cam.tenureDays = dto.tenureDays;
    if (dto.processingFeePercent !== undefined)
      cam.processingFeePercent = dto.processingFeePercent;
    if (dto.adminFee !== undefined) cam.adminFee = dto.adminFee;
    cam.netDisbursalAmount = dto.netDisbursalAmount;
    cam.repaymentAmount = dto.repaymentAmount;
    if (dto.disbursalDate !== undefined)
      cam.disbursalDate = new Date(dto.disbursalDate);
    if (dto.repaymentDate !== undefined) {
      cam.repaymentDate = new Date(
        await this.resolveWorkingRepaymentDate(dto.repaymentDate),
      );
    }
    if (dto.eligibleFoirPercentage !== undefined)
      cam.eligibleFoirPercentage = dto.eligibleFoirPercentage;
    if (dto.finalFoirPercentage !== undefined)
      cam.finalFoirPercentage = dto.finalFoirPercentage;
    cam.appraisedMonthlyIncome = dto.appraisedMonthlyIncome;
    cam.appraisedObligations = dto.appraisedObligations;
    if (dto.riskProfile !== undefined) cam.riskProfile = dto.riskProfile;
    if (dto.riskScore !== undefined) cam.riskScore = dto.riskScore;
    if (dto.remarks !== undefined) cam.remarks = dto.remarks;
    cam.updatedAt = new Date();

    return this.creditAnalysisMemoRepository.save(cam);
  }

  /** Ports `CAMController::savePaydayCAMDetails()`'s
   * `in_array($lead_status_id, array(5, 6, 11))` gate. */
  private async assertEditable(lead: Lead): Promise<void> {
    const statuses = await this.masterStatusRepository.find({
      where: { name: In(CAM_EDITABLE_STATUSES) },
    });
    const editableIds = new Set(statuses.map((s) => s.id));
    if (!lead.leadStatus || !editableIds.has(lead.leadStatus.id)) {
      throw new BadRequestException(
        'CAM can only be saved while the lead is in credit review (in-process, hold, or sent back).',
      );
    }
  }

  /**
   * Ports `CAMController::savePaydayCAMDetails()`'s mandatory residence/
   * Aadhaar/office address fields (lines 678-698). The Aadhaar-address
   * columns (`aa_current_house`/`aa_current_locality`/`aa_current_city_id`/
   * `aa_current_state_id`/`aa_cr_residence_pincode`) are real legacy
   * `lead_customer` columns, confirmed against `legacy-schema.sql` — they
   * were just previously left unmapped on `LeadCustomer`, not absent from
   * the schema; now mapped (`aaAddressLine1`/`aaAddressLine2`/`aaCity`/
   * `aaState`/`aaPincode`).
   */
  private async assertMandatoryAddressFields(leadId: number): Promise<void> {
    const [customer, employment] = await Promise.all([
      this.leadCustomerRepository.findOne({
        where: { lead: { id: leadId } },
        relations: { city: true, state: true, aaCity: true, aaState: true },
      }),
      this.leadEmploymentRepository.findOne({
        where: { lead: { id: leadId } },
        relations: { state: true },
      }),
    ]);

    if (
      !customer?.currentAddressLine1 ||
      !customer?.currentAddressLine2 ||
      !customer?.city ||
      !customer?.state ||
      !customer?.pincode
    ) {
      throw new BadRequestException(
        'Please fill the mandatory fields in residence address.',
      );
    }

    if (
      !customer?.aaAddressLine1 ||
      !customer?.aaAddressLine2 ||
      !customer?.aaCity ||
      !customer?.aaState ||
      !customer?.aaPincode
    ) {
      throw new BadRequestException(
        'Please fill the mandatory fields in aadhaar address.',
      );
    }

    if (
      !employment?.addressLine1 ||
      !employment?.addressLine2 ||
      !employment?.state ||
      !employment?.pincode
    ) {
      throw new BadRequestException(
        'Please fill the mandatory fields in office address.',
      );
    }
  }

  /** Ports `CAMController::savePaydayCAMDetails()`'s three loan-amount
   * caps: recommended <= applied, recommended <= eligible (computed from
   * the flat FOIR% the same way `checkLoanEligibility()` does), and the
   * hard Rs. 1,15,000 ceiling (enforced separately via `@Max` on the DTO). */
  private async assertWithinLoanLimits(
    lead: Lead,
    dto: UpsertCamDto,
  ): Promise<void> {
    if (
      lead.loanAmount != null &&
      dto.recommendedLoanAmount > lead.loanAmount
    ) {
      throw new BadRequestException(
        'Recommended loan amount cannot be greater than the applied loan amount.',
      );
    }

    const eligibleLoanAmount = await this.eligibleLoanAmount(lead, dto);
    if (dto.recommendedLoanAmount > eligibleLoanAmount) {
      throw new BadRequestException(
        `Recommended loan amount cannot be greater than the eligible loan amount (${eligibleLoanAmount}).`,
      );
    }
  }

  /** Ports `CAMController::checkLoanEligibility()`'s flat-FOIR calculation. */
  private async eligibleLoanAmount(
    lead: Lead,
    dto: UpsertCamDto,
  ): Promise<number> {
    const foirPercent =
      lead.userType === LeadUserType.NEW
        ? FOIR_PERCENTAGE.NEW
        : FOIR_PERCENTAGE.REPEAT;
    return Math.round(
      (dto.appraisedMonthlyIncome - dto.appraisedObligations) * foirPercent,
    );
  }

  /**
   * Business rule (client-confirmed): if a calculated repayment date
   * falls on a Sunday or a company/festival holiday, it isn't used as
   * that customer's repayment date — it moves to the nearest working day
   * instead. Direction is configurable via
   * `REPAYMENT_DATE_WORKING_DAY_DIRECTION` (`previous`/`next`), defaults
   * to `previous`. See `adjustForNonWorkingDay()` (`@finance-crm/common`) for the
   * adjustment algorithm itself.
   */
  private async resolveWorkingRepaymentDate(isoDate: string): Promise<string> {
    const holidayDates =
      await this.companyHolidaysService.getActiveHolidayDates();
    const direction: WorkingDayDirection =
      this.configService.get<string>(
        'REPAYMENT_DATE_WORKING_DAY_DIRECTION',
        'previous',
      ) === 'next'
        ? 'next'
        : 'previous';
    return adjustForNonWorkingDay(isoDate, holidayDates, direction);
  }

  async sanction(
    leadId: number,
    actingUserId: number,
  ): Promise<CreditAnalysisMemo> {
    const cam = await this.findByLead(leadId);
    const sanctionedBy = await findOrFail(
      this.userRepository,
      actingUserId,
      'User',
    );
    cam.status = CamStatus.SANCTION;
    cam.sanctionedBy = sanctionedBy;
    // `CreditAnalysisMemo` has no dedicated sanctioned-at timestamp column
    // (unlike sanctionedBy) — `updatedAt` is the closest real column.
    cam.updatedAt = new Date();
    await this.creditAnalysisMemoRepository.save(cam);

    await this.assignCifCustomer(cam.lead);

    return cam;
  }

  /**
   * Ports `TaskController::sanctionleads()`'s CIF (Customer Identification
   * File) block — finds an existing customer master row by pancard
   * (repeat borrower), or generates the next sequential CIF number
   * (`"FTC" + 8-digit zero-padded sequence`, e.g. `"FTC00000004"`) for a
   * new one. Legacy also updates `customer_employment.customer_id`/
   * `docs.customer_id` to the same value — not needed here since this
   * schema's `Document`/`LeadEmployment` already resolve back to the
   * customer via `Lead`, not a duplicated string column.
   */
  private async assignCifCustomer(lead: Lead): Promise<CifCustomer | null> {
    if (!lead.pancard) {
      return null;
    }

    let cifCustomer = await this.cifCustomerRepository.findOne({
      where: { pancard: lead.pancard },
    });

    if (!cifCustomer) {
      const lastCifCustomer = await this.cifCustomerRepository.findOne({
        where: {},
        order: { id: 'DESC' },
      });
      const nextSequence = lastCifCustomer?.cifNumber
        ? Number(lastCifCustomer.cifNumber.replace(/\D/g, '')) + 1
        : 1;
      const cifNumber =
        CIF_NUMBER_PREFIX +
        String(nextSequence).padStart(CIF_NUMBER_DIGITS, '0');

      cifCustomer = this.cifCustomerRepository.create({
        cifNumber,
        pancard: lead.pancard,
        spouseName: '',
        credeauApprovedCustomer: lead.creationMode === 1 ? 1 : null,
      });
      cifCustomer = await this.cifCustomerRepository.save(cifCustomer);
    }

    lead.cifCustomer = cifCustomer;
    await this.leadRepository.save(lead);
    return cifCustomer;
  }

  async sendBack(
    leadId: number,
    dto: SendBackCamDto,
    actingUserId: number,
  ): Promise<CreditAnalysisMemo> {
    const cam = await this.findByLead(leadId);
    // `CamStatus` has no SEND_BACK member (only DRAFT/SANCTION) — sending a
    // CAM back for revision reverts it to DRAFT, the closest real status.
    cam.status = CamStatus.DRAFT;
    if (dto.remarks !== undefined) cam.remarks = dto.remarks;
    cam.updatedAt = new Date();
    const savedCam = await this.creditAnalysisMemoRepository.save(cam);

    const status = await this.masterStatusRepository.findOne({
      where: { name: APPLICATION_SEND_BACK },
    });
    if (!status) {
      throw new BadRequestException(
        `Master status "${APPLICATION_SEND_BACK}" is not seeded`,
      );
    }
    const lead = await findOrFail(this.leadRepository, leadId, 'Lead');
    const actingUser = await findOrFail(
      this.userRepository,
      actingUserId,
      'User',
    );
    lead.leadStatus = status;
    await this.leadRepository.save(lead);

    await this.leadFollowupRepository.save(
      this.leadFollowupRepository.create({
        lead,
        user: actingUser,
        status,
        remarks: dto.remarks ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    return savedCam;
  }
}
