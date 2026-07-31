import { RoleType } from '@finance-crm/database';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { CreateRoleTypeDto } from './dto/create-role-type.dto';
import { UpdateRoleTypeDto } from './dto/update-role-type.dto';

/** Legacy `master_role_type.role_type_product_id` is NOT NULL and every one of
 * the 23 existing rows carries product 1, the single configured product. */
const LEGACY_DEFAULT_PRODUCT_ID = 1;

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(RoleType)
    private readonly roleTypeRepository: Repository<RoleType>,
  ) {}

  list(): Promise<RoleType[]> {
    return this.roleTypeRepository.find({
      where: { isActive: true },
      order: { id: 'ASC' },
    });
  }

  async findById(id: number): Promise<RoleType> {
    const roleType = await this.roleTypeRepository.findOne({ where: { id } });
    if (!roleType) {
      throw new NotFoundException(`Role type ${id} not found`);
    }
    return roleType;
  }

  async create(dto: CreateRoleTypeDto): Promise<RoleType> {
    const existing = await this.roleTypeRepository.findOne({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(
        `Role type code "${dto.code}" already exists`,
      );
    }
    const roleType = this.roleTypeRepository.create({
      name: dto.name,
      heading: dto.heading ?? dto.name,
      code: dto.code,
      // Legacy `master_role_type` declares both NOT NULL with no default, and
      // every existing row carries product 1 (the single configured product).
      productId: LEGACY_DEFAULT_PRODUCT_ID,
      hasBranchScope: false,
    });
    return this.roleTypeRepository.save(roleType);
  }

  async update(id: number, dto: UpdateRoleTypeDto): Promise<RoleType> {
    const roleType = await this.findById(id);
    if (dto.name !== undefined) roleType.name = dto.name;
    if (dto.heading !== undefined) roleType.heading = dto.heading;
    if (dto.code !== undefined) roleType.code = dto.code;
    return this.roleTypeRepository.save(roleType);
  }

  async remove(id: number): Promise<void> {
    const roleType = await this.findById(id);
    roleType.isActive = false;
    roleType.isDeleted = true;
    await this.roleTypeRepository.save(roleType);
  }
}
