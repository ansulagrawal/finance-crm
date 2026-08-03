import { IsString } from 'class-validator';

export class SendBackAuditDto {
  @IsString()
  remarks: string;
}
