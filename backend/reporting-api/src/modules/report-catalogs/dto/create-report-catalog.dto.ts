import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateReportCatalogDto {
  @ApiProperty({ description: 'Report/export name', example: 'Lead Total' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({
    description: 'Display heading shown in the UI',
    example: 'LEADS TOTAL',
  })
  @IsString()
  @MinLength(1)
  heading: string;

  @ApiPropertyOptional({
    description: 'Whether this report/export is actually reachable in the UI',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isLive?: boolean;
}
