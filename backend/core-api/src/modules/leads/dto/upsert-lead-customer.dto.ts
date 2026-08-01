import { Gender } from '@finance-crm/database';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpsertLeadCustomerDto {
  @ApiPropertyOptional({ description: 'First name', example: 'Ramesh' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ description: 'Middle name' })
  @IsOptional()
  @IsString()
  middleName?: string;

  @ApiPropertyOptional({ description: 'Surname/last name' })
  @IsOptional()
  @IsString()
  surName?: string;

  @ApiPropertyOptional({ description: "Father's name" })
  @IsOptional()
  @IsString()
  fatherName?: string;

  @ApiPropertyOptional({ description: 'Gender', enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({
    description: 'Date of birth (ISO date string)',
    example: '1990-01-01',
  })
  @IsOptional()
  @IsDateString()
  dob?: string;

  @ApiPropertyOptional({
    description: 'Primary mobile number',
    example: '9876543210',
  })
  @IsOptional()
  @IsString()
  mobile?: string;

  @ApiPropertyOptional({ description: 'Alternate mobile number' })
  @IsOptional()
  @IsString()
  alternateMobile?: string;

  @ApiPropertyOptional({
    description: 'Primary email address',
    example: 'ramesh@example.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Alternate email address' })
  @IsOptional()
  @IsEmail()
  alternateEmail?: string;

  @ApiPropertyOptional({
    description: 'PAN card number',
    example: 'ABCDE1234F',
  })
  @IsOptional()
  @IsString()
  pancard?: string;

  @ApiPropertyOptional({ description: 'Aadhaar number' })
  @IsOptional()
  @IsString()
  aadhaarNumber?: string;

  @ApiPropertyOptional({
    description: 'Whether the PAN card has been verified',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isPancardVerified?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the Aadhaar has been verified',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isAadhaarVerified?: boolean;

  @ApiPropertyOptional({ description: 'Current address line 1' })
  @IsOptional()
  @IsString()
  currentAddressLine1?: string;

  @ApiPropertyOptional({ description: 'Current address line 2' })
  @IsOptional()
  @IsString()
  currentAddressLine2?: string;

  @ApiPropertyOptional({ description: 'Current address landmark' })
  @IsOptional()
  @IsString()
  currentLandmark?: string;

  @ApiPropertyOptional({
    description: 'Type of current residence',
    example: 'Owned',
  })
  @IsOptional()
  @IsString()
  currentResidenceType?: string;

  @ApiPropertyOptional({ description: 'Duration at current residence' })
  @IsOptional()
  @IsString()
  currentResidenceSince?: string;

  @ApiPropertyOptional({
    description: 'Pincode of current address',
    example: '400001',
  })
  @IsOptional()
  @IsString()
  pincode?: string;

  @ApiPropertyOptional({ description: "Spouse's name" })
  @IsOptional()
  @IsString()
  spouseName?: string;

  @ApiPropertyOptional({
    description: 'State ID of current address',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  stateId?: number;

  @ApiPropertyOptional({
    description: 'City ID of current address',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  cityId?: number;

  @ApiPropertyOptional({ description: 'Marital status lookup ID', example: 1 })
  @IsOptional()
  @IsInt()
  maritalStatusId?: number;

  @ApiPropertyOptional({ description: 'Qualification lookup ID', example: 1 })
  @IsOptional()
  @IsInt()
  qualificationId?: number;

  @ApiPropertyOptional({ description: 'Religion lookup ID', example: 1 })
  @IsOptional()
  @IsInt()
  religionId?: number;

  @ApiPropertyOptional({
    description: "Spouse's occupation lookup ID",
    example: 1,
  })
  @IsOptional()
  @IsInt()
  spouseOccupationId?: number;
}
