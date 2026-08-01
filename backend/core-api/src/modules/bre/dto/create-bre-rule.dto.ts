import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, MinLength } from 'class-validator';

export class CreateBreRuleDto {
  @ApiProperty({ description: 'Rule name', example: 'Minimum CIBIL score' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({
    description: 'BRE category ID this rule belongs to',
    example: 1,
  })
  @IsInt()
  categoryId: number;
}
