import { IsOptional, IsString } from 'class-validator';

export class SendBackCamDto {
  @IsOptional()
  @IsString()
  remarks?: string;
}
