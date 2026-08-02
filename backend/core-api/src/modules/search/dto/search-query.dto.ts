import { IsString, MinLength } from 'class-validator';

export class SearchQueryDto {
  @IsString()
  @MinLength(2)
  q: string;
}
