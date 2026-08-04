import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsInt, IsOptional, IsString } from 'class-validator';

export class SendGenericEmailDto {
  @ApiPropertyOptional({
    description:
      "Lead this email belongs to. Optional — `api_email_logs.email_lead_id` is nullable in the legacy schema, and legacy's own `common_send_email()` writes that log with no lead at all (only the lead-specific senders set one). Staff-facing mail such as a password-reset OTP has no lead.",
  })
  @IsOptional()
  @IsInt()
  leadId?: number;

  @ApiProperty({ description: 'Recipient email address' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ description: 'CC email address' })
  @IsOptional()
  @IsEmail()
  cc?: string;

  @ApiProperty({ description: 'Email subject line' })
  @IsString()
  subject: string;

  @ApiProperty({ description: 'Email HTML body' })
  @IsString()
  html: string;

  @ApiProperty({
    description:
      'Free-form type id for the email_logs row (matches legacy convention — no shared enum, each caller picks its own id)',
  })
  @IsInt()
  typeId: number;
}
