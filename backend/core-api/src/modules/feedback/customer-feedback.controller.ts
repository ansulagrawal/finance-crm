import { Public } from '@finance-crm/common';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CreateCustomerFeedbackDto } from './dto/create-customer-feedback.dto';
import { FeedbackService } from './feedback.service';

@ApiTags('Customer Feedback')
@ApiCookieAuth()
@Controller('leads/:leadId/feedback')
export class CustomerFeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Get()
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({ summary: 'List customer feedback submissions for a lead' })
  list(@Param('leadId', ParseIntPipe) leadId: number) {
    return this.feedbackService.listForLead(leadId);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiOperation({
    summary:
      'Publicly submit customer feedback with question/answer responses for a lead. Returns only the new feedback id — never the lead, which this unauthenticated route must not disclose.',
  })
  submit(
    @Param('leadId', ParseIntPipe) leadId: number,
    @Body() dto: CreateCustomerFeedbackDto,
  ) {
    return this.feedbackService.submit(leadId, dto);
  }

  @Get(':feedbackId/responses')
  @ApiParam({ name: 'leadId', description: 'Lead ID', type: Number })
  @ApiParam({
    name: 'feedbackId',
    description: 'Customer feedback ID',
    type: Number,
  })
  @ApiOperation({
    summary:
      'List individual question/answer responses for a feedback submission',
  })
  listResponses(@Param('feedbackId', ParseIntPipe) feedbackId: number) {
    return this.feedbackService.listResponses(feedbackId);
  }
}
