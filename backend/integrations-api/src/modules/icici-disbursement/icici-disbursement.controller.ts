import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DisburseViaIciciDto } from './dto/disburse-via-icici.dto';
import { IciciDisbursementStatusDto } from './dto/icici-disbursement-status.dto';
import { IciciDisbursementService } from './icici-disbursement.service';

/**
 * Guarded by the global `JwtAuthGuard` like every other staff-facing route —
 * in practice the caller is `core-api` over the HMAC-signed internal path,
 * because `core-api` owns the guards that make a disbursal safe.
 *
 * There is deliberately no "retry" route. A disbursal whose outcome is
 * `UNKNOWN` is resolved with `/status`, never by calling `/disburse` again.
 */
@ApiTags('ICICI Disbursement')
@ApiCookieAuth()
@Controller('icici-disbursement')
export class IciciDisbursementController {
  constructor(private readonly service: IciciDisbursementService) {}

  @Post('disburse')
  @ApiOperation({
    summary:
      'Send a real IMPS bank transfer for a loan disbursal via ICICI API Banking. MOVES MONEY — core-api must have created the lead_disbursement_trans_log row and passed its reference as transactionReferenceNo.',
  })
  @ApiResponse({ status: 201, description: 'Disbursal attempt logged' })
  disburse(@Body() dto: DisburseViaIciciDto) {
    return this.service.disburse(dto);
  }

  @Post('status')
  @ApiOperation({
    summary:
      'Query the status of a previously-sent disbursal by its tranRefNo. The only safe follow-up to an UNKNOWN outcome.',
  })
  @ApiResponse({ status: 201, description: 'Status check logged' })
  checkStatus(@Body() dto: IciciDisbursementStatusDto) {
    return this.service.checkStatus(dto);
  }
}
