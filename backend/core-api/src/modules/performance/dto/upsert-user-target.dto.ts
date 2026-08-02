import { UserTargetAllocationType } from '@finance-crm/database';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class UpsertUserTargetDto {
  @ApiProperty()
  @IsInt()
  userId: number;

  @ApiProperty({ enum: UserTargetAllocationType })
  @IsEnum(UserTargetAllocationType)
  type: UserTargetAllocationType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  targetCases?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  targetAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  targetFollowups?: number;
}
