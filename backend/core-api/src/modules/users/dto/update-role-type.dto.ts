import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateRoleTypeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  heading?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  code?: string;
}
