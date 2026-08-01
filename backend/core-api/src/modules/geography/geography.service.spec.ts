import {
  BlacklistedPincode,
  Branch,
  City,
  DataSource,
  Pincode,
  State,
  User,
} from '@finance-crm/database';
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GeographyService } from './geography.service';

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

describe('GeographyService', () => {
  let service: GeographyService;
  let stateRepository: ReturnType<typeof repo>;
  let cityRepository: ReturnType<typeof repo>;
  let pincodeRepository: ReturnType<typeof repo>;
  let blacklistedPincodeRepository: ReturnType<typeof repo>;
  let branchRepository: ReturnType<typeof repo>;
  let dataSourceRepository: ReturnType<typeof repo>;
  let userRepository: ReturnType<typeof repo>;

  beforeEach(async () => {
    stateRepository = repo();
    cityRepository = repo();
    pincodeRepository = repo();
    blacklistedPincodeRepository = repo();
    branchRepository = repo();
    dataSourceRepository = repo();
    userRepository = repo();

    const moduleRef = await Test.createTestingModule({
      providers: [
        GeographyService,
        { provide: getRepositoryToken(State), useValue: stateRepository },
        { provide: getRepositoryToken(City), useValue: cityRepository },
        { provide: getRepositoryToken(Pincode), useValue: pincodeRepository },
        {
          provide: getRepositoryToken(BlacklistedPincode),
          useValue: blacklistedPincodeRepository,
        },
        { provide: getRepositoryToken(Branch), useValue: branchRepository },
        {
          provide: getRepositoryToken(DataSource),
          useValue: dataSourceRepository,
        },
        { provide: getRepositoryToken(User), useValue: userRepository },
      ],
    }).compile();

    service = moduleRef.get(GeographyService);
  });

  describe('states', () => {
    it('findStateById throws NotFoundException for an unknown id', async () => {
      stateRepository.findOneBy.mockResolvedValue(null);
      await expect(service.findStateById(404)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('updateState only overwrites provided fields', async () => {
      stateRepository.findOneBy.mockResolvedValue({
        id: 1,
        name: 'Old',
        code: 'OLD',
      });

      await service.updateState(1, { code: 'NEW' });

      expect(stateRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Old', code: 'NEW' }),
      );
    });

    it('removeState soft-deletes', async () => {
      stateRepository.findOneBy.mockResolvedValue({
        id: 1,
        isActive: true,
        isDeleted: false,
      });

      await service.removeState(1);

      expect(stateRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false, isDeleted: true }),
      );
    });
  });

  describe('cities — cascading filter by state', () => {
    it('listCities with no stateId returns all cities unfiltered', async () => {
      await service.listCities();

      expect(cityRepository.find).toHaveBeenCalledWith({
        where: { isActive: true },
        relations: { state: true },
        order: { id: 'ASC' },
      });
    });

    it('listCities scopes the where clause to the given stateId', async () => {
      await service.listCities(7);

      expect(cityRepository.find).toHaveBeenCalledWith({
        where: { isActive: true, state: { id: 7 } },
        relations: { state: true },
        order: { id: 'ASC' },
      });
    });

    it('createCity throws NotFoundException for an unknown parent state and does not create a city', async () => {
      stateRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.createCity(404, { name: 'Metropolis' }),
      ).rejects.toThrow(NotFoundException);
      expect(cityRepository.create).not.toHaveBeenCalled();
    });

    it('createCity attaches the resolved state', async () => {
      const state = { id: 7, name: 'Maharashtra' };
      stateRepository.findOneBy.mockResolvedValue(state);

      await service.createCity(7, { name: 'Pune' });

      expect(cityRepository.create).toHaveBeenCalledWith({
        state,
        name: 'Pune',
      });
    });
  });

  describe('pincodes — cascading filter by city, optional city on create', () => {
    it('listPincodes with no cityId returns all pincodes unfiltered', async () => {
      await service.listPincodes();

      expect(pincodeRepository.find).toHaveBeenCalledWith({
        where: { isActive: true },
        relations: { city: true },
        order: { id: 'ASC' },
      });
    });

    it('listPincodes scopes the where clause to the given cityId', async () => {
      await service.listPincodes(3);

      expect(pincodeRepository.find).toHaveBeenCalledWith({
        where: { isActive: true, city: { id: 3 } },
        relations: { city: true },
        order: { id: 'ASC' },
      });
    });

    it('createPincode resolves the city, which legacy requires', async () => {
      const city = { id: 3 };
      cityRepository.findOneBy.mockResolvedValue(city);

      await service.createPincode({ value: '411001', cityId: 3 });

      expect(pincodeRepository.create).toHaveBeenCalledWith({
        value: '411001',
        city,
      });
    });

    it('createPincode with a cityId resolves the city or throws NotFoundException', async () => {
      cityRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.createPincode({ value: '411001', cityId: 404 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('updatePincode reassigns the city only when cityId is provided', async () => {
      pincodeRepository.findOneBy.mockResolvedValue({
        id: 1,
        value: '411001',
        city: { id: 1 },
      });
      const newCity = { id: 9 };
      cityRepository.findOneBy.mockResolvedValue(newCity);

      await service.updatePincode(1, { cityId: 9 });

      expect(pincodeRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ city: newCity }),
      );
    });
  });

  describe('blacklisted pincodes', () => {
    it('createBlacklistedPincode resolves publishedBy or throws NotFoundException for an unknown user', async () => {
      userRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.createBlacklistedPincode({ pincode: '411001' }, 999),
      ).rejects.toThrow(NotFoundException);
      expect(blacklistedPincodeRepository.create).not.toHaveBeenCalled();
    });

    it('attaches the resolved publishedBy user on create', async () => {
      const user = { id: 5, name: 'Reviewer' };
      userRepository.findOneBy.mockResolvedValue(user);

      await service.createBlacklistedPincode({ pincode: '411001' }, 5);

      expect(blacklistedPincodeRepository.create).toHaveBeenCalledWith({
        pincode: '411001',
        publishedBy: user,
      });
    });

    it('removeBlacklistedPincode soft-deletes an existing entry', async () => {
      blacklistedPincodeRepository.findOneBy.mockResolvedValue({
        id: 1,
        isActive: true,
        isDeleted: false,
      });

      await service.removeBlacklistedPincode(1);

      expect(blacklistedPincodeRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false, isDeleted: true }),
      );
    });

    it('removeBlacklistedPincode throws NotFoundException for an unknown entry', async () => {
      blacklistedPincodeRepository.findOneBy.mockResolvedValue(null);
      await expect(service.removeBlacklistedPincode(404)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('branches', () => {
    it('findBranchById throws NotFoundException for an unknown id', async () => {
      branchRepository.findOneBy.mockResolvedValue(null);
      await expect(service.findBranchById(404)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('updateBranch only overwrites the name when provided', async () => {
      branchRepository.findOneBy.mockResolvedValue({ id: 1, name: 'Old' });
      await service.updateBranch(1, { name: 'New' });
      expect(branchRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New' }),
      );
    });
  });

  describe('data sources', () => {
    it('findDataSourceById throws NotFoundException for an unknown id', async () => {
      dataSourceRepository.findOneBy.mockResolvedValue(null);
      await expect(service.findDataSourceById(404)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('createDataSource passes through the code, which legacy requires', async () => {
      await service.createDataSource({ name: 'Website', code: 'WEB' });
      expect(dataSourceRepository.create).toHaveBeenCalledWith({
        name: 'Website',
        code: 'WEB',
      });
    });

    it('removeDataSource soft-deletes', async () => {
      dataSourceRepository.findOneBy.mockResolvedValue({
        id: 1,
        isActive: true,
        isDeleted: false,
      });

      await service.removeDataSource(1);

      expect(dataSourceRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false, isDeleted: true }),
      );
    });
  });
});
