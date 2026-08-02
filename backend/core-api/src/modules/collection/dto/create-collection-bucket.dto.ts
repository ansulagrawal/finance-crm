import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, MinLength } from 'class-validator';

export class CreateCollectionBucketDto {
  @ApiProperty({ description: 'Bucket name', example: '0-30 DPD' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({
    description: 'Start of the DPD range (inclusive)',
    example: 0,
  })
  @IsInt()
  startDpd: number;

  @ApiProperty({ description: 'End of the DPD range (inclusive)', example: 30 })
  @IsInt()
  endDpd: number;
}
