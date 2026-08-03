import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { LeadAssignmentStage } from '../../leads/dto/assign-lead.dto';

export class AllocationOverrideDto {
  @IsEnum(LeadAssignmentStage)
  stage: LeadAssignmentStage;

  @IsInt()
  userId: number;

  @IsOptional()
  @IsString()
  remarks?: string;
}
