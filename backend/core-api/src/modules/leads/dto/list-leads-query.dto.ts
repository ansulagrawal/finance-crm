import { PaginationQueryDto } from '@finance-crm/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

export class ListLeadsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Free-text search across lead name/mobile/email',
    example: 'ramesh',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by company ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  companyId?: number;

  @ApiPropertyOptional({ description: 'Filter by product ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  productId?: number;

  @ApiPropertyOptional({ description: 'Filter by lead status ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  leadStatusId?: number;

  @ApiPropertyOptional({
    description: 'Filter by screener user assigned to the lead',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  screenerAssignedToId?: number;

  @ApiPropertyOptional({
    description: 'Filter by credit user assigned to the lead',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  creditAssignedToId?: number;

  @ApiPropertyOptional({
    description: 'Filter by disbursal user assigned to the lead',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  disbursalAssignedToId?: number;

  @ApiPropertyOptional({
    description: 'Filter by blacklist status',
    example: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isBlacklisted?: boolean;

  @ApiPropertyOptional({
    description:
      'Filter to rejected leads with this rejection reason ID (combine with leadStatusId=<REJECT status> for a rejected-leads list, matching legacy rejectedTaskList)',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  rejectionReasonId?: number;

  @ApiPropertyOptional({
    description:
      "Filter to leads whose status has one of these MasterStatus.stageCodes (comma-separated) — for cross-role views like the rejected-leads list (S8/S9) that aren't a single role's queue",
    example: 'S8,S9',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((code) => code.trim())
          .filter(Boolean)
      : value,
  )
  @IsArray()
  @IsString({ each: true })
  stageCode?: string[];
}
