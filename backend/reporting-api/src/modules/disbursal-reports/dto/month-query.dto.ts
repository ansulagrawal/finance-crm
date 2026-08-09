import { IsDateString } from 'class-validator';

/** Legacy's month-scoped reports take a single "any date within the target
 * month" value and derive the month's start/end from it (`date('Y-m-01', ...)`
 * / `date('Y-m-t', ...)`). Kept the same shape here rather than a
 * from/to pair, since that's the real contract these reports have. */
export class MonthQueryDto {
  @IsDateString()
  month: string;
}
