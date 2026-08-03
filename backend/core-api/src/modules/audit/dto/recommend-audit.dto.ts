import { IsOptional, IsString } from 'class-validator';

export class RecommendAuditDto {
  @IsOptional()
  @IsString()
  remarks?: string;
}
