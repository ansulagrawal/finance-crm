import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsInt, IsOptional } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({
    description: 'Lead ID this email verification belongs to',
    example: 1234,
  })
  @IsInt()
  leadId: number;

  @ApiProperty({
    description: 'Email address to verify',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  /** true = personal email (legacy methodId 1), false = office email (methodId 2). */
  @ApiPropertyOptional({
    description:
      'true = personal email, false = office email (defaults to personal)',
  })
  @IsOptional()
  @IsBoolean()
  isPersonalEmail?: boolean;
}
