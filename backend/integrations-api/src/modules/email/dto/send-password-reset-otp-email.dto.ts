import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

/**
 * Staff-facing, so deliberately no `leadId` — see `SendGenericEmailDto`'s
 * note on `api_email_logs.email_lead_id` being nullable.
 *
 * `core-api` owns the OTP itself and the request context; this service owns
 * the template and the transport, matching how `thank-you` is split.
 */
export class SendPasswordResetOtpEmailDto {
  @ApiProperty({ description: 'Recipient staff email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Display name of the staff user' })
  @IsString()
  @MaxLength(150)
  name: string;

  @ApiProperty({
    description: 'The 6-digit one-time password',
    example: '123456',
  })
  @IsString()
  @Length(6, 6)
  otp: string;

  @ApiPropertyOptional({
    description:
      'IP the reset was requested from, shown so a recipient who did not request it can see where it came from',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  ipAddress?: string;

  @ApiPropertyOptional({
    description: 'Raw User-Agent header of the requesting client',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  userAgent?: string;
}
