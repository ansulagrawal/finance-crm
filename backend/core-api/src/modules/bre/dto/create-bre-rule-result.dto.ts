import { BreDecision } from '@finance-crm/database';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateBreRuleResultDto {
  @ApiProperty({ description: 'BRE rule ID being evaluated', example: 1 })
  @IsInt()
  ruleId: number;

  @ApiPropertyOptional({
    description: 'Cutoff/threshold value configured for the rule',
    example: '700',
  })
  @IsOptional()
  @IsString()
  cutoffValue?: string;

  @ApiPropertyOptional({
    description: 'Actual value observed for the lead',
    example: '650',
  })
  @IsOptional()
  @IsString()
  actualValue?: string;

  @ApiPropertyOptional({
    description: 'Relevant input values used in the evaluation',
    example: 'cibilScore=650',
  })
  @IsOptional()
  @IsString()
  relevantInputs?: string;

  @ApiProperty({
    description: 'System-computed decision for this rule',
    enum: BreDecision,
  })
  @IsEnum(BreDecision)
  systemDecision: BreDecision;
}
