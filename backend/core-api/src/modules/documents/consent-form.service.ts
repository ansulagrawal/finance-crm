import {
  type ConsentFormData,
  findOrFail,
  PDF_RENDERER,
  type PdfRenderer,
  renderAccountAggregatorConsentHtml,
} from '@finance-crm/common';
import { CreditAnalysisMemo, Lead } from '@finance-crm/database';
import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

/**
 * Nodal grievance officer contact — same real values already ported into
 * `sanction-letter.template.ts`'s `GRIEVANCE_ESCALATIONS` (Third
 * Escalation row) and registered office address, kept in sync here
 * rather than re-deriving them.
 */
const NODAL_OFFICER_NAME = 'Swati';
const NODAL_OFFICER_MOBILE = '+91 7733866661';
const NODAL_OFFICER_ADDRESS =
  'B-7, New Multan Nagar, Paschim Vihar, New Delhi- 110056';

@Injectable()
export class ConsentFormService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(CreditAnalysisMemo)
    private readonly camRepository: Repository<CreditAnalysisMemo>,
    @Inject(PDF_RENDERER) private readonly pdfRenderer: PdfRenderer,
  ) {}

  /**
   * Renders the Key Fact Statement consent form (see
   * `renderAccountAggregatorConsentHtml`'s doc comment for the naming
   * caveat — legacy has no distinct AA-flow consent document, this is the
   * real KFS consent screen). Uses the CAM's terms directly rather than
   * requiring it to already be sanctioned, since this is shown to the
   * borrower *before* they consent/e-sign.
   */
  async generate(leadId: number): Promise<Buffer> {
    const lead = await findOrFail(this.leadRepository, leadId, 'Lead');
    const cam = await this.camRepository.findOne({
      where: { lead: { id: leadId } },
    });
    if (!cam) {
      throw new ConflictException(
        `No CAM exists yet for lead ${leadId} — cannot render a consent form before terms are set`,
      );
    }

    const data: ConsentFormData = {
      borrowerFullName: lead.firstName,
      loanAmount: Number(cam.recommendedLoanAmount),
      roiPerDay: Number(cam.roi),
      tenureDays: cam.tenureDays ?? 0,
      adminFee: Number(cam.adminFee ?? 0),
      netDisbursalAmount: Number(cam.netDisbursalAmount),
      repaymentAmount: Number(cam.repaymentAmount),
      nodalGrievanceOfficerName: NODAL_OFFICER_NAME,
      nodalGrievanceOfficerMobile: NODAL_OFFICER_MOBILE,
      nodalGrievanceOfficerAddress: NODAL_OFFICER_ADDRESS,
    };

    const html = renderAccountAggregatorConsentHtml(data);
    return this.pdfRenderer.renderHtmlToPdf(html);
  }
}
