import { CifCustomer, LeadUserType, Pincode } from '@finance-crm/database';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LeadEligibilityService } from './lead-eligibility.service';
import { LeadImportService } from './lead-import.service';
import { LeadsService } from './leads.service';

function repo(overrides: Record<string, jest.Mock> = {}) {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe('LeadImportService', () => {
  let service: LeadImportService;
  let pincodeRepository: ReturnType<typeof repo>;
  let cifCustomerRepository: ReturnType<typeof repo>;
  let leadsService: { create: jest.Mock };
  let leadEligibilityService: { evaluate: jest.Mock };

  beforeEach(async () => {
    pincodeRepository = repo();
    cifCustomerRepository = repo();
    leadsService = { create: jest.fn() };
    leadEligibilityService = { evaluate: jest.fn().mockResolvedValue({}) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        LeadImportService,
        { provide: getRepositoryToken(Pincode), useValue: pincodeRepository },
        {
          provide: getRepositoryToken(CifCustomer),
          useValue: cifCustomerRepository,
        },
        { provide: LeadsService, useValue: leadsService },
        {
          provide: LeadEligibilityService,
          useValue: leadEligibilityService,
        },
      ],
    }).compile();

    service = moduleRef.get(LeadImportService);
  });

  it('creates a lead per valid row and resolves pincode to city/state', async () => {
    pincodeRepository.findOne.mockResolvedValue({
      city: { id: 5, state: { id: 2 } },
    });
    leadsService.create.mockResolvedValue({ id: 100 });

    const csv =
      'name,mobile,email,pan,pincode\nRamesh Kumar,9876543210,r@example.com,ABCDE1234F,400001\n';

    const results = await service.importCsv(csv);

    expect(results).toEqual([{ row: 2, status: 'CREATED', leadId: 100 }]);
    expect(leadsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: 'Ramesh Kumar',
        mobile: '9876543210',
        cityId: 5,
        stateId: 2,
      }),
    );
  });

  it('sets userType REPEAT when the pancard already has a CifCustomer', async () => {
    cifCustomerRepository.findOne.mockResolvedValue({
      id: 1,
      cifNumber: 'FTC00000001',
      pancard: 'ABCDE1234F',
    });
    leadsService.create.mockResolvedValue({ id: 101 });

    const csv = 'name,mobile,pan\nJane Doe,9998887777,ABCDE1234F\n';
    await service.importCsv(csv);

    expect(leadsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ userType: LeadUserType.REPEAT }),
    );
  });

  it('leaves userType unset for a first-time pancard', async () => {
    leadsService.create.mockResolvedValue({ id: 102 });

    const csv = 'name,mobile,pan\nJane Doe,9998887777,ABCDE1234F\n';
    await service.importCsv(csv);

    expect(leadsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ userType: undefined }),
    );
  });

  it('reports a per-row error instead of failing the whole import', async () => {
    leadsService.create.mockRejectedValueOnce(new Error('duplicate mobile'));

    const csv = 'name,mobile\nA,1111111111\n';
    const results = await service.importCsv(csv);

    expect(results).toEqual([
      { row: 2, status: 'ERROR', error: 'duplicate mobile' },
    ]);
  });

  it('throws when the CSV is missing a required column', async () => {
    await expect(service.importCsv('name\nA\n')).rejects.toThrow(
      "missing required column 'mobile'",
    );
  });
});
