import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ description: 'Product type label', example: 'NBFC' })
  @IsOptional()
  @IsString()
  productType?: string;
}
