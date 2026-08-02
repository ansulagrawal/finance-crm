import { IsDateString, IsOptional, IsString } from 'class-validator';

/**
 * `LoanCollectionVisit` (`tbl_collection_followup`) is GPS/visit-shaped in the
 * real legacy schema — free-text `visitAddress`, no `addressType`/`fieldStatus`
 * enums (those existed only in the pre-rewrite entity, not the legacy table).
 */
export class CreateCollectionVisitDto {
  @IsOptional()
  @IsString()
  visitAddress?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}
