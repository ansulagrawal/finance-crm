import { BreDecision } from '@finance-crm/database';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class ManualDecisionBreRuleResultDto {
  @ApiProperty({
    description: 'Manually overridden decision',
    enum: BreDecision,
  })
  @IsEnum(BreDecision)
  manualDecision: BreDecision;

  @ApiPropertyOptional({
    description: 'Remarks explaining the manual decision',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  manualDecisionRemarks?: string;
}
