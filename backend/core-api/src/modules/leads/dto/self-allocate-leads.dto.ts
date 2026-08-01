import { ArrayNotEmpty, IsEnum, IsInt } from 'class-validator';
import { LeadAssignmentStage } from './assign-lead.dto';

export class SelfAllocateLeadsDto {
  @ArrayNotEmpty()
  @IsInt({ each: true })
  leadIds: number[];

  @IsEnum(LeadAssignmentStage)
  assignTarget: LeadAssignmentStage;
}
