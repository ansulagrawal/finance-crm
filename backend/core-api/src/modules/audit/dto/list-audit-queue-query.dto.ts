import { PaginationQueryDto } from '@finance-crm/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export enum AuditQueueStage {
  AUDIT_NEW = 'AUDIT-NEW',
  AUDIT_INPROCESS = 'AUDIT-INPROCESS',
  AUDIT_HOLD = 'AUDIT-HOLD',
  AUDIT_RECOMMENDED = 'AUDIT-RECOMMENDED',
}

export class ListAuditQueueQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by audit queue stage',
    enum: AuditQueueStage,
  })
  @IsOptional()
  @IsEnum(AuditQueueStage)
  stage?: AuditQueueStage;
}
