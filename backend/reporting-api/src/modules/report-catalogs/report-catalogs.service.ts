import { findOrFail } from '@finance-crm/common';
import { ExportCatalog, MisReportCatalog } from '@finance-crm/database';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { CreateReportCatalogDto } from './dto/create-report-catalog.dto';
import { UpdateReportCatalogDto } from './dto/update-report-catalog.dto';

@Injectable()
export class ReportCatalogsService {
  constructor(
    @InjectRepository(ExportCatalog)
    private readonly exportCatalogRepository: Repository<ExportCatalog>,
    @InjectRepository(MisReportCatalog)
    private readonly misReportCatalogRepository: Repository<MisReportCatalog>,
  ) {}

  listExports(): Promise<ExportCatalog[]> {
    return this.exportCatalogRepository.find({
      where: { isDeleted: false },
      order: { id: 'ASC' },
    });
  }

  getExport(id: number): Promise<ExportCatalog> {
    return findOrFail(this.exportCatalogRepository, id, 'Export catalog');
  }

  createExport(dto: CreateReportCatalogDto): Promise<ExportCatalog> {
    const catalog = this.exportCatalogRepository.create({
      name: dto.name,
      heading: dto.heading,
      isLive: dto.isLive ?? false,
    });
    return this.exportCatalogRepository.save(catalog);
  }

  async updateExport(
    id: number,
    dto: UpdateReportCatalogDto,
  ): Promise<ExportCatalog> {
    const catalog = await this.getExport(id);
    if (dto.name !== undefined) catalog.name = dto.name;
    if (dto.heading !== undefined) catalog.heading = dto.heading;
    if (dto.isLive !== undefined) catalog.isLive = dto.isLive;
    return this.exportCatalogRepository.save(catalog);
  }

  async removeExport(id: number): Promise<void> {
    const catalog = await this.getExport(id);
    catalog.isActive = false;
    catalog.isDeleted = true;
    await this.exportCatalogRepository.save(catalog);
  }

  listMisReports(): Promise<MisReportCatalog[]> {
    return this.misReportCatalogRepository.find({
      where: { isDeleted: false },
      order: { id: 'ASC' },
    });
  }

  getMisReport(id: number): Promise<MisReportCatalog> {
    return findOrFail(
      this.misReportCatalogRepository,
      id,
      'MIS report catalog',
    );
  }

  createMisReport(dto: CreateReportCatalogDto): Promise<MisReportCatalog> {
    const catalog = this.misReportCatalogRepository.create({
      name: dto.name,
      heading: dto.heading,
      isLive: dto.isLive ?? false,
    });
    return this.misReportCatalogRepository.save(catalog);
  }

  async updateMisReport(
    id: number,
    dto: UpdateReportCatalogDto,
  ): Promise<MisReportCatalog> {
    const catalog = await this.getMisReport(id);
    if (dto.name !== undefined) catalog.name = dto.name;
    if (dto.heading !== undefined) catalog.heading = dto.heading;
    if (dto.isLive !== undefined) catalog.isLive = dto.isLive;
    return this.misReportCatalogRepository.save(catalog);
  }

  async removeMisReport(id: number): Promise<void> {
    const catalog = await this.getMisReport(id);
    catalog.isActive = false;
    catalog.isDeleted = true;
    await this.misReportCatalogRepository.save(catalog);
  }
}
