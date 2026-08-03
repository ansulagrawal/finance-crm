import {
  AccountAggregatorLog,
  EkycLog,
  EsignLog,
  Lead,
  LeadFollowup,
  User,
} from '@finance-crm/database';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CamService } from '../cam/cam.service';
import { LeadAssignmentStage } from '../leads/dto/assign-lead.dto';
import { LeadsService } from '../leads/leads.service';
import { VerificationService } from '../verification/verification.service';
import { SupportService } from './support.service';

function repo(overrides: Record<string, jest.Mock> = {}) {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    findOneBy: jest.fn().mockResolvedValue(null),
    save: jest.fn(async (x: unknown) => x),
    create: jest.fn((x: unknown) => x),
    ...overrides,
  };
}

describe('SupportService', () => {
  let service: SupportService;
  let leadRepository: ReturnType<typeof repo>;
  let userRepository: ReturnType<typeof repo>;
  let leadFollowupRepository: ReturnType<typeof repo>;
  let ekycLogRepository: ReturnType<typeof repo>;
  let esignLogRepository: ReturnType<typeof repo>;
  let accountAggregatorLogRepository: ReturnType<typeof repo>;
  let leadsService: { upsertCustomer: jest.Mock; upsertEmployment: jest.Mock };
  let verificationService: { createBanking: jest.Mock };
  let camService: { upsert: jest.Mock };

  beforeEach(async () => {
    leadRepository = repo();
    userRepository = repo();
    leadFollowupRepository = repo();
    ekycLogRepository = repo();
    esignLogRepository = repo();
    accountAggregatorLogRepository = repo();
    leadsService = {
      upsertCustomer: jest.fn().mockResolvedValue({ id: 1 }),
      upsertEmployment: jest.fn().mockResolvedValue({ id: 1 }),
    };
    verificationService = {
      createBanking: jest.fn().mockResolvedValue({ id: 1 }),
    };
    camService = { upsert: jest.fn().mockResolvedValue({ id: 1 }) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SupportService,
        { provide: getRepositoryToken(Lead), useValue: leadRepository },
        { provide: getRepositoryToken(User), useValue: userRepository },
        {
          provide: getRepositoryToken(LeadFollowup),
          useValue: leadFollowupRepository,
        },
        { provide: getRepositoryToken(EkycLog), useValue: ekycLogRepository },
        { provide: getRepositoryToken(EsignLog), useValue: esignLogRepository },
        {
          provide: getRepositoryToken(AccountAggregatorLog),
          useValue: accountAggregatorLogRepository,
        },
        { provide: LeadsService, useValue: leadsService },
        { provide: VerificationService, useValue: verificationService },
        { provide: CamService, useValue: camService },
      ],
    }).compile();

    service = moduleRef.get(SupportService);
  });

  describe('resetEkyc', () => {
    it('soft-deletes the latest ekyc log and writes a followup', async () => {
      const lead = { id: 1, leadStatus: { name: 'LEAD-INPROCESS' } };
      leadRepository.findOne.mockResolvedValue(lead);
      const log = { id: 5, isActive: true, isDeleted: false };
      ekycLogRepository.findOne.mockResolvedValue(log);

      await service.resetEkyc(1, 9);

      expect(log.isActive).toBe(false);
      expect(log.isDeleted).toBe(true);
      expect(ekycLogRepository.save).toHaveBeenCalledWith(log);
      expect(leadFollowupRepository.save).toHaveBeenCalled();
    });

    it('throws NotFoundException when the lead does not exist', async () => {
      leadRepository.findOne.mockResolvedValue(null);
      await expect(service.resetEkyc(404, 9)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('overrideAllocation', () => {
    it('rejects the override when the lead is not in an editable status', async () => {
      const lead = {
        id: 1,
        leadStatus: { name: 'DISBURSED' },
        rejectionReason: null,
      };
      leadRepository.findOne.mockResolvedValue(lead);

      await expect(
        service.overrideAllocation(
          1,
          { stage: LeadAssignmentStage.SCREENER, userId: 9 },
          1,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('reassigns the given stage and clears rejection metadata', async () => {
      const lead = {
        id: 1,
        leadStatus: { name: 'LEAD-INPROCESS' },
        rejectionReason: { id: 3 },
        rejectedBy: { id: 2 },
        rejectedAt: new Date(),
        screenerAssignedTo: null,
        screenerAssignedAt: null,
      };
      leadRepository.findOne.mockResolvedValue(lead);
      const assignee = { id: 9, name: 'Screener One' };
      userRepository.findOneBy.mockResolvedValue(assignee);

      const result = await service.overrideAllocation(
        1,
        { stage: LeadAssignmentStage.SCREENER, userId: 9 },
        1,
      );

      expect(lead.screenerAssignedTo).toBe(assignee);
      expect(lead.rejectionReason).toBeNull();
      expect(lead.rejectedBy).toBeNull();
      expect(lead.rejectedAt).toBeNull();
      expect(leadRepository.save).toHaveBeenCalledWith(lead);
      expect(result).toBe(lead);
    });
  });

  describe('overridePersonalDetail', () => {
    it('blocks the edit when the lead is not in an editable status', async () => {
      leadRepository.findOne.mockResolvedValue({
        id: 1,
        leadStatus: { name: 'CLOSED' },
      });

      await expect(service.overridePersonalDetail(1, {}, 9)).rejects.toThrow(
        ForbiddenException,
      );
      expect(leadsService.upsertCustomer).not.toHaveBeenCalled();
    });

    it('delegates to LeadsService when the lead is editable', async () => {
      leadRepository.findOne.mockResolvedValue({
        id: 1,
        leadStatus: { name: 'APPLICATION-INPROCESS' },
      });

      const result = await service.overridePersonalDetail(
        1,
        { firstName: 'A' },
        9,
      );

      expect(leadsService.upsertCustomer).toHaveBeenCalledWith(1, {
        firstName: 'A',
      });
      expect(leadFollowupRepository.save).toHaveBeenCalled();
      expect(result).toEqual({ id: 1 });
    });
  });

  describe('overrideCamDetail', () => {
    it('delegates to CamService with the status gate disabled — support has its own, wider status allow-list', async () => {
      leadRepository.findOne.mockResolvedValue({
        id: 1,
        leadStatus: { name: 'SANCTION' },
      });

      const dto = { recommendedLoanAmount: 50000 };
      await service.overrideCamDetail(1, dto as never, 9);

      expect(camService.upsert).toHaveBeenCalledWith(1, dto, false);
      expect(leadFollowupRepository.save).toHaveBeenCalled();
    });

    it('blocks the edit when the lead is outside even support’s wider allow-list', async () => {
      leadRepository.findOne.mockResolvedValue({
        id: 1,
        leadStatus: { name: 'CLOSED' },
      });

      await expect(
        service.overrideCamDetail(1, {} as never, 9),
      ).rejects.toThrow(ForbiddenException);
      expect(camService.upsert).not.toHaveBeenCalled();
    });
  });
});
