import { IsDateString } from 'class-validator';

/** Several legacy sanction reports take a single "any day in the target
 * month" param and derive the month's first/last day from it (`SanctionKPIModel`,
 * `OutstandingReportAmountModel`, `SanctionExecutiveTAModel`). */
export class MonthQueryDto {
  @IsDateString()
  month: string;
}
