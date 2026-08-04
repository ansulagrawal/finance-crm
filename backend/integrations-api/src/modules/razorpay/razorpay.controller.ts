import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreatePaymentLinkDto } from './dto/create-payment-link.dto';
import { RazorpayService } from './razorpay.service';

@ApiTags('Razorpay')
@ApiCookieAuth()
@Controller('razorpay')
export class RazorpayController {
  constructor(private readonly razorpayService: RazorpayService) {}

  @Post('payment-links')
  @ApiOperation({
    summary:
      "Create a Razorpay Payment Link for a lead's outstanding loan repayment",
  })
  @ApiResponse({
    status: 201,
    description: 'Razorpay payment link created and logged',
  })
  createPaymentLink(@Body() dto: CreatePaymentLinkDto) {
    return this.razorpayService.createPaymentLink(dto);
  }
}
