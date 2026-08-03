import { IsDateString, IsString } from 'class-validator';

export class HoldAuditDto {
  @IsString()
  remarks: string;

  @IsDateString()
  scheduledAt: string;
}
