import type { FieldVerificationReportStatus } from '@finance-crm/database';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';
import { FieldVerificationTrack } from '../field-verification.types';

export class SubmitFieldVerificationReportDto {
  @IsEnum(FieldVerificationTrack)
  track: FieldVerificationTrack;

  /** '2'=positive, '3'=negative — a report can't be submitted as still-pending ('1'). */
  @IsIn(['2', '3'])
  status: Extract<FieldVerificationReportStatus, '2' | '3'>;

  @IsOptional()
  @IsString()
  metWith?: string;

  @IsOptional()
  @IsString()
  relation?: string;

  @IsOptional()
  @IsString()
  employerName?: string;

  @IsOptional()
  @IsString()
  locality?: string;

  @IsOptional()
  @IsString()
  geoCoordinates?: string;

  @IsOptional()
  @IsDateString()
  visitedAt?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsString()
  documentVerified?: string;

  @IsOptional()
  @IsString()
  photoFileKey?: string;

  // --- Residence-only ---

  @IsOptional()
  @IsString()
  residenceType?: string;

  @IsOptional()
  @IsString()
  houseType?: string;

  @IsOptional()
  @IsString()
  easeOfIdentification?: string;

  @IsOptional()
  @IsString()
  residingSince?: string;

  @IsOptional()
  @IsString()
  totalMembersInFamily?: string;

  @IsOptional()
  @IsString()
  earningMembersInFamily?: string;

  @IsOptional()
  @IsString()
  livingStandard?: string;

  @IsOptional()
  @IsString()
  neighbourCheck?: string;

  // --- Office-only ---

  @IsOptional()
  @IsString()
  entryAllowed?: string;

  @IsOptional()
  @IsString()
  companySignboardSighted?: string;

  @IsOptional()
  @IsString()
  noOfStaffSighted?: string;

  @IsOptional()
  @IsString()
  employeeStrength?: string;

  @IsOptional()
  @IsString()
  employedSince?: string;
}
