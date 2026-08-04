import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class SendOtpSmsDto {
  @ApiProperty({
    description: 'Lead ID this OTP SMS belongs to',
    example: 1234,
  })
  @IsInt()
  leadId: number;

  @ApiProperty({
    description: 'Recipient mobile number',
    example: '9876543210',
  })
  @IsString()
  mobile: string;

  @ApiProperty({ description: 'OTP code to send', example: '482913' })
  @IsString()
  otp: string;

  @ApiPropertyOptional({
    description:
      'Reference number to include in the message (not currently used)',
  })
  @IsOptional()
  @IsString()
  referenceNo?: string;
}
