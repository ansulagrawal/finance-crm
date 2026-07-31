import { Company, Product } from '@finance-crm/database';
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CompanyService } from './company.service';

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

describe('CompanyService', () => {
  let service: CompanyService;
  let companyRepository: ReturnType<typeof repo>;
  let productRepository: ReturnType<typeof repo>;

  beforeEach(async () => {
    companyRepository = repo();
    productRepository = repo();

    const moduleRef = await Test.createTestingModule({
      providers: [
        CompanyService,
        { provide: getRepositoryToken(Company), useValue: companyRepository },
        { provide: getRepositoryToken(Product), useValue: productRepository },
      ],
    }).compile();

    service = moduleRef.get(CompanyService);
  });

  describe('findById', () => {
    it('throws NotFoundException for an unknown company', async () => {
      companyRepository.findOneBy.mockResolvedValue(null);
      await expect(service.findById(404)).rejects.toThrow(NotFoundException);
    });

    it('returns the company when found', async () => {
      companyRepository.findOneBy.mockResolvedValue({ id: 1, name: 'Acme' });
      await expect(service.findById(1)).resolves.toEqual({
        id: 1,
        name: 'Acme',
      });
    });
  });

  describe('create', () => {
    it('defaults the NOT NULL legacy columns to empty strings and saves', async () => {
      const result = await service.create({ name: 'New Co' });

      expect(companyRepository.create).toHaveBeenCalledWith({
        name: 'New Co',
        code: '',
        companyType: '',
        url: '',
        address: '',
        contactNumber: '',
        cin: null,
        logoFileKey: null,
        createdById: 0,
        updatedById: 0,
      });
      expect(companyRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New Co' }),
      );
      expect(result).toEqual(expect.objectContaining({ name: 'New Co' }));
    });
  });

  describe('update', () => {
    it('throws NotFoundException for an unknown company and does not save', async () => {
      companyRepository.findOneBy.mockResolvedValue(null);

      await expect(service.update(404, { name: 'x' })).rejects.toThrow(
        NotFoundException,
      );
      expect(companyRepository.save).not.toHaveBeenCalled();
    });

    it('only overwrites fields present in the dto, leaving others untouched', async () => {
      companyRepository.findOneBy.mockResolvedValue({
        id: 1,
        name: 'Old',
        code: 'OLD',
        url: 'old.example.com',
        address: 'Old address',
        contactNumber: '111',
      });

      await service.update(1, { name: 'Updated' });

      expect(companyRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          name: 'Updated',
          code: 'OLD',
          url: 'old.example.com',
          address: 'Old address',
          contactNumber: '111',
        }),
      );
    });
  });

  describe('remove', () => {
    it('soft-deletes by flipping isActive/isDeleted rather than deleting the row', async () => {
      companyRepository.findOneBy.mockResolvedValue({
        id: 1,
        isActive: true,
        isDeleted: false,
      });

      await service.remove(1);

      expect(companyRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false, isDeleted: true }),
      );
    });

    it('throws NotFoundException for an unknown company', async () => {
      companyRepository.findOneBy.mockResolvedValue(null);
      await expect(service.remove(404)).rejects.toThrow(NotFoundException);
    });
  });

  describe('listProducts', () => {
    it('throws NotFoundException when the parent company does not exist', async () => {
      companyRepository.findOneBy.mockResolvedValue(null);
      await expect(service.listProducts(404)).rejects.toThrow(
        NotFoundException,
      );
      expect(productRepository.find).not.toHaveBeenCalled();
    });

    it('scopes the product list to the given company id', async () => {
      companyRepository.findOneBy.mockResolvedValue({ id: 1 });
      const rows = [{ id: 1, name: 'Loan A' }];
      productRepository.find.mockResolvedValue(rows);

      const result = await service.listProducts(1);

      expect(productRepository.find).toHaveBeenCalledWith({
        where: { company: { id: 1 }, isActive: true },
        order: { id: 'ASC' },
      });
      expect(result).toEqual(rows);
    });
  });

  describe('createProduct', () => {
    it('throws NotFoundException for an unknown company and does not create a product', async () => {
      companyRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.createProduct(404, { name: 'Loan A' }),
      ).rejects.toThrow(NotFoundException);
      expect(productRepository.create).not.toHaveBeenCalled();
    });

    it('attaches the resolved company and saves the new product', async () => {
      const company = { id: 1, name: 'Acme' };
      companyRepository.findOneBy.mockResolvedValue(company);

      await service.createProduct(1, { name: 'Loan A', code: 'LA' });

      expect(productRepository.create).toHaveBeenCalledWith({
        company,
        companyId: 1,
        name: 'Loan A',
        code: 'LA',
        productType: '',
        source: '',
        createdBy: '',
        updatedBy: '',
      });
    });
  });

  describe('updateProduct / removeProduct — scoped to company', () => {
    it('updateProduct throws NotFoundException when the product does not belong to the given company', async () => {
      productRepository.findOne.mockResolvedValue(null);

      await expect(service.updateProduct(1, 2, { name: 'x' })).rejects.toThrow(
        NotFoundException,
      );
      expect(productRepository.findOne).toHaveBeenCalledWith({
        where: { id: 2, company: { id: 1 } },
      });
      expect(productRepository.save).not.toHaveBeenCalled();
    });

    it('updateProduct only overwrites provided fields', async () => {
      productRepository.findOne.mockResolvedValue({
        id: 2,
        name: 'Old',
        code: 'OLD',
        source: 'legacy',
      });

      await service.updateProduct(1, 2, { code: 'NEW' });

      expect(productRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Old', code: 'NEW', source: 'legacy' }),
      );
    });

    it('removeProduct soft-deletes the product scoped to its company', async () => {
      productRepository.findOne.mockResolvedValue({
        id: 2,
        isActive: true,
        isDeleted: false,
      });

      await service.removeProduct(1, 2);

      expect(productRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false, isDeleted: true }),
      );
    });

    it('removeProduct throws NotFoundException for a product under a different company', async () => {
      productRepository.findOne.mockResolvedValue(null);
      await expect(service.removeProduct(1, 999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
