import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class InitiateEsignDto {
  @ApiProperty({
    description: 'Lead ID this eSign contract belongs to',
    example: 1234,
  })
  @IsInt()
  leadId: number;

  /** Base64-encoded PDF content (e.g. the sanction letter/loan agreement
   * rendered by `@finance-crm/common`'s PDF library). */
  @ApiProperty({
    description:
      'Base64-encoded PDF content of the document to be signed (e.g. the sanction letter/loan agreement)',
  })
  @IsString()
  documentBase64: string;

  @ApiProperty({ description: 'Full name of the signer as per Aadhaar' })
  @IsString()
  signerName: string;

  @ApiProperty({ description: 'Signer mobile number', example: '9876543210' })
  @IsString()
  signerMobile: string;

  @ApiProperty({
    description: 'Signer email address',
    example: 'user@example.com',
  })
  @IsString()
  signerEmail: string;

  @ApiPropertyOptional({
    description: 'Signer gender, used for Aadhaar match validation',
  })
  @IsOptional()
  @IsString()
  signerGender?: string;

  @ApiProperty({
    description: "Last four digits of the signer's Aadhaar number",
  })
  @IsString()
  aadhaarLastFourDigits: string;

  @ApiPropertyOptional({
    description: 'Signer year of birth, used for Aadhaar match validation',
  })
  @IsOptional()
  @IsString()
  signerYearOfBirth?: string;
}
