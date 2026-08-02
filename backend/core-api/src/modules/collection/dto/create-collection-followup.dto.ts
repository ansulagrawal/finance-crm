import { IsDateString, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateCollectionFollowupDto {
  @IsInt()
  typeId: number;

  @IsOptional()
  @IsInt()
  statusId?: number;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsDateString()
  nextFollowupAt?: string;
}
