import { IsBooleanString, IsOptional } from 'class-validator';
import { DateRangeQueryDto } from '../../../common/dto/date-range-query.dto';

/** `includeContactDetails` mirrors legacy's role-gated extra PII columns on
 * `exportCSVCollection` — the controller only honors this flag when the
 * caller's role is SA/CA (checked in the controller, not trusted from the
 * query string alone). */
export class CollectionExportQueryDto extends DateRangeQueryDto {
  @IsOptional()
  @IsBooleanString()
  includeContactDetails?: string;
}
