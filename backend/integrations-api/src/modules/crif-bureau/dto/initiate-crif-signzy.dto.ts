import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString } from 'class-validator';

/** Fields `payday_signzy_crif_api.php`'s step-1 request body needs beyond
 * what `FetchCrifReportDto` (the Surepass flow) already carries — the
 * caller (core-api, which owns lead/customer data) supplies all of them,
 * same convention as the Surepass DTO. */
export class InitiateCrifSignzyDto {
  @ApiProperty({ description: 'Lead ID this bureau pull belongs to' })
  @IsInt()
  leadId: number;

  @ApiProperty({ description: 'Applicant first name' })
  @IsString()
  firstName: string;

  @ApiProperty({ description: 'Applicant last name' })
  @IsString()
  lastName: string;

  @ApiProperty({ description: 'Applicant mobile number' })
  @IsString()
  mobile: string;

  @ApiProperty({ description: 'Applicant PAN number' })
  @IsString()
  pan: string;

  @ApiProperty({ description: 'Applicant date of birth, YYYY-MM-DD' })
  @IsString()
  dob: string;

  @ApiProperty({ description: 'Applicant gender' })
  @IsString()
  gender: string;

  @ApiProperty({ description: 'Current address, house/flat line' })
  @IsString()
  addressLine1: string;

  @ApiProperty({ description: 'Current address, locality line' })
  @IsString()
  addressLine2: string;

  @ApiProperty({ description: 'Current address, landmark' })
  @IsString()
  landmark: string;

  @ApiProperty({ description: 'Current address city name' })
  @IsString()
  city: string;

  @ApiProperty({ description: 'Current address state name' })
  @IsString()
  state: string;

  @ApiProperty({ description: 'Current address pincode' })
  @IsString()
  pincode: string;
}
