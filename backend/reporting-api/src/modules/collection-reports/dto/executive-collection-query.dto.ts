import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt } from 'class-validator';

/** Legacy's `type_id`: 1 = filter by actual payment date, 2 = filter by the
 * loan's repayment (due) date. Both dates are required here (legacy
 * redirects to the picker page if either is missing). */
export class ExecutiveCollectionQueryDto {
  @IsDateString()
  fromDate: string;

  @IsDateString()
  toDate: string;

  @Type(() => Number)
  @IsInt()
  @IsIn([1, 2])
  typeId: 1 | 2;
}
