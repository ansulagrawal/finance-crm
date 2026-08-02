import { IsString, MinLength } from 'class-validator';

export class CreateFeedbackAnswerDto {
  @IsString()
  @MinLength(1)
  answer: string;

  @IsString()
  @MinLength(1)
  icon: string;
}
