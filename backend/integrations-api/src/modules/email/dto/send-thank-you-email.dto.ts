import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsInt, IsString } from 'class-validator';

export class SendThankYouEmailDto {
  @ApiProperty({
    description: 'Lead ID this thank-you email belongs to',
    example: 1234,
  })
  @IsInt()
  leadId: number;

  @ApiProperty({
    description: 'Recipient email address',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({ description: "Applicant's name, used in the email greeting" })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Application reference number to include in the email',
  })
  @IsString()
  referenceNo: string;
}
