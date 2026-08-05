import { LoanPaymentType } from '@finance-crm/database';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Every business precondition is `core-api`'s job (see `DisbursalService`) —
 * this DTO only validates that the vendor call is well-formed. In particular
 * `transactionReferenceNo` must already exist as a
 * `lead_disbursement_trans_log` row, because that row is what stops a second
 * payment; this service does not and cannot check that.
 */
export class DisburseViaIciciDto {
  @ApiProperty({ description: 'Lead the disbursal belongs to' })
  @IsInt()
  leadId: number;

  @ApiProperty({
    description:
      'The disbursal transaction reference (legacy `SLPRD<YmdHis><rand>`). Sent as both `tranRefNo` and the envelope `requestId`, so ICICI treats a repeat as the same payment rather than a new one.',
  })
  @IsString()
  @MinLength(6)
  @MaxLength(50)
  transactionReferenceNo: string;

  @ApiProperty({
    enum: LoanPaymentType,
    description: 'Only IMPS (1) is supported; NEFT was never implemented.',
  })
  @IsIn([LoanPaymentType.IMPS, LoanPaymentType.NEFT])
  paymentType: LoanPaymentType;

  @ApiProperty({ description: 'Net disbursal amount in rupees' })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({ description: 'The loan account number, used in `paymentRef`' })
  @IsString()
  @MaxLength(50)
  loanNumber: string;

  @ApiProperty({ description: 'Beneficiary bank account number' })
  @IsString()
  @Matches(/^\d{5,20}$/, {
    message: 'beneficiaryAccountNumber must be 5-20 digits',
  })
  beneficiaryAccountNumber: string;

  @ApiProperty({ description: 'Beneficiary IFSC code' })
  @IsString()
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, {
    message: 'beneficiaryIfscCode must be a valid IFSC',
  })
  beneficiaryIfscCode: string;

  @ApiProperty({ description: 'Beneficiary name as held on the bank account' })
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  beneficiaryName: string;

  @ApiPropertyOptional({ description: 'Disbursement bank id, for the log row' })
  @IsOptional()
  @IsInt()
  disbursementBankId?: number;

  @ApiPropertyOptional({
    description: 'Staff user who triggered it, for the log row',
  })
  @IsOptional()
  @IsInt()
  requestedByUserId?: number;
}
