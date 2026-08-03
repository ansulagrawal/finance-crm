import { IsOptional, IsString } from 'class-validator';

export class SendToPreAuditDto {
  @IsOptional()
  @IsString()
  remarks?: string;
}
