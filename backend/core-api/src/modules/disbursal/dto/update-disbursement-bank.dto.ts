import { PartialType } from '@nestjs/swagger';
import { CreateDisbursementBankDto } from './create-disbursement-bank.dto';

export class UpdateDisbursementBankDto extends PartialType(
  CreateDisbursementBankDto,
) {}
