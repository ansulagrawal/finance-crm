import { CollectionVerificationStatus } from '@finance-crm/database';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class VerifyPaymentDto {
  @IsEnum(CollectionVerificationStatus)
  verificationStatus: CollectionVerificationStatus;

  @IsOptional()
  @IsString()
  closureRemarks?: string;
}
