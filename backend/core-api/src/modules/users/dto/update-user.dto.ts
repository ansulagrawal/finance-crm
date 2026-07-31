import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'Full name of the user',
    example: 'Priya Sharma',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Mobile number', example: '9876543210' })
  @IsOptional()
  @IsString()
  mobile?: string;

  @ApiPropertyOptional({ description: 'Username', example: 'priya.sharma' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({
    description: 'Company ID the user belongs to',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  companyId?: number;

  @ApiPropertyOptional({
    description: 'Product ID the user is scoped to',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  productId?: number;
}
