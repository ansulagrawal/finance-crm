import {
  DEFAULT_LENDER_CIN,
  DEFAULT_LENDER_NAME,
  DEFAULT_LENDER_REGISTERED_OFFICE,
  PDF_RENDERER,
  type PdfRenderer,
  renderSanctionLetterAndLoanAgreementHtml,
  type SanctionLetterData,
  STORAGE_ADAPTER,
  type StorageAdapter,
} from '@finance-crm/common';
import {
  CamStatus,
  CreditAnalysisMemo,
  CustomerBanking,
  Gender,
  Lead,
  LeadCustomer,
  Loan,
} from '@finance-crm/database';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

const LOGO_MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
  webp: 'image/webp',
};

function formatDate(date: Date | string | null): string {
  if (!date) return 'Not yet scheduled';
  const d = new Date(date);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

@Injectable()
export class SanctionLetterService {
  constructor(
    @InjectRepository(CreditAnalysisMemo)
    private readonly camRepository: Repository<CreditAnalysisMemo>,
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(LeadCustomer)
    private readonly leadCustomerRepository: Repository<LeadCustomer>,
    @InjectRepository(CustomerBanking)
    private readonly customerBankingRepository: Repository<CustomerBanking>,
    @InjectRepository(Loan)
    private readonly loanRepository: Repository<Loan>,
    @Inject(PDF_RENDERER) private readonly pdfRenderer: PdfRenderer,
    @Inject(STORAGE_ADAPTER) private readonly storageAdapter: StorageAdapter,
  ) {}

  /**
   * Renders the combined Key Fact Statement + Loan Agreement PDF for a
   * lead's sanctioned CAM, uploads it to storage (recorded on
   * `CreditAnalysisMemo.sanctionLetterFileName`, the field this schema
   * already reserved for it), and returns the bytes for the caller to
   * stream straight back to the browser for viewing/printing.
   */
  async generate(leadId: number): Promise<Buffer> {
    const lead = await this.leadRepository.findOne({
      where: { id: leadId },
      relations: { company: true },
    });
    if (!lead) {
      throw new NotFoundException(`Lead ${leadId} not found`);
    }
    const cam = await this.camRepository.findOne({
      where: { lead: { id: leadId } },
    });
    if (!cam) {
      throw new ConflictException(
        `No CAM exists yet for lead ${leadId} — sanction it first`,
      );
    }
    if (cam.status !== CamStatus.SANCTION) {
      throw new ConflictException(
        `CAM for lead ${leadId} is ${cam.status ?? 'not set'}, not SANCTION — cannot generate a sanction letter before it's sanctioned`,
      );
    }

    // Matches legacy (`sanction_latter.php`'s `PREPARE_KFS_LATTER`): render
    // once, store it, and serve the stored copy on every later view — not a
    // fresh render per view, which would let the letter's content drift from
    // what the borrower was actually shown at sanction time.
    if (cam.sanctionLetterFileName) {
      return this.storageAdapter.download(cam.sanctionLetterFileName);
    }

    const [customer, banking, loan] = await Promise.all([
      this.leadCustomerRepository.findOne({ where: { lead: { id: leadId } } }),
      this.customerBankingRepository.findOne({
        where: { lead: { id: leadId } },
        order: { id: 'DESC' },
      }),
      this.loanRepository.findOne({ where: { lead: { id: leadId } } }),
    ]);

    const borrowerFullName =
      [customer?.firstName, customer?.middleName, customer?.surName]
        .filter(Boolean)
        .join(' ') || lead.firstName;

    const logoDataUri = lead.company?.logoFileKey
      ? await this.resolveLogoDataUri(lead.company.logoFileKey)
      : undefined;

    const data: SanctionLetterData = {
      lenderName: lead.company?.name ?? DEFAULT_LENDER_NAME,
      lenderCin: lead.company?.cin ?? DEFAULT_LENDER_CIN,
      lenderRegisteredOffice:
        lead.company?.address ?? DEFAULT_LENDER_REGISTERED_OFFICE,
      logoDataUri,
      loanNo: loan?.loanNumber ?? lead.applicationNo ?? `LEAD-${leadId}`,
      applicationNo: lead.applicationNo ?? '',
      loanAmount: Number(cam.recommendedLoanAmount),
      tenureDays: cam.tenureDays ?? 0,
      repaymentAmount: Number(cam.repaymentAmount),
      repaymentDate: formatDate(cam.repaymentDate),
      netDisbursalAmount: Number(cam.netDisbursalAmount),
      disbursalDate: formatDate(cam.disbursalDate),
      bankAccountNumber: banking?.accountNumber ?? 'Not on file',
      ifscCode: banking?.ifscCode ?? 'Not on file',
      // Assumes `cam.roi` is already a daily rate (this template multiplies
      // it by 365 to derive the displayed APR) — the schema's column is
      // just named `roi` with no unit recorded anywhere else in the
      // codebase, so this is a judgment call, not a confirmed mapping.
      // Flag for business/credit-policy review before relying on the
      // APR/penal-interest figures this produces.
      roiPerDay: Number(cam.roi),
      // `CreditAnalysisMemo` has no dedicated `sanctionedAt` column — only
      // `updatedAt` and `sanctionedBy`/`sanctionedById` (mapped from
      // legacy's `updated_by`, "whichever user last touched the row at
      // sanction time"). `updatedAt` is used here as the same proxy for
      // when sanctioning happened.
      agreementDate: formatDate(cam.updatedAt),
      adminFee: Number(cam.adminFee ?? 0),
      borrowerTitle: customer?.gender === Gender.FEMALE ? 'Ms.' : 'Mr.',
      borrowerFullName,
      fatherName: customer?.fatherName ?? '',
      panNumber: customer?.pancard ?? lead.pancard ?? '',
      residenceAddressHtml:
        [
          customer?.currentAddressLine1,
          customer?.currentAddressLine2,
          customer?.currentLandmark,
        ]
          .filter(Boolean)
          .join(', ') || 'Not on file',
    };

    const html = renderSanctionLetterAndLoanAgreementHtml(data);
    const pdf = await this.pdfRenderer.renderHtmlToPdf(html);

    const key = `sanction-letters/lead-${leadId}-${Date.now()}.pdf`;
    await this.storageAdapter.upload(pdf, key, 'application/pdf');
    cam.sanctionLetterFileName = key;
    await this.camRepository.save(cam);

    return pdf;
  }

  /** Embeds the logo as a data URI so Puppeteer doesn't need network access to render it. */
  private async resolveLogoDataUri(
    logoFileKey: string,
  ): Promise<string | undefined> {
    const extension = logoFileKey.split('.').pop()?.toLowerCase() ?? '';
    const mimeType = LOGO_MIME_TYPES[extension];
    if (!mimeType) {
      return undefined;
    }
    const bytes = await this.storageAdapter.download(logoFileKey);
    return `data:${mimeType};base64,${bytes.toString('base64')}`;
  }
}
