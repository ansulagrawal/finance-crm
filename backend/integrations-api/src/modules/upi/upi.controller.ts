import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateQrRequestDto } from './dto/create-qr-request.dto';
import { UpiService } from './upi.service';

@ApiTags('UPI')
@ApiCookieAuth()
@Controller('upi')
export class UpiController {
  constructor(private readonly upiService: UpiService) {}

  @Post('qr-requests')
  @ApiOperation({
    summary:
      'Create an ICICI EazyPay UPI collection QR request for a disbursed loan',
  })
  @ApiResponse({
    status: 201,
    description: 'UPI QR request created and logged',
  })
  createQrRequest(@Body() dto: CreateQrRequestDto) {
    return this.upiService.createQrRequest(dto);
  }
}
