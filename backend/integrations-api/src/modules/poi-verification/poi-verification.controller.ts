import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OcrDocumentDto } from './dto/ocr-document.dto';
import { VerifyDualPanDto } from './dto/verify-dual-pan.dto';
import { VerifyPanDto } from './dto/verify-pan.dto';
import { PoiVerificationService } from './poi-verification.service';

@ApiTags('POI Verification')
@ApiCookieAuth()
@Controller('poi-verification')
export class PoiVerificationController {
  constructor(
    private readonly poiVerificationService: PoiVerificationService,
  ) {}

  @Post('pan')
  @ApiOperation({
    summary: 'Fetch and verify PAN details via Signzy pan/fetchV2',
  })
  @ApiResponse({ status: 201, description: 'PAN verification result logged' })
  verifyPan(@Body() dto: VerifyPanDto) {
    return this.poiVerificationService.verifyPan(dto);
  }

  @Post('dual-pan')
  @ApiOperation({
    summary:
      "Fraud-check an alternate PAN against this lead's own name via Signzy pan/fetchV2",
  })
  @ApiResponse({
    status: 201,
    description: 'Dual-PAN verification result logged',
  })
  verifyDualPan(@Body() dto: VerifyDualPanDto) {
    return this.poiVerificationService.verifyDualPan(dto);
  }

  @Post('pan-ocr')
  @ApiOperation({
    summary:
      'Run OCR extraction on a PAN card image via Signzy pan/extractions',
  })
  @ApiResponse({ status: 201, description: 'PAN OCR result logged' })
  ocrPan(@Body() dto: OcrDocumentDto) {
    return this.poiVerificationService.ocrPan(dto);
  }

  @Post('aadhaar-ocr')
  @ApiOperation({
    summary:
      'Run OCR extraction on an Aadhaar card image via Signzy aadhaar/extraction',
  })
  @ApiResponse({ status: 201, description: 'Aadhaar OCR result logged' })
  ocrAadhaar(@Body() dto: OcrDocumentDto) {
    return this.poiVerificationService.ocrAadhaar(dto);
  }
}
