import { findOrFail } from '@finance-crm/common';
import { BreCategory, BreRule, BreRuleResult, Lead } from '@finance-crm/database';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { CreateBreCategoryDto } from './dto/create-bre-category.dto';
import { CreateBreRuleDto } from './dto/create-bre-rule.dto';
import { CreateBreRuleResultDto } from './dto/create-bre-rule-result.dto';
import { ManualDecisionBreRuleResultDto } from './dto/manual-decision-bre-rule-result.dto';
import { UpdateBreCategoryDto } from './dto/update-bre-category.dto';
import { UpdateBreRuleDto } from './dto/update-bre-rule.dto';

@Injectable()
export class BreService {
  constructor(
    @InjectRepository(BreCategory)
    private readonly breCategoryRepository: Repository<BreCategory>,
    @InjectRepository(BreRule)
    private readonly breRuleRepository: Repository<BreRule>,
    @InjectRepository(BreRuleResult)
    private readonly breRuleResultRepository: Repository<BreRuleResult>,
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
  ) {}

  // Categories
  listCategories(): Promise<BreCategory[]> {
    return this.breCategoryRepository.find({
      where: { isActive: true },
      order: { id: 'ASC' },
    });
  }

  findCategoryById(id: number): Promise<BreCategory> {
    return findOrFail(this.breCategoryRepository, id, 'BRE category');
  }

  createCategory(dto: CreateBreCategoryDto): Promise<BreCategory> {
    const category = this.breCategoryRepository.create({ name: dto.name });
    return this.breCategoryRepository.save(category);
  }

  async updateCategory(
    id: number,
    dto: UpdateBreCategoryDto,
  ): Promise<BreCategory> {
    const category = await this.findCategoryById(id);
    if (dto.name !== undefined) category.name = dto.name;
    return this.breCategoryRepository.save(category);
  }

  async removeCategory(id: number): Promise<void> {
    const category = await this.findCategoryById(id);
    category.isActive = false;
    category.isDeleted = true;
    await this.breCategoryRepository.save(category);
  }

  // Rules
  async listRules(categoryId?: number): Promise<BreRule[]> {
    return this.breRuleRepository.find({
      where: {
        isActive: true,
        ...(categoryId ? { category: { id: categoryId } } : {}),
      },
      relations: { category: true },
      order: { id: 'ASC' },
    });
  }

  findRuleById(id: number): Promise<BreRule> {
    return findOrFail(this.breRuleRepository, id, 'BRE rule');
  }

  async createRule(dto: CreateBreRuleDto): Promise<BreRule> {
    const category = await this.findCategoryById(dto.categoryId);
    const rule = this.breRuleRepository.create({
      category,
      name: dto.name,
      createdAt: new Date(),
    });
    return this.breRuleRepository.save(rule);
  }

  async updateRule(id: number, dto: UpdateBreRuleDto): Promise<BreRule> {
    const rule = await this.findRuleById(id);
    if (dto.name !== undefined) rule.name = dto.name;
    if (dto.categoryId !== undefined)
      rule.category = await this.findCategoryById(dto.categoryId);
    return this.breRuleRepository.save(rule);
  }

  async removeRule(id: number): Promise<void> {
    const rule = await this.findRuleById(id);
    rule.isActive = false;
    rule.isDeleted = true;
    await this.breRuleRepository.save(rule);
  }

  // Rule results (per lead)
  async listResultsForLead(leadId: number): Promise<BreRuleResult[]> {
    await findOrFail(this.leadRepository, leadId, 'Lead');
    return this.breRuleResultRepository.find({
      where: { lead: { id: leadId } },
      relations: { rule: { category: true } },
      order: { id: 'ASC' },
    });
  }

  async createResult(
    leadId: number,
    dto: CreateBreRuleResultDto,
  ): Promise<BreRuleResult> {
    const lead = await findOrFail(this.leadRepository, leadId, 'Lead');
    const rule = await this.findRuleById(dto.ruleId);
    const result = this.breRuleResultRepository.create({
      lead,
      rule,
      ruleName: rule.name,
      // `cutoffValue`/`actualValue`/`relevantInputs` are NOT NULL varchar
      // columns in the real legacy schema (the pre-rewrite entity allowed
      // null).
      cutoffValue: dto.cutoffValue ?? '',
      actualValue: dto.actualValue ?? '',
      relevantInputs: dto.relevantInputs ?? '',
      systemDecision: dto.systemDecision,
      createdAt: new Date(),
    });
    return this.breRuleResultRepository.save(result);
  }

  async setManualDecision(
    leadId: number,
    resultId: number,
    dto: ManualDecisionBreRuleResultDto,
  ): Promise<BreRuleResult> {
    const result = await this.breRuleResultRepository.findOne({
      where: { id: resultId, lead: { id: leadId } },
      relations: { rule: { category: true } },
    });
    if (!result) {
      throw new NotFoundException(
        `BRE rule result ${resultId} not found for lead ${leadId}`,
      );
    }
    result.manualDecision = dto.manualDecision;
    if (dto.manualDecisionRemarks !== undefined)
      result.manualDecisionRemarks = dto.manualDecisionRemarks;
    return this.breRuleResultRepository.save(result);
  }
}
