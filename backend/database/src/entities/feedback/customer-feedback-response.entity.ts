import { Entity, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { CustomerFeedback } from './customer-feedback.entity';
import { FeedbackAnswer } from './feedback-answer.entity';
import { FeedbackQuestion } from './feedback-question.entity';

@Entity('customer_feedback_responses')
export class CustomerFeedbackResponse extends BaseEntity {
  @ManyToOne(() => CustomerFeedback)
  feedback: CustomerFeedback;

  @ManyToOne(() => FeedbackQuestion)
  question: FeedbackQuestion;

  @ManyToOne(() => FeedbackAnswer)
  answer: FeedbackAnswer;
}
