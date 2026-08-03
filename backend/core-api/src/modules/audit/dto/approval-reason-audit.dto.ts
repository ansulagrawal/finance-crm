import { IsString } from 'class-validator';

export class ApprovalReasonAuditDto {
  @IsString()
  remarks: string;
}
