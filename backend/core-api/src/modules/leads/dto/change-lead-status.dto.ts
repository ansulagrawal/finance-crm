import { IsInt, IsOptional, IsString } from 'class-validator';

export class ChangeLeadStatusDto {
  @IsInt()
  leadStatusId: number;

  @IsOptional()
  @IsString()
  remarks?: string;
}
