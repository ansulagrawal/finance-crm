import { IsDateString } from 'class-validator';

/** Legacy's FY-scoped reports take a date anywhere in the FY's first month
 * and derive a 12-month window from it. */
export class FinancialYearQueryDto {
  @IsDateString()
  financialYearStart: string;
}
