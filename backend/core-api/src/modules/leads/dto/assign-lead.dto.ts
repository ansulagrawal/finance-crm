import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

export enum LeadAssignmentStage {
  SCREENER = 'SCREENER',
  CREDIT = 'CREDIT',
  DISBURSAL = 'DISBURSAL',
}

export class AssignLeadDto {
  @IsEnum(LeadAssignmentStage)
  stage: LeadAssignmentStage;

  @IsInt()
  userId: number;

  @IsOptional()
  @IsString()
  remarks?: string;
}
