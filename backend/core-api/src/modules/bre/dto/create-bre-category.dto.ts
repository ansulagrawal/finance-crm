import { IsString, MinLength } from 'class-validator';

export class CreateBreCategoryDto {
  @IsString()
  @MinLength(1)
  name: string;
}
