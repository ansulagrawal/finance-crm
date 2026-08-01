import {
  BreCategory,
  BreDecision,
  BreRule,
  BreRuleResult,
  Lead,
} from '@finance-crm/database';
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BreService } from './bre.service';

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

describe('BreService', () => {
  let service: BreService;
  let categoryRepository: ReturnType<typeof repo>;
  let ruleRepository: ReturnType<typeof repo>;
  let resultRepository: ReturnType<typeof repo>;
  let leadRepository: ReturnType<typeof repo>;

  beforeEach(async () => {
    categoryRepository = repo();
    ruleRepository = repo();
    resultRepository = repo();
    leadRepository = repo();

    const moduleRef = await Test.createTestingModule({
      providers: [
        BreService,
        {
          provide: getRepositoryToken(BreCategory),
          useValue: categoryRepository,
        },
        { provide: getRepositoryToken(BreRule), useValue: ruleRepository },
        {
          provide: getRepositoryToken(BreRuleResult),
          useValue: resultRepository,
        },
        { provide: getRepositoryToken(Lead), useValue: leadRepository },
      ],
    }).compile();

    service = moduleRef.get(BreService);
  });

  describe('categories', () => {
    it('listCategories returns only active categories, ordered by id', async () => {
      const rows = [{ id: 1 }];
      categoryRepository.find.mockResolvedValue(rows);
      await expect(service.listCategories()).resolves.toBe(rows);
      expect(categoryRepository.find).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { id: 'ASC' },
      });
    });

    it('findCategoryById 404s for an unknown id', async () => {
      categoryRepository.findOneBy.mockResolvedValue(null);
      await expect(service.findCategoryById(404)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('createCategory persists the new category', async () => {
      const result = await service.createCategory({ name: 'Income checks' });
      expect(result.name).toBe('Income checks');
      expect(categoryRepository.save).toHaveBeenCalled();
    });

    it('updateCategory updates the name in place', async () => {
      const category = { id: 1, name: 'Old name' };
      categoryRepository.findOneBy.mockResolvedValue(category);
      const result = await service.updateCategory(1, { name: 'New name' });
      expect(result).toBe(category);
      expect(category.name).toBe('New name');
    });

    it('removeCategory soft-deletes (isActive=false, isDeleted=true)', async () => {
      const category = { id: 1, isActive: true, isDeleted: false };
      categoryRepository.findOneBy.mockResolvedValue(category);
      await service.removeCategory(1);
      expect(category.isActive).toBe(false);
      expect(category.isDeleted).toBe(true);
    });
  });

  describe('rules', () => {
    it('listRules filters by category and isActive when categoryId is supplied', async () => {
      await service.listRules(5);
      expect(ruleRepository.find).toHaveBeenCalledWith({
        where: { isActive: true, category: { id: 5 } },
        relations: { category: true },
        order: { id: 'ASC' },
      });
    });

    it('listRules returns all active rules when no categoryId is supplied', async () => {
      await service.listRules();
      expect(ruleRepository.find).toHaveBeenCalledWith({
        where: { isActive: true },
        relations: { category: true },
        order: { id: 'ASC' },
      });
    });

    it('createRule resolves the category FK and persists the rule', async () => {
      const category = { id: 5, name: 'Income checks' };
      categoryRepository.findOneBy.mockResolvedValue(category);

      const result = await service.createRule({
        name: 'Min salary 15k',
        categoryId: 5,
      });

      expect(result.category).toBe(category);
      expect(result.name).toBe('Min salary 15k');
    });

    it('createRule throws NotFoundException for an unknown category', async () => {
      categoryRepository.findOneBy.mockResolvedValue(null);
      await expect(
        service.createRule({ name: 'X', categoryId: 404 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('updateRule can re-point the rule at a different category', async () => {
      const rule = { id: 1, name: 'Old', category: { id: 1 } };
      const newCategory = { id: 2, name: 'New cat' };
      ruleRepository.findOneBy.mockResolvedValue(rule);
      categoryRepository.findOneBy.mockResolvedValue(newCategory);

      const result = await service.updateRule(1, { categoryId: 2 });

      expect(result.category).toBe(newCategory);
    });

    it('removeRule soft-deletes the rule', async () => {
      const rule = { id: 1, isActive: true, isDeleted: false };
      ruleRepository.findOneBy.mockResolvedValue(rule);
      await service.removeRule(1);
      expect(rule.isActive).toBe(false);
      expect(rule.isDeleted).toBe(true);
    });
  });

  describe('rule results', () => {
    it('listResultsForLead 404s when the lead does not exist', async () => {
      leadRepository.findOneBy.mockResolvedValue(null);
      await expect(service.listResultsForLead(99)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('listResultsForLead returns results ordered by id ascending', async () => {
      leadRepository.findOneBy.mockResolvedValue({ id: 1 });
      const rows = [{ id: 1 }];
      resultRepository.find.mockResolvedValue(rows);
      await expect(service.listResultsForLead(1)).resolves.toBe(rows);
    });

    it('createResult resolves lead + rule FKs and records the system decision', async () => {
      const lead = { id: 1 };
      const rule = { id: 2, name: 'Min salary' };
      leadRepository.findOneBy.mockResolvedValue(lead);
      ruleRepository.findOneBy.mockResolvedValue(rule);

      const result = await service.createResult(1, {
        ruleId: 2,
        systemDecision: BreDecision.REJECT,
        cutoffValue: '15000',
        actualValue: '12000',
      });

      expect(result.lead).toBe(lead);
      expect(result.rule).toBe(rule);
      expect(result.systemDecision).toBe(BreDecision.REJECT);
      expect(result.cutoffValue).toBe('15000');
    });

    it('createResult throws NotFoundException for an unknown rule', async () => {
      leadRepository.findOneBy.mockResolvedValue({ id: 1 });
      ruleRepository.findOneBy.mockResolvedValue(null);
      await expect(
        service.createResult(1, {
          ruleId: 404,
          systemDecision: BreDecision.APPROVE,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('setManualDecision overrides the system decision with a human call + remarks', async () => {
      const result = {
        id: 3,
        systemDecision: BreDecision.REJECT,
        manualDecision: null as BreDecision | null,
        manualDecisionRemarks: null as string | null,
      };
      resultRepository.findOne.mockResolvedValue(result);

      const updated = await service.setManualDecision(1, 3, {
        manualDecision: BreDecision.APPROVE,
        manualDecisionRemarks: 'verified income manually',
      });

      expect(updated.manualDecision).toBe(BreDecision.APPROVE);
      expect(updated.manualDecisionRemarks).toBe('verified income manually');
      // the automated system decision is preserved, not overwritten
      expect(updated.systemDecision).toBe(BreDecision.REJECT);
    });

    it('setManualDecision 404s when the result does not belong to the lead', async () => {
      resultRepository.findOne.mockResolvedValue(null);
      await expect(
        service.setManualDecision(1, 999, {
          manualDecision: BreDecision.APPROVE,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
