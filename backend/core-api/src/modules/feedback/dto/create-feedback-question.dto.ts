import { IsString, MinLength } from 'class-validator';

export class CreateFeedbackQuestionDto {
  @IsString()
  @MinLength(1)
  question: string;
}
