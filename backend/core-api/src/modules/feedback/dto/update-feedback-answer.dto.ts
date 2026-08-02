import { PartialType } from '@nestjs/mapped-types';
import { CreateFeedbackAnswerDto } from './create-feedback-answer.dto';

export class UpdateFeedbackAnswerDto extends PartialType(
  CreateFeedbackAnswerDto,
) {}
