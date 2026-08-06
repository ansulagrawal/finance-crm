import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString } from 'class-validator';

export class FetchCrifReportDto {
  @ApiProperty({
    description: 'Lead ID this bureau pull belongs to',
    example: 1234,
  })
  @IsInt()
  leadId: number;

  @ApiProperty({ description: 'Applicant first name' })
  @IsString()
  firstName: string;

  @ApiProperty({ description: 'Applicant last name' })
  @IsString()
  lastName: string;

  @ApiProperty({
    description: 'Applicant mobile number',
    example: '9876543210',
  })
  @IsString()
  mobile: string;

  @ApiProperty({ description: 'Applicant PAN number', example: 'ABCDE1234F' })
  @IsString()
  pan: string;
}
