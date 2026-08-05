import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { InitiateEnachTransactionDto } from './dto/initiate-enach-transaction.dto';
import { EnachService } from './enach.service';

@ApiTags('eNACH')
@ApiCookieAuth()
@Controller('enach')
export class EnachController {
  constructor(private readonly enachService: EnachService) {}

  @Post('transactions')
  @ApiOperation({
    summary:
      'Initiate an ICICI eNACH mandate collection transaction for a loan',
  })
  @ApiResponse({ status: 201, description: 'eNACH transaction attempt logged' })
  initiate(@Body() dto: InitiateEnachTransactionDto) {
    return this.enachService.initiateTransaction(dto);
  }
}
