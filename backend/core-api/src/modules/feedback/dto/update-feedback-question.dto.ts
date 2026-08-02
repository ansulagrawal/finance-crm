import { PartialType } from '@nestjs/mapped-types';
import { CreateFeedbackQuestionDto } from './create-feedback-question.dto';

export class UpdateFeedbackQuestionDto extends PartialType(
  CreateFeedbackQuestionDto,
) {}
