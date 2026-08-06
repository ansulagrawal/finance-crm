import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { VerifyFaceMatchDto } from './dto/verify-face-match.dto';
import { FaceMatchService } from './face-match.service';

@ApiTags('Face Match')
@ApiCookieAuth()
@Controller('face-match')
export class FaceMatchController {
  constructor(private readonly faceMatchService: FaceMatchService) {}

  @Post()
  @ApiOperation({
    summary:
      'Run a Signzy face match between a live selfie and the Aadhaar photo',
  })
  @ApiResponse({ status: 201, description: 'Face match result logged' })
  verify(@Body() dto: VerifyFaceMatchDto) {
    return this.faceMatchService.verify(dto);
  }
}
