import {
  MaritalStatus,
  MasterStatus,
  Occupation,
  Qualification,
  RejectionReason,
  Religion,
} from '@finance-crm/database';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LeadLookupsService } from './lead-lookups.service';

function repo() {
  return { find: jest.fn().mockResolvedValue([]) };
}

describe('LeadLookupsService', () => {
  let service: LeadLookupsService;
  let maritalStatusRepository: ReturnType<typeof repo>;
  let qualificationRepository: ReturnType<typeof repo>;
  let occupationRepository: ReturnType<typeof repo>;
  let religionRepository: ReturnType<typeof repo>;
  let rejectionReasonRepository: ReturnType<typeof repo>;
  let masterStatusRepository: ReturnType<typeof repo>;

  beforeEach(async () => {
    maritalStatusRepository = repo();
    qualificationRepository = repo();
    occupationRepository = repo();
    religionRepository = repo();
    rejectionReasonRepository = repo();
    masterStatusRepository = repo();

    const moduleRef = await Test.createTestingModule({
      providers: [
        LeadLookupsService,
        {
          provide: getRepositoryToken(MaritalStatus),
          useValue: maritalStatusRepository,
        },
        {
          provide: getRepositoryToken(Qualification),
          useValue: qualificationRepository,
        },
        {
          provide: getRepositoryToken(Occupation),
          useValue: occupationRepository,
        },
        { provide: getRepositoryToken(Religion), useValue: religionRepository },
        {
          provide: getRepositoryToken(RejectionReason),
          useValue: rejectionReasonRepository,
        },
        {
          provide: getRepositoryToken(MasterStatus),
          useValue: masterStatusRepository,
        },
      ],
    }).compile();

    service = moduleRef.get(LeadLookupsService);
  });

  it('listMaritalStatuses returns only active rows, ordered by id', async () => {
    const rows = [{ id: 1 }];
    maritalStatusRepository.find.mockResolvedValue(rows);

    await expect(service.listMaritalStatuses()).resolves.toBe(rows);
    expect(maritalStatusRepository.find).toHaveBeenCalledWith({
      where: { isActive: true },
      order: { id: 'ASC' },
    });
  });

  it('listQualifications delegates to the qualification repository', async () => {
    const rows = [{ id: 2 }];
    qualificationRepository.find.mockResolvedValue(rows);
    await expect(service.listQualifications()).resolves.toBe(rows);
  });

  it('listOccupations delegates to the occupation repository', async () => {
    const rows = [{ id: 3 }];
    occupationRepository.find.mockResolvedValue(rows);
    await expect(service.listOccupations()).resolves.toBe(rows);
  });

  it('listReligions delegates to the religion repository', async () => {
    const rows = [{ id: 4 }];
    religionRepository.find.mockResolvedValue(rows);
    await expect(service.listReligions()).resolves.toBe(rows);
  });

  it('listRejectionReasons delegates to the rejection-reason repository', async () => {
    const rows = [{ id: 5 }];
    rejectionReasonRepository.find.mockResolvedValue(rows);
    await expect(service.listRejectionReasons()).resolves.toBe(rows);
  });

  it('listMasterStatuses returns only active rows, ordered by sortOrder', async () => {
    const rows = [{ id: 6, sortOrder: 1 }];
    masterStatusRepository.find.mockResolvedValue(rows);

    await expect(service.listMasterStatuses()).resolves.toBe(rows);
    expect(masterStatusRepository.find).toHaveBeenCalledWith({
      where: { isActive: true },
      order: { sortOrder: 'ASC' },
    });
  });

  it("listMasterStatuses filters by stageCode when a stage is given, matching legacy's real repayment-type dropdown filter", async () => {
    const rows = [{ id: 17, sortOrder: 1, stageCode: 'S16' }];
    masterStatusRepository.find.mockResolvedValue(rows);

    await expect(service.listMasterStatuses('S16')).resolves.toBe(rows);
    expect(masterStatusRepository.find).toHaveBeenCalledWith({
      where: { isActive: true, isDeleted: false, stageCode: 'S16' },
      order: { sortOrder: 'ASC' },
    });
  });
});
