import {
  CamStatus,
  CifCustomer,
  CreditAnalysisMemo,
  Lead,
  LeadCustomer,
  LeadEmployment,
  LeadFollowup,
  MasterStatus,
  User,
} from '@finance-crm/database';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CompanyHolidaysService } from '../company/company-holidays.service';
import { CamService } from './cam.service';

function repo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    findOneBy: jest.fn().mockResolvedValue(null),
    save: jest.fn(async (x: unknown) => x),
    create: jest.fn((x: unknown) => x),
    ...overrides,
  };
}

describe('CamService', () => {
  let service: CamService;
  let camRepository: ReturnType<typeof repo>;
  let leadRepository: ReturnType<typeof repo>;
  let userRepository: ReturnType<typeof repo>;
  let cifCustomerRepository: ReturnType<typeof repo>;
  let masterStatusRepository: ReturnType<typeof repo>;
  let leadFollowupRepository: ReturnType<typeof repo>;
  let leadCustomerRepository: ReturnType<typeof repo>;
  let leadEmploymentRepository: ReturnType<typeof repo>;
  let companyHolidaysService: { getActiveHolidayDates: jest.Mock };
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    camRepository = repo();
    leadRepository = repo();
    userRepository = repo();
    cifCustomerRepository = repo();
    masterStatusRepository = repo();
    leadFollowupRepository = repo();
    leadCustomerRepository = repo();
    leadEmploymentRepository = repo();
    companyHolidaysService = {
      getActiveHolidayDates: jest.fn().mockResolvedValue(new Set()),
    };
    configService = {
      get: jest.fn((_key: string, defaultValue?: string) => defaultValue),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CamService,
        {
          provide: getRepositoryToken(CreditAnalysisMemo),
          useValue: camRepository,
        },
        { provide: getRepositoryToken(Lead), useValue: leadRepository },
        { provide: getRepositoryToken(User), useValue: userRepository },
        {
          provide: getRepositoryToken(CifCustomer),
          useValue: cifCustomerRepository,
        },
        {
          provide: getRepositoryToken(MasterStatus),
          useValue: masterStatusRepository,
        },
        {
          provide: getRepositoryToken(LeadFollowup),
          useValue: leadFollowupRepository,
        },
        {
          provide: getRepositoryToken(LeadCustomer),
          useValue: leadCustomerRepository,
        },
        {
          provide: getRepositoryToken(LeadEmployment),
          useValue: leadEmploymentRepository,
        },
        {
          provide: CompanyHolidaysService,
          useValue: companyHolidaysService,
        },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = moduleRef.get(CamService);
  });

  describe('findByLead', () => {
    it('returns the CAM for a lead', async () => {
      const cam = { id: 1 };
      camRepository.findOne.mockResolvedValue(cam);
      await expect(service.findByLead(1)).resolves.toBe(cam);
    });

    it('throws NotFoundException when no CAM exists for the lead', async () => {
      camRepository.findOne.mockResolvedValue(null);
      await expect(service.findByLead(1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('upsert', () => {
    const editableStatus = { id: 5, name: 'APPLICATION-INPROCESS' };
    /** Lead loaded via `leadRepository.findOne` (with `leadStatus`), distinct
     * from the plain `findOneBy` existence check. `loanAmount: 200000` and a
     * generous income/obligations pair keep the new loan-limit checks out of
     * the way of tests that aren't exercising them. */
    const editableLead = (overrides: Record<string, unknown> = {}) => ({
      id: 1,
      loanAmount: 200000,
      userType: 'NEW',
      leadStatus: editableStatus,
      ...overrides,
    });
    const baseDto = {
      recommendedLoanAmount: 50000,
      roi: 24,
      tenureDays: 30,
      netDisbursalAmount: 49000,
      repaymentAmount: 51000,
      appraisedMonthlyIncome: 200000,
      appraisedObligations: 0,
    };

    beforeEach(() => {
      masterStatusRepository.find.mockResolvedValue([editableStatus]);
      leadCustomerRepository.findOne.mockResolvedValue({
        currentAddressLine1: '221B Baker St',
        currentAddressLine2: 'Marylebone',
        city: { id: 1 },
        state: { id: 1 },
        pincode: '110001',
        aaAddressLine1: '221B Baker St',
        aaAddressLine2: 'Marylebone',
        aaCity: { id: 1 },
        aaState: { id: 1 },
        aaPincode: '110001',
      });
      leadEmploymentRepository.findOne.mockResolvedValue({
        addressLine1: 'Tech Park',
        addressLine2: 'Sector 5',
        state: { id: 1 },
        pincode: '110002',
      });
    });

    it('creates a new DRAFT CAM when none exists yet', async () => {
      const lead = editableLead();
      leadRepository.findOneBy.mockResolvedValue(lead);
      leadRepository.findOne.mockResolvedValue(lead);
      camRepository.findOne.mockResolvedValue(null);

      const result = await service.upsert(1, baseDto as never);

      expect(camRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ lead, status: CamStatus.DRAFT }),
      );
      expect(result.recommendedLoanAmount).toBe(50000);
      expect(camRepository.save).toHaveBeenCalled();
    });

    it('updates the existing CAM in place, preserving its status', async () => {
      const lead = editableLead();
      leadRepository.findOneBy.mockResolvedValue(lead);
      leadRepository.findOne.mockResolvedValue(lead);
      const existing = {
        id: 9,
        status: CamStatus.SANCTION,
        recommendedLoanAmount: 1,
      };
      camRepository.findOne.mockResolvedValue(existing);

      const result = await service.upsert(1, {
        ...baseDto,
        recommendedLoanAmount: 60000,
        roi: 20,
        tenureDays: 45,
        netDisbursalAmount: 59000,
        repaymentAmount: 61000,
      } as never);

      expect(camRepository.create).not.toHaveBeenCalled();
      expect(result).toBe(existing);
      expect(existing.recommendedLoanAmount).toBe(60000);
      expect(existing.status).toBe(CamStatus.SANCTION);
    });

    it('throws NotFoundException when the lead does not exist', async () => {
      leadRepository.findOneBy.mockResolvedValue(null);
      await expect(service.upsert(404, baseDto as never)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects when the lead is not in an editable credit-review status', async () => {
      const lead = editableLead({
        leadStatus: { id: 4, name: 'APPLICATION-NEW' },
      });
      leadRepository.findOneBy.mockResolvedValue(lead);
      leadRepository.findOne.mockResolvedValue(lead);

      await expect(service.upsert(1, baseDto as never)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects when residence address fields are incomplete', async () => {
      const lead = editableLead();
      leadRepository.findOneBy.mockResolvedValue(lead);
      leadRepository.findOne.mockResolvedValue(lead);
      leadCustomerRepository.findOne.mockResolvedValue({
        currentAddressLine1: '221B Baker St',
        currentAddressLine2: null,
        city: { id: 1 },
        state: { id: 1 },
        pincode: '110001',
      });

      await expect(service.upsert(1, baseDto as never)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects when aadhaar address fields are incomplete', async () => {
      const lead = editableLead();
      leadRepository.findOneBy.mockResolvedValue(lead);
      leadRepository.findOne.mockResolvedValue(lead);
      leadCustomerRepository.findOne.mockResolvedValue({
        currentAddressLine1: '221B Baker St',
        currentAddressLine2: 'Marylebone',
        city: { id: 1 },
        state: { id: 1 },
        pincode: '110001',
        aaAddressLine1: '221B Baker St',
        aaAddressLine2: null,
        aaCity: { id: 1 },
        aaState: { id: 1 },
        aaPincode: '110001',
      });

      await expect(service.upsert(1, baseDto as never)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects when office address fields are incomplete', async () => {
      const lead = editableLead();
      leadRepository.findOneBy.mockResolvedValue(lead);
      leadRepository.findOne.mockResolvedValue(lead);
      leadEmploymentRepository.findOne.mockResolvedValue({
        addressLine1: 'Tech Park',
        addressLine2: 'Sector 5',
        state: null,
        pincode: '110002',
      });

      await expect(service.upsert(1, baseDto as never)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('skips address validation when enforceStatusGate is false (support override)', async () => {
      const lead = editableLead();
      leadRepository.findOneBy.mockResolvedValue(lead);
      leadRepository.findOne.mockResolvedValue(lead);
      leadCustomerRepository.findOne.mockResolvedValue(null);
      leadEmploymentRepository.findOne.mockResolvedValue(null);
      camRepository.findOne.mockResolvedValue(null);

      const result = await service.upsert(1, baseDto as never, false);

      expect(result.recommendedLoanAmount).toBe(50000);
    });

    it('rejects a recommended amount greater than the applied loan amount', async () => {
      const lead = editableLead({ loanAmount: 40000 });
      leadRepository.findOneBy.mockResolvedValue(lead);
      leadRepository.findOne.mockResolvedValue(lead);

      await expect(
        service.upsert(1, {
          ...baseDto,
          recommendedLoanAmount: 50000,
        } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a recommended amount greater than the computed eligible loan (flat NEW FOIR 45%)', async () => {
      const lead = editableLead();
      leadRepository.findOneBy.mockResolvedValue(lead);
      leadRepository.findOne.mockResolvedValue(lead);

      // eligible = (30000 - 0) * 0.45 = 13500
      await expect(
        service.upsert(1, {
          ...baseDto,
          recommendedLoanAmount: 14000,
          appraisedMonthlyIncome: 30000,
          appraisedObligations: 0,
        } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows a REPEAT lead the wider 50% FOIR cap', async () => {
      const lead = editableLead({ userType: 'REPEAT' });
      leadRepository.findOneBy.mockResolvedValue(lead);
      leadRepository.findOne.mockResolvedValue(lead);
      camRepository.findOne.mockResolvedValue(null);

      // eligible = (30000 - 0) * 0.5 = 15000
      const result = await service.upsert(1, {
        ...baseDto,
        recommendedLoanAmount: 15000,
        appraisedMonthlyIncome: 30000,
        appraisedObligations: 0,
      } as never);

      expect(result.recommendedLoanAmount).toBe(15000);
    });

    it('gets the same flat-FOIR cap as any other lead for an STP (creationMode=1) lead', async () => {
      const lead = editableLead({ creationMode: 1 });
      leadRepository.findOneBy.mockResolvedValue(lead);
      leadRepository.findOne.mockResolvedValue(lead);
      camRepository.findOne.mockResolvedValue(null);

      // eligible via flat FOIR = (10000 - 0) * 0.45 = 4500 - the STP flag
      // no longer changes the cap (Credeau integration removed).
      await expect(
        service.upsert(1, {
          ...baseDto,
          recommendedLoanAmount: 4999,
          appraisedMonthlyIncome: 10000,
          appraisedObligations: 0,
        } as never),
      ).rejects.toThrow(BadRequestException);
    });

    describe('repayment-date working-day adjustment', () => {
      beforeEach(() => {
        const lead = editableLead();
        leadRepository.findOneBy.mockResolvedValue(lead);
        leadRepository.findOne.mockResolvedValue(lead);
        camRepository.findOne.mockResolvedValue(null);
      });

      const upsertWithRepaymentDate = async (repaymentDate: string) => {
        const result = await service.upsert(1, {
          ...baseDto,
          repaymentDate,
        } as never);
        return (result.repaymentDate as Date).toISOString().slice(0, 10);
      };

      it('leaves a date that is neither Sunday nor a holiday unchanged', async () => {
        // 2026-01-06 is a Tuesday
        expect(await upsertWithRepaymentDate('2026-01-06')).toBe('2026-01-06');
      });

      it('moves a Sunday back to the previous working day by default', async () => {
        // 2026-01-04 is a Sunday
        expect(await upsertWithRepaymentDate('2026-01-04')).toBe('2026-01-03');
      });

      it('moves a holiday back, continuing past a Sunday it lands on', async () => {
        // 2026-01-05 (Monday) is a holiday; stepping back lands on
        // 2026-01-04, a Sunday - the unified loop must keep going instead
        // of stopping there (legacy's own two-phase check would have
        // stopped at the Sunday without re-checking it).
        companyHolidaysService.getActiveHolidayDates.mockResolvedValue(
          new Set(['2026-01-05']),
        );
        expect(await upsertWithRepaymentDate('2026-01-05')).toBe('2026-01-03');
      });

      it('walks back through consecutive holiday days', async () => {
        companyHolidaysService.getActiveHolidayDates.mockResolvedValue(
          new Set(['2026-01-08', '2026-01-07', '2026-01-06']),
        );
        expect(await upsertWithRepaymentDate('2026-01-08')).toBe('2026-01-05');
      });

      it('moves forward instead when REPAYMENT_DATE_WORKING_DAY_DIRECTION=next', async () => {
        configService.get.mockImplementation(
          (key: string, defaultValue?: string) =>
            key === 'REPAYMENT_DATE_WORKING_DAY_DIRECTION'
              ? 'next'
              : defaultValue,
        );
        // 2026-01-04 is a Sunday
        expect(await upsertWithRepaymentDate('2026-01-04')).toBe('2026-01-05');
      });
    });
  });

  describe('sanction', () => {
    it('marks the CAM SANCTION and stamps sanctionedBy/updatedAt', async () => {
      const lead = { id: 1, pancard: 'ABCDE1234F' };
      const cam = { id: 1, status: CamStatus.DRAFT, lead };
      const sanctionedBy = { id: 9 };
      camRepository.findOne.mockResolvedValue(cam);
      userRepository.findOneBy.mockResolvedValue(sanctionedBy);

      const result = await service.sanction(1, 9);

      expect(result.status).toBe(CamStatus.SANCTION);
      expect(result.sanctionedBy).toBe(sanctionedBy);
      // No dedicated sanctioned-at column -- updatedAt is the closest real one.
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('throws NotFoundException when no CAM exists for the lead', async () => {
      camRepository.findOne.mockResolvedValue(null);
      await expect(service.sanction(1, 9)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the sanctioning user does not exist', async () => {
      camRepository.findOne.mockResolvedValue({ id: 1 });
      userRepository.findOneBy.mockResolvedValue(null);
      await expect(service.sanction(1, 404)).rejects.toThrow(NotFoundException);
    });

    it('creates a new CifCustomer for a first-time pancard and links it to the lead', async () => {
      const lead = { id: 1, pancard: 'ABCDE1234F' };
      const cam = { id: 1, status: CamStatus.DRAFT, lead };
      camRepository.findOne.mockResolvedValue(cam);
      userRepository.findOneBy.mockResolvedValue({ id: 9 });
      cifCustomerRepository.findOne.mockResolvedValueOnce(null); // no existing CIF for this pancard
      cifCustomerRepository.findOne.mockResolvedValueOnce(null); // no prior CIF rows at all

      await service.sanction(1, 9);

      expect(cifCustomerRepository.create).toHaveBeenCalledWith({
        cifNumber: 'FTC00000001',
        pancard: 'ABCDE1234F',
        spouseName: '',
        credeauApprovedCustomer: null,
      });
      expect(lead.cifCustomer).toEqual(
        expect.objectContaining({ cifNumber: 'FTC00000001' }),
      );
      expect(leadRepository.save).toHaveBeenCalledWith(lead);
    });

    it('marks credeauApprovedCustomer=1 for a first-time pancard when the lead was created via credeau (mode 1)', async () => {
      const lead = { id: 3, pancard: 'ABCDE9999Z', creationMode: 1 };
      const cam = { id: 3, status: CamStatus.DRAFT, lead };
      camRepository.findOne.mockResolvedValue(cam);
      userRepository.findOneBy.mockResolvedValue({ id: 9 });
      cifCustomerRepository.findOne.mockResolvedValueOnce(null);
      cifCustomerRepository.findOne.mockResolvedValueOnce(null);

      await service.sanction(3, 9);

      expect(cifCustomerRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ credeauApprovedCustomer: 1 }),
      );
    });

    it('reuses the existing CifCustomer for a repeat pancard', async () => {
      const lead = { id: 2, pancard: 'ABCDE1234F' };
      const cam = { id: 2, status: CamStatus.DRAFT, lead };
      const existingCif = {
        id: 1,
        cifNumber: 'FTC00000001',
        pancard: 'ABCDE1234F',
      };
      camRepository.findOne.mockResolvedValue(cam);
      userRepository.findOneBy.mockResolvedValue({ id: 9 });
      cifCustomerRepository.findOne.mockResolvedValueOnce(existingCif);

      await service.sanction(2, 9);

      expect(cifCustomerRepository.create).not.toHaveBeenCalled();
      expect(lead.cifCustomer).toBe(existingCif);
    });

    it('skips CIF assignment when the lead has no pancard', async () => {
      const lead = { id: 3, pancard: null };
      const cam = { id: 3, status: CamStatus.DRAFT, lead };
      camRepository.findOne.mockResolvedValue(cam);
      userRepository.findOneBy.mockResolvedValue({ id: 9 });

      await service.sanction(3, 9);

      expect(cifCustomerRepository.findOne).not.toHaveBeenCalled();
      expect(leadRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('sendBack', () => {
    const sendBackStatus = { id: 5, name: 'APPLICATION-SEND-BACK' };

    beforeEach(() => {
      masterStatusRepository.findOne.mockResolvedValue(sendBackStatus);
      leadRepository.findOneBy.mockResolvedValue({ id: 1 });
      userRepository.findOneBy.mockResolvedValue({ id: 9 });
    });

    it('reverts the CAM to DRAFT (CamStatus has no SEND_BACK member) and records remarks', async () => {
      const cam = { id: 1, status: CamStatus.SANCTION, remarks: null };
      camRepository.findOne.mockResolvedValue(cam);

      const result = await service.sendBack(1, { remarks: 'missing docs' }, 9);

      expect(result.status).toBe(CamStatus.DRAFT);
      expect(result.remarks).toBe('missing docs');
    });

    it('leaves remarks untouched when not supplied', async () => {
      const cam = { id: 1, status: CamStatus.DRAFT, remarks: 'prior note' };
      camRepository.findOne.mockResolvedValue(cam);

      const result = await service.sendBack(1, {}, 9);

      expect(result.remarks).toBe('prior note');
    });

    it("also transitions the lead's own status to APPLICATION-SEND-BACK and records a followup", async () => {
      const cam = { id: 1, status: CamStatus.DRAFT, remarks: null };
      camRepository.findOne.mockResolvedValue(cam);
      const lead = { id: 1, leadStatus: null };
      leadRepository.findOneBy.mockResolvedValue(lead);

      await service.sendBack(1, { remarks: 'missing docs' }, 9);

      expect(lead.leadStatus).toBe(sendBackStatus);
      expect(leadRepository.save).toHaveBeenCalledWith(lead);
      expect(leadFollowupRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          lead,
          status: sendBackStatus,
          remarks: 'missing docs',
        }),
      );
    });

    it('throws when APPLICATION-SEND-BACK is not seeded', async () => {
      masterStatusRepository.findOne.mockResolvedValue(null);
      camRepository.findOne.mockResolvedValue({
        id: 1,
        status: CamStatus.DRAFT,
      });

      await expect(service.sendBack(1, {}, 9)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
