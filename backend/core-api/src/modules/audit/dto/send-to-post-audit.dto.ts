import { IsOptional, IsString } from 'class-validator';

export class SendToPostAuditDto {
  @IsOptional()
  @IsString()
  remarks?: string;
}
