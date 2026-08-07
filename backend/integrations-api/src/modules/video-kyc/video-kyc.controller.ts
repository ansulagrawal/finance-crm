import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateVideoKycSessionDto } from './dto/create-video-kyc-session.dto';
import { VideoKycService } from './video-kyc.service';

@ApiTags('Video KYC')
@ApiCookieAuth()
@Controller('video-kyc')
export class VideoKycController {
  constructor(private readonly videoKycService: VideoKycService) {}

  @Post('sessions')
  @ApiOperation({
    summary:
      'Create a Signzy ConsenzAI video KYC session with a scripted loan-consent statement',
  })
  @ApiResponse({
    status: 201,
    description: 'Video KYC session creation logged',
  })
  createSession(@Body() dto: CreateVideoKycSessionDto) {
    return this.videoKycService.createSession(dto);
  }
}
