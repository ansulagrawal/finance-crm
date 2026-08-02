import {
  findOrFail,
  type LegalNoticeData,
  PDF_RENDERER,
  type PdfRenderer,
  renderLegalNoticeHtml,
} from '@finance-crm/common';
import {
  Collection,
  CollectionVerificationStatus,
  CreditAnalysisMemo,
  Lead,
  LeadCustomer,
  Loan,
} from '@finance-crm/database';
import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

/** No legacy source gives a real response window — 15 days is a
 * reasonable default for a demand notice, not a confirmed legacy value. */
const DAYS_TO_RESPOND = 15;

@Injectable()
export class LegalNoticeService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(CreditAnalysisMemo)
    private readonly camRepository: Repository<CreditAnalysisMemo>,
    @InjectRepository(Loan)
    private readonly loanRepository: Repository<Loan>,
    @InjectRepository(LeadCustomer)
    private readonly leadCustomerRepository: Repository<LeadCustomer>,
    @InjectRepository(Collection)
    private readonly collectionRepository: Repository<Collection>,
    @Inject(PDF_RENDERER) private readonly pdfRenderer: PdfRenderer,
  ) {}

  /**
   * Renders `legal-notice.template.ts`'s explicitly-unreviewed placeholder
   * document — see that file's doc comment. Wired here (with the
   * "NOT LEGAL-REVIEWED" watermark kept intact) rather than left
   * completely unreachable, per explicit instruction; still not fit to
   * send to a real borrower without legal sign-off replacing the content.
   */
  async generate(leadId: number): Promise<Buffer> {
    const lead = await findOrFail(this.leadRepository, leadId, 'Lead');
    const cam = await this.camRepository.findOne({
      where: { lead: { id: leadId } },
    });
    if (!cam) {
      throw new ConflictException(
        `No CAM exists yet for lead ${leadId} — cannot compute an outstanding amount`,
      );
    }

    const [loan, customer, verifiedCollections] = await Promise.all([
      this.loanRepository.findOne({ where: { lead: { id: leadId } } }),
      this.leadCustomerRepository.findOne({
        where: { lead: { id: leadId } },
      }),
      this.collectionRepository.find({
        where: {
          lead: { id: leadId },
          verificationStatus: CollectionVerificationStatus.APPROVED,
          isDeleted: false,
        },
      }),
    ]);

    const receivedAmount = verifiedCollections.reduce(
      (sum, collection) => sum + Number(collection.receivedAmount),
      0,
    );
    const outstandingAmount = Number(cam.repaymentAmount) - receivedAmount;

    const borrowerFullName =
      [customer?.firstName, customer?.middleName, customer?.surName]
        .filter(Boolean)
        .join(' ') || lead.firstName;
    const addressHtml =
      [
        customer?.currentAddressLine1,
        customer?.currentAddressLine2,
        customer?.currentLandmark,
      ]
        .filter(Boolean)
        .join(', ') || 'Address not on file';

    const data: LegalNoticeData = {
      noticeDate: new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      borrowerFullName,
      borrowerAddressHtml: addressHtml,
      loanNo: loan?.loanNumber ?? lead.applicationNo ?? `LEAD-${leadId}`,
      outstandingAmount,
      dueDate: cam.repaymentDate
        ? new Date(cam.repaymentDate).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })
        : 'Not on file',
      daysToRespond: DAYS_TO_RESPOND,
    };

    const html = renderLegalNoticeHtml(data);
    return this.pdfRenderer.renderHtmlToPdf(html);
  }
}
