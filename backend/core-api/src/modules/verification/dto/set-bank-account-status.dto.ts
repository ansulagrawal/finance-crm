import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

export class SetBankAccountStatusDto {
  @ApiProperty({
    description: 'Target master_bank_account_status ID',
    example: 1,
  })
  @IsInt()
  accountStatusId: number;
}
