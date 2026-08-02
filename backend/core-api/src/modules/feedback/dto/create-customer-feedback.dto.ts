import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class FeedbackResponseItemDto {
  @ApiProperty({ description: 'Feedback question ID', example: 1 })
  @IsInt()
  questionId: number;

  @ApiProperty({ description: 'Selected feedback answer ID', example: 1 })
  @IsInt()
  answerId: number;
}

export class CreateCustomerFeedbackDto {
  @ApiPropertyOptional({
    description: 'Name of the customer giving feedback',
    example: 'Ramesh',
  })
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiPropertyOptional({
    description: 'Email of the customer',
    example: 'ramesh@example.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Mobile number of the customer',
    example: '9876543210',
  })
  @IsOptional()
  @IsString()
  mobile?: string;

  @ApiPropertyOptional({ description: 'Free-text remarks' })
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiProperty({
    description: 'List of question/answer responses',
    type: [FeedbackResponseItemDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FeedbackResponseItemDto)
  responses: FeedbackResponseItemDto[];
}
