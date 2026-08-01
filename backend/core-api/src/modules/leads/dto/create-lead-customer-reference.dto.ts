import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateLeadCustomerReferenceDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(1)
  mobile: string;

  @IsOptional()
  @IsInt()
  relationType?: number;
}
