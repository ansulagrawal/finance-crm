import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString } from 'class-validator';

export class VerifyUanDto {
  @ApiProperty({
    description: 'Lead ID this UAN/employment verification belongs to',
    example: 1234,
  })
  @IsInt()
  leadId: number;

  @ApiProperty({
    description: 'Applicant mobile number',
    example: '9876543210',
  })
  @IsString()
  mobileNumber: string;

  @ApiProperty({ description: 'Applicant PAN number', example: 'ABCDE1234F' })
  @IsString()
  panNumber: string;
}
