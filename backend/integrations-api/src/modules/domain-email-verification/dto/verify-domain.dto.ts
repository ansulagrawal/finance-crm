import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsInt } from 'class-validator';

export class VerifyDomainDto {
  @ApiProperty({
    description: 'Lead ID this domain verification belongs to',
    example: 1234,
  })
  @IsInt()
  leadId: number;

  @ApiProperty({
    description: 'Email address whose domain will be verified',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;
}
