import { IsDateString, IsOptional } from 'class-validator';

/** Most legacy reports/exports take a from/to date range; a handful ignore
 * it entirely (current-snapshot reports). Extend per-report where a report
 * needs additional filters. */
export class DateRangeQueryDto {
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}
