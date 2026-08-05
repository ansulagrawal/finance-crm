import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, MaxLength, MinLength } from 'class-validator';

/** Resolves an `UNKNOWN` disbursal outcome. This is the ONLY safe follow-up to
 * a payment whose result we do not know — never a second payment call. */
export class IciciDisbursementStatusDto {
  @ApiProperty({ description: 'Lead the disbursal belongs to' })
  @IsInt()
  leadId: number;

  @ApiProperty({ description: 'The `tranRefNo` originally sent to ICICI' })
  @IsString()
  @MinLength(6)
  @MaxLength(50)
  transactionReferenceNo: string;
}
