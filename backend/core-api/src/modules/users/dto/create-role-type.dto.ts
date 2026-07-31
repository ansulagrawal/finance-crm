import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateRoleTypeDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  heading?: string;

  @IsString()
  @MaxLength(20)
  code: string;
}
