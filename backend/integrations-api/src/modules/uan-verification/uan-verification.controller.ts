import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { VerifyUanDto } from './dto/verify-uan.dto';
import { UanVerificationService } from './uan-verification.service';

@ApiTags('UAN Verification')
@ApiCookieAuth()
@Controller('uan-verification')
export class UanVerificationController {
  constructor(
    private readonly uanVerificationService: UanVerificationService,
  ) {}

  @Post()
  @ApiOperation({
    summary:
      "Verify an applicant's UAN/EPFO employment status via Signzy advance-employment-verification",
  })
  @ApiResponse({ status: 201, description: 'UAN verification result logged' })
  verify(@Body() dto: VerifyUanDto) {
    return this.uanVerificationService.verify(dto);
  }
}
