import { Public } from '@finance-crm/common';
import { Body, Controller, Logger, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { VendorCallbackTokenGuard } from '../../common/vendor-callback-token.guard';
import { BankAnalysisService } from './bank-analysis.service';

interface CartbiCallbackBody {
  status?: string;
  docId?: string;
}

const ACCEPTED_CALLBACK_STATUSES = ['processed', 'downloaded'];

/**
 * Ports `ApiCallBackController::callback_novel_bank_analysis()` — CartBI's
 * async webhook, called once bank-statement analysis finishes. No
 * signature/auth on the legacy endpoint either.
 *
 * **Security**: legacy having no auth here isn't a reason to keep none — an
 * unauthenticated caller could drive an outbound CartBI download for any
 * `docId` and overwrite the stored analysis behind it. Authenticated by
 * `VendorCallbackTokenGuard`. `downloadResult` already resolves the docId
 * against a real `Document` row and 404s otherwise, so the token is the
 * missing half rather than the whole fix.
 */
@ApiTags('Bank Analysis (CartBI)')
@ApiSecurity('vendor-callback-token')
@Controller('bank-analysis')
export class BankAnalysisCallbackController {
  private readonly logger = new Logger(BankAnalysisCallbackController.name);

  constructor(private readonly bankAnalysisService: BankAnalysisService) {}

  @Public()
  @UseGuards(VendorCallbackTokenGuard)
  @Post('callback')
  @ApiOperation({
    summary:
      'CartBI async analysis-complete webhook (third-party). Authenticated by the VENDOR_CALLBACK_TOKEN shared secret.',
  })
  async callback(
    @Body() body: CartbiCallbackBody,
  ): Promise<{ status: number; errors: string }> {
    const normalizedStatus = body.status?.toLowerCase();
    if (
      !normalizedStatus ||
      !ACCEPTED_CALLBACK_STATUSES.includes(normalizedStatus)
    ) {
      return { status: 0, errors: 'Return status does not proceed.' };
    }
    if (!body.docId) {
      return { status: 0, errors: 'Return document id not found.' };
    }

    try {
      await this.bankAnalysisService.downloadResult(body.docId);
      return { status: 1, errors: '' };
    } catch (error) {
      this.logger.warn(
        `CartBI callback download failed for docId ${body.docId}: ${(error as Error).message}`,
      );
      return { status: 0, errors: (error as Error).message };
    }
  }
}
