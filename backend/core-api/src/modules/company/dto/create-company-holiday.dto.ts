import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsString, MinLength } from 'class-validator';

export class CreateCompanyHolidayDto {
  @ApiProperty({
    description: 'Holiday date (ISO date)',
    example: '2026-08-15',
  })
  @IsDateString()
  holidayDate: string;

  @ApiProperty({ description: 'Holiday name', example: 'Independence Day' })
  @IsString()
  @MinLength(1)
  name: string;
}
