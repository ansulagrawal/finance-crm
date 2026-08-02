import {
  CustomerFeedback,
  CustomerFeedbackResponse,
  FeedbackAnswer,
  FeedbackQuestion,
  Lead,
} from '@finance-crm/database';
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FeedbackService } from './feedback.service';

function repo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    findOneBy: jest.fn().mockResolvedValue(null),
    create: jest.fn((x: unknown) => x),
    save: jest.fn(async (x: unknown) => x),
    ...overrides,
  };
}

describe('FeedbackService', () => {
  let service: FeedbackService;
  let customerFeedbackRepository: ReturnType<typeof repo>;
  let customerFeedbackResponseRepository: ReturnType<typeof repo>;
  let feedbackQuestionRepository: ReturnType<typeof repo>;
  let feedbackAnswerRepository: ReturnType<typeof repo>;
  let leadRepository: ReturnType<typeof repo>;

  beforeEach(async () => {
    customerFeedbackRepository = repo();
    customerFeedbackResponseRepository = repo();
    feedbackQuestionRepository = repo();
    feedbackAnswerRepository = repo();
    leadRepository = repo();

    const moduleRef = await Test.createTestingModule({
      providers: [
        FeedbackService,
        {
          provide: getRepositoryToken(CustomerFeedback),
          useValue: customerFeedbackRepository,
        },
        {
          provide: getRepositoryToken(CustomerFeedbackResponse),
          useValue: customerFeedbackResponseRepository,
        },
        {
          provide: getRepositoryToken(FeedbackQuestion),
          useValue: feedbackQuestionRepository,
        },
        {
          provide: getRepositoryToken(FeedbackAnswer),
          useValue: feedbackAnswerRepository,
        },
        { provide: getRepositoryToken(Lead), useValue: leadRepository },
      ],
    }).compile();

    service = moduleRef.get(FeedbackService);
  });

  describe('questions/answers CRUD', () => {
    it('listQuestions only returns active rows, ordered by id', async () => {
      await service.listQuestions();
      expect(feedbackQuestionRepository.find).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { id: 'ASC' },
      });
    });

    it('findQuestionById throws NotFoundException for an unknown id', async () => {
      feedbackQuestionRepository.findOneBy.mockResolvedValue(null);
      await expect(service.findQuestionById(404)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('removeQuestion soft-deletes rather than deleting the row', async () => {
      feedbackQuestionRepository.findOneBy.mockResolvedValue({
        id: 1,
        isActive: true,
        isDeleted: false,
      });

      await service.removeQuestion(1);

      expect(feedbackQuestionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false, isDeleted: true }),
      );
    });

    it('listAnswers only returns active rows, ordered by id', async () => {
      await service.listAnswers();
      expect(feedbackAnswerRepository.find).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { id: 'ASC' },
      });
    });

    it('findAnswerById throws NotFoundException for an unknown id', async () => {
      feedbackAnswerRepository.findOneBy.mockResolvedValue(null);
      await expect(service.findAnswerById(404)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('listForLead', () => {
    it('throws NotFoundException for an unknown lead and does not query feedback', async () => {
      leadRepository.findOneBy.mockResolvedValue(null);

      await expect(service.listForLead(404)).rejects.toThrow(NotFoundException);
      expect(customerFeedbackRepository.find).not.toHaveBeenCalled();
    });

    it('scopes feedback to the given lead, newest first', async () => {
      leadRepository.findOneBy.mockResolvedValue({ id: 1 });
      const rows = [{ id: 2 }, { id: 1 }];
      customerFeedbackRepository.find.mockResolvedValue(rows);

      const result = await service.listForLead(1);

      expect(customerFeedbackRepository.find).toHaveBeenCalledWith({
        where: { lead: { id: 1 } },
        order: { id: 'DESC' },
      });
      expect(result).toEqual(rows);
    });
  });

  describe('submit', () => {
    it('throws NotFoundException for an unknown lead and creates no feedback', async () => {
      leadRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.submit(404, {
          responses: [{ questionId: 1, answerId: 1 }],
        }),
      ).rejects.toThrow(NotFoundException);
      expect(customerFeedbackRepository.create).not.toHaveBeenCalled();
    });

    it('rejects the whole submission if any response references an unknown question, without recording partial responses', async () => {
      leadRepository.findOneBy.mockResolvedValue({ id: 1 });
      feedbackQuestionRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.submit(1, {
          responses: [{ questionId: 404, answerId: 1 }],
        }),
      ).rejects.toThrow(NotFoundException);
      expect(customerFeedbackResponseRepository.create).not.toHaveBeenCalled();
    });

    it('rejects the whole submission if any response references an unknown answer', async () => {
      leadRepository.findOneBy.mockResolvedValue({ id: 1 });
      feedbackQuestionRepository.findOneBy.mockResolvedValue({ id: 1 });
      feedbackAnswerRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.submit(1, {
          responses: [{ questionId: 1, answerId: 404 }],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('saves the feedback header once and one response row per question/answer pair', async () => {
      const lead = { id: 1 };
      leadRepository.findOneBy.mockResolvedValue(lead);
      const question1 = { id: 1, question: 'Q1' };
      const question2 = { id: 2, question: 'Q2' };
      const answer1 = { id: 10, answer: 'A1' };
      const answer2 = { id: 20, answer: 'A2' };
      feedbackQuestionRepository.findOneBy
        .mockResolvedValueOnce(question1)
        .mockResolvedValueOnce(question2);
      feedbackAnswerRepository.findOneBy
        .mockResolvedValueOnce(answer1)
        .mockResolvedValueOnce(answer2);
      // Saved entity deliberately carries the `lead` relation, so the
      // assertion below proves `submit` strips it rather than that it was
      // never there.
      customerFeedbackRepository.save.mockResolvedValue({
        id: 99,
        lead,
        customerName: 'Jane',
      });

      const result = await service.submit(1, {
        customerName: 'Jane',
        responses: [
          { questionId: 1, answerId: 10 },
          { questionId: 2, answerId: 20 },
        ],
      });

      expect(customerFeedbackRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ lead, customerName: 'Jane' }),
      );
      expect(customerFeedbackRepository.save).toHaveBeenCalledTimes(1);
      expect(customerFeedbackResponseRepository.create).toHaveBeenCalledTimes(
        2,
      );
      expect(customerFeedbackResponseRepository.create).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ question: question1, answer: answer1 }),
      );
      expect(customerFeedbackResponseRepository.create).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ question: question2, answer: answer2 }),
      );
      expect(customerFeedbackResponseRepository.save).toHaveBeenCalledTimes(2);
      // Only the id comes back. `submit` is reached from an unauthenticated
      // route, and returning the saved entity leaked the whole `lead`
      // relation — mobile/email/pancard included, since `Lead` has no
      // `@Exclude()` fields — to anyone willing to walk leadId.
      expect(result).toEqual({ id: 99 });
    });
  });
});
