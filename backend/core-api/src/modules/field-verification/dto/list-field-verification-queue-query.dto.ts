import { PaginationQueryDto } from '@finance-crm/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { FieldVerificationTrack } from '../field-verification.types';

export class ListFieldVerificationQueueQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by verification track',
    enum: FieldVerificationTrack,
  })
  @IsOptional()
  @IsEnum(FieldVerificationTrack)
  track?: FieldVerificationTrack;
}
