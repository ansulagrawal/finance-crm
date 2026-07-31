import { PaginationQueryDto } from '@finance-crm/common';
import { UserActivityType } from '@finance-crm/database';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional } from 'class-validator';

export class ListActivityLogsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by user ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  userId?: number;

  @ApiPropertyOptional({
    description: 'Filter by activity type',
    enum: UserActivityType,
  })
  @IsOptional()
  @IsEnum(UserActivityType)
  activityType?: UserActivityType;

  @ApiPropertyOptional({
    description: 'Filter activities from this date (ISO date string)',
    example: '2026-07-01',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'Filter activities up to this date (ISO date string)',
    example: '2026-07-26',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}
