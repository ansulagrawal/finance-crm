import { IsDateString } from 'class-validator';

/** Legacy's month-scoped reports take a single date anywhere in the target
 * month (`month_data`) and derive the first/last day of that month. */
export class MonthQueryDto {
  @IsDateString()
  month: string;
}
