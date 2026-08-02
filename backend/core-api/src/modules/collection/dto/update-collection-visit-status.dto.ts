import { IsBoolean, IsOptional, IsString } from 'class-validator';

/**
 * No `fieldStatus` enum exists on `LoanCollectionVisit` (see
 * `create-collection-visit.dto.ts`) — outcome is recorded as a completion
 * flag (sets `completedAt`) plus free-text remarks/reject reason.
 */
export class UpdateCollectionVisitStatusDto {
  @IsOptional()
  @IsBoolean()
  completed?: boolean;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsString()
  rejectReason?: string;
}
