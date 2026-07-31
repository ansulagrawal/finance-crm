import { findOrFail } from '@finance-crm/common';
import { Company, Product } from '@finance-crm/database';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { CreateCompanyDto } from './dto/create-company.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class CompanyService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  list(): Promise<Company[]> {
    return this.companyRepository.find({
      where: { isActive: true },
      order: { id: 'ASC' },
    });
  }

  findById(id: number): Promise<Company> {
    return findOrFail(this.companyRepository, id, 'Company');
  }

  create(dto: CreateCompanyDto): Promise<Company> {
    // Every legacy `company_login` column is NOT NULL with no default, so the
    // optional parts of the DTO fall back to an empty string rather than null.
    const company = this.companyRepository.create({
      name: dto.name,
      code: dto.code ?? '',
      companyType: dto.companyType ?? '',
      url: dto.url ?? '',
      address: dto.address ?? '',
      contactNumber: dto.contactNumber ?? '',
      cin: dto.cin ?? null,
      logoFileKey: dto.logoFileKey ?? null,
      createdById: 0,
      updatedById: 0,
    });
    return this.companyRepository.save(company);
  }

  async update(id: number, dto: UpdateCompanyDto): Promise<Company> {
    const company = await this.findById(id);
    if (dto.name !== undefined) company.name = dto.name;
    if (dto.code !== undefined) company.code = dto.code;
    if (dto.url !== undefined) company.url = dto.url;
    if (dto.address !== undefined) company.address = dto.address;
    if (dto.contactNumber !== undefined)
      company.contactNumber = dto.contactNumber;
    if (dto.cin !== undefined) company.cin = dto.cin;
    if (dto.logoFileKey !== undefined) company.logoFileKey = dto.logoFileKey;
    return this.companyRepository.save(company);
  }

  async remove(id: number): Promise<void> {
    const company = await this.findById(id);
    company.isActive = false;
    company.isDeleted = true;
    await this.companyRepository.save(company);
  }

  async listProducts(companyId: number): Promise<Product[]> {
    await this.findById(companyId);
    return this.productRepository.find({
      where: { company: { id: companyId }, isActive: true },
      order: { id: 'ASC' },
    });
  }

  async createProduct(
    companyId: number,
    dto: CreateProductDto,
  ): Promise<Product> {
    const company = await this.findById(companyId);
    // Same as companies: every legacy `tbl_product` column is NOT NULL.
    const product = this.productRepository.create({
      company,
      companyId: company.id,
      name: dto.name,
      code: dto.code ?? '',
      productType: dto.productType ?? '',
      source: dto.source ?? '',
      createdBy: '',
      updatedBy: '',
    });
    return this.productRepository.save(product);
  }

  async updateProduct(
    companyId: number,
    productId: number,
    dto: UpdateProductDto,
  ): Promise<Product> {
    const product = await this.getProductOrFail(companyId, productId);
    if (dto.name !== undefined) product.name = dto.name;
    if (dto.code !== undefined) product.code = dto.code;
    if (dto.source !== undefined) product.source = dto.source;
    return this.productRepository.save(product);
  }

  async removeProduct(companyId: number, productId: number): Promise<void> {
    const product = await this.getProductOrFail(companyId, productId);
    product.isActive = false;
    product.isDeleted = true;
    await this.productRepository.save(product);
  }

  private async getProductOrFail(
    companyId: number,
    productId: number,
  ): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id: productId, company: { id: companyId } },
    });
    if (!product) {
      throw new NotFoundException(
        `Product ${productId} not found for company ${companyId}`,
      );
    }
    return product;
  }
}
