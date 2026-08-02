import { findOrFail } from '@finance-crm/common';
import {
  CustomerFeedback,
  CustomerFeedbackResponse,
  FeedbackAnswer,
  FeedbackQuestion,
  Lead,
} from '@finance-crm/database';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { CreateCustomerFeedbackDto } from './dto/create-customer-feedback.dto';
import { CreateFeedbackAnswerDto } from './dto/create-feedback-answer.dto';
import { CreateFeedbackQuestionDto } from './dto/create-feedback-question.dto';
import { UpdateFeedbackAnswerDto } from './dto/update-feedback-answer.dto';
import { UpdateFeedbackQuestionDto } from './dto/update-feedback-question.dto';

@Injectable()
export class FeedbackService {
  constructor(
    @InjectRepository(CustomerFeedback)
    private readonly customerFeedbackRepository: Repository<CustomerFeedback>,
    @InjectRepository(CustomerFeedbackResponse)
    private readonly customerFeedbackResponseRepository: Repository<CustomerFeedbackResponse>,
    @InjectRepository(FeedbackQuestion)
    private readonly feedbackQuestionRepository: Repository<FeedbackQuestion>,
    @InjectRepository(FeedbackAnswer)
    private readonly feedbackAnswerRepository: Repository<FeedbackAnswer>,
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
  ) {}

  // Questions
  listQuestions(): Promise<FeedbackQuestion[]> {
    return this.feedbackQuestionRepository.find({
      where: { isActive: true },
      order: { id: 'ASC' },
    });
  }

  findQuestionById(id: number): Promise<FeedbackQuestion> {
    return findOrFail(this.feedbackQuestionRepository, id, 'Feedback question');
  }

  createQuestion(dto: CreateFeedbackQuestionDto): Promise<FeedbackQuestion> {
    const question = this.feedbackQuestionRepository.create({
      question: dto.question,
    });
    return this.feedbackQuestionRepository.save(question);
  }

  async updateQuestion(
    id: number,
    dto: UpdateFeedbackQuestionDto,
  ): Promise<FeedbackQuestion> {
    const question = await this.findQuestionById(id);
    if (dto.question !== undefined) question.question = dto.question;
    return this.feedbackQuestionRepository.save(question);
  }

  async removeQuestion(id: number): Promise<void> {
    const question = await this.findQuestionById(id);
    question.isActive = false;
    question.isDeleted = true;
    await this.feedbackQuestionRepository.save(question);
  }

  // Answers
  listAnswers(): Promise<FeedbackAnswer[]> {
    return this.feedbackAnswerRepository.find({
      where: { isActive: true },
      order: { id: 'ASC' },
    });
  }

  findAnswerById(id: number): Promise<FeedbackAnswer> {
    return findOrFail(this.feedbackAnswerRepository, id, 'Feedback answer');
  }

  createAnswer(dto: CreateFeedbackAnswerDto): Promise<FeedbackAnswer> {
    const answer = this.feedbackAnswerRepository.create({
      answer: dto.answer,
      icon: dto.icon,
    });
    return this.feedbackAnswerRepository.save(answer);
  }

  async updateAnswer(
    id: number,
    dto: UpdateFeedbackAnswerDto,
  ): Promise<FeedbackAnswer> {
    const answer = await this.findAnswerById(id);
    if (dto.answer !== undefined) answer.answer = dto.answer;
    if (dto.icon !== undefined) answer.icon = dto.icon;
    return this.feedbackAnswerRepository.save(answer);
  }

  async removeAnswer(id: number): Promise<void> {
    const answer = await this.findAnswerById(id);
    answer.isActive = false;
    answer.isDeleted = true;
    await this.feedbackAnswerRepository.save(answer);
  }

  // Customer feedback submissions
  async listForLead(leadId: number): Promise<CustomerFeedback[]> {
    await findOrFail(this.leadRepository, leadId, 'Lead');
    return this.customerFeedbackRepository.find({
      where: { lead: { id: leadId } },
      order: { id: 'DESC' },
    });
  }

  async findById(id: number): Promise<CustomerFeedback> {
    return findOrFail(this.customerFeedbackRepository, id, 'Customer feedback');
  }

  async listResponses(feedbackId: number): Promise<CustomerFeedbackResponse[]> {
    return this.customerFeedbackResponseRepository.find({
      where: { feedback: { id: feedbackId } },
      relations: { question: true, answer: true },
      order: { id: 'ASC' },
    });
  }

  /**
   * Returns only the new feedback's id — deliberately NOT the saved entity.
   * This is reached from an unauthenticated route, and the saved entity
   * carries the `lead` relation that was just assigned onto it: a full
   * `Lead` row, which has no `@Exclude()` fields, so
   * `ClassSerializerInterceptor` passed its `mobile`/`email`/`pancard`
   * straight through. Anyone could walk `leadId` and harvest borrower PII
   * from a public endpoint.
   */
  async submit(
    leadId: number,
    dto: CreateCustomerFeedbackDto,
  ): Promise<{ id: number }> {
    const lead = await findOrFail(this.leadRepository, leadId, 'Lead');

    const feedback = this.customerFeedbackRepository.create({
      lead,
      customerName: dto.customerName ?? null,
      email: dto.email ?? null,
      mobile: dto.mobile ?? null,
      remarks: dto.remarks ?? null,
    });
    const savedFeedback = await this.customerFeedbackRepository.save(feedback);

    for (const item of dto.responses) {
      const question = await findOrFail(
        this.feedbackQuestionRepository,
        item.questionId,
        'Feedback question',
      );
      const answer = await findOrFail(
        this.feedbackAnswerRepository,
        item.answerId,
        'Feedback answer',
      );
      const response = this.customerFeedbackResponseRepository.create({
        feedback: savedFeedback,
        question,
        answer,
      });
      await this.customerFeedbackResponseRepository.save(response);
    }

    return { id: savedFeedback.id };
  }
}
