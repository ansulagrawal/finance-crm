import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateStateDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  code?: string;
}
