import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { CustomerFeedbackController } from './customer-feedback.controller';
import { FeedbackAnswersController } from './feedback-answers.controller';
import { FeedbackQuestionsController } from './feedback-questions.controller';
import { FeedbackService } from './feedback.service';

@Module({
  imports: [CommonModule],
  providers: [FeedbackService],
  controllers: [
    FeedbackQuestionsController,
    FeedbackAnswersController,
    CustomerFeedbackController,
  ],
  exports: [FeedbackService],
})
export class FeedbackModule {}
