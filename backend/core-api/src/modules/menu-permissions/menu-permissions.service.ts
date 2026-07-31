import { findOrFail } from '@finance-crm/common';
import {
  Company,
  ExportCatalog,
  MenuItem,
  MisReportCatalog,
  Product,
  RoleType,
  User,
  UserExportPermission,
  UserMisPermission,
  UserRole,
} from '@finance-crm/database';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { GrantExportPermissionDto } from './dto/grant-export-permission.dto';
import { GrantMisPermissionDto } from './dto/grant-mis-permission.dto';
import { ListMenuItemsQueryDto } from './dto/list-menu-items-query.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';

export interface MenuSection {
  sectionId: number;
  sectionLabel: string | null;
  items: MenuItem[];
}

const MENU_ITEM_RELATIONS = {
  roleType: true,
  company: true,
  product: true,
} as const;

@Injectable()
export class MenuPermissionsService {
  constructor(
    @InjectRepository(MenuItem)
    private readonly menuItemRepository: Repository<MenuItem>,
    @InjectRepository(RoleType)
    private readonly roleTypeRepository: Repository<RoleType>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(UserExportPermission)
    private readonly userExportPermissionRepository: Repository<UserExportPermission>,
    @InjectRepository(UserMisPermission)
    private readonly userMisPermissionRepository: Repository<UserMisPermission>,
    @InjectRepository(ExportCatalog)
    private readonly exportCatalogRepository: Repository<ExportCatalog>,
    @InjectRepository(MisReportCatalog)
    private readonly misReportCatalogRepository: Repository<MisReportCatalog>,
  ) {}

  // Menu items — flat list, no self-referencing tree (the legacy source data has none,
  // see the entity's doc comment). "sectionId" groups items instead.
  list(query: ListMenuItemsQueryDto): Promise<MenuItem[]> {
    return this.menuItemRepository.find({
      where: {
        isActive: true,
        ...(query.roleTypeId ? { roleType: { id: query.roleTypeId } } : {}),
      },
      relations: MENU_ITEM_RELATIONS,
      order: { sectionId: 'ASC', sortOrder: 'ASC' },
    });
  }

  async listGrouped(query: ListMenuItemsQueryDto): Promise<MenuSection[]> {
    const items = await this.list(query);
    const sections = new Map<number, MenuSection>();
    for (const item of items) {
      let section = sections.get(item.sectionId);
      if (!section) {
        section = {
          sectionId: item.sectionId,
          sectionLabel: item.sectionLabel,
          items: [],
        };
        sections.set(item.sectionId, section);
      }
      section.items.push(item);
    }
    return [...sections.values()];
  }

  findById(id: number): Promise<MenuItem> {
    return findOrFail(this.menuItemRepository, id, 'Menu item');
  }

  async create(
    dto: CreateMenuItemDto,
    currentUserId: number,
  ): Promise<MenuItem> {
    const roleType = await findOrFail(
      this.roleTypeRepository,
      dto.roleTypeId,
      'Role type',
    );
    const company = await findOrFail(
      this.companyRepository,
      dto.companyId,
      'Company',
    );
    const product = await findOrFail(
      this.productRepository,
      dto.productId,
      'Product',
    );

    const now = new Date();
    const menuItem = this.menuItemRepository.create({
      roleType,
      company,
      product,
      sectionId: dto.sectionId,
      sectionLabel: dto.sectionLabel,
      name: dto.name,
      stage: dto.stage,
      routeLink: dto.routeLink,
      icon: dto.icon ?? null,
      boxBgColor: dto.boxBgColor,
      sortOrder: dto.sortOrder ?? null,
      createdById: currentUserId,
      createdAt: now,
      updatedById: currentUserId,
      updatedAt: now,
    });
    return this.menuItemRepository.save(menuItem);
  }

  async update(
    id: number,
    dto: UpdateMenuItemDto,
    currentUserId: number,
  ): Promise<MenuItem> {
    const menuItem = await this.findById(id);

    if (dto.roleTypeId !== undefined) {
      menuItem.roleType = await findOrFail(
        this.roleTypeRepository,
        dto.roleTypeId,
        'Role type',
      );
    }
    if (dto.companyId !== undefined) {
      menuItem.company = await findOrFail(
        this.companyRepository,
        dto.companyId,
        'Company',
      );
    }
    if (dto.productId !== undefined) {
      menuItem.product = await findOrFail(
        this.productRepository,
        dto.productId,
        'Product',
      );
    }
    if (dto.sectionId !== undefined) {
      menuItem.sectionId = dto.sectionId;
    }
    if (dto.sectionLabel !== undefined) {
      menuItem.sectionLabel = dto.sectionLabel;
    }
    if (dto.name !== undefined) {
      menuItem.name = dto.name;
    }
    if (dto.stage !== undefined) {
      menuItem.stage = dto.stage;
    }
    if (dto.routeLink !== undefined) {
      menuItem.routeLink = dto.routeLink;
    }
    if (dto.icon !== undefined) {
      menuItem.icon = dto.icon;
    }
    menuItem.updatedById = currentUserId;
    menuItem.updatedAt = new Date();
    if (dto.boxBgColor !== undefined) {
      menuItem.boxBgColor = dto.boxBgColor;
    }
    if (dto.sortOrder !== undefined) {
      menuItem.sortOrder = dto.sortOrder;
    }

    return this.menuItemRepository.save(menuItem);
  }

  /** Legacy `master_lms_menu` has no `is_deleted` column, unlike most other
   * `master_*` tables — deactivation is the only removal semantics available. */
  async remove(id: number): Promise<void> {
    const menuItem = await this.findById(id);
    menuItem.isActive = false;
    await this.menuItemRepository.save(menuItem);
  }

  // Export permissions
  async listExportPermissions(
    userId?: number,
  ): Promise<UserExportPermission[]> {
    return this.userExportPermissionRepository.find({
      where: {
        isActive: true,
        ...(userId ? { user: { id: userId } } : {}),
      },
      relations: { user: true, userRole: true, grantedBy: true },
      order: { id: 'DESC' },
    });
  }

  async grantExportPermission(
    dto: GrantExportPermissionDto,
    grantedByUserId: number,
  ): Promise<UserExportPermission> {
    const user = await findOrFail(this.userRepository, dto.userId, 'User');
    const grantedBy = await findOrFail(
      this.userRepository,
      grantedByUserId,
      'User',
    );
    const userRole = dto.userRoleId
      ? await findOrFail(this.userRoleRepository, dto.userRoleId, 'User role')
      : null;
    const exportCatalog = await findOrFail(
      this.exportCatalogRepository,
      dto.exportId,
      'Export catalog',
    );

    const grant = this.userExportPermissionRepository.create({
      user,
      userRole,
      export: exportCatalog,
      grantedBy,
      createdAt: new Date(),
    });
    return this.userExportPermissionRepository.save(grant);
  }

  async revokeExportPermission(id: number): Promise<void> {
    const grant = await findOrFail(
      this.userExportPermissionRepository,
      id,
      'Export permission',
    );
    grant.isActive = false;
    grant.isDeleted = true;
    await this.userExportPermissionRepository.save(grant);
  }

  // MIS permissions
  async listMisPermissions(userId?: number): Promise<UserMisPermission[]> {
    return this.userMisPermissionRepository.find({
      where: {
        isActive: true,
        ...(userId ? { user: { id: userId } } : {}),
      },
      relations: { user: true, userRole: true, grantedBy: true },
      order: { id: 'DESC' },
    });
  }

  async grantMisPermission(
    dto: GrantMisPermissionDto,
    grantedByUserId: number,
  ): Promise<UserMisPermission> {
    const user = await findOrFail(this.userRepository, dto.userId, 'User');
    const grantedBy = await findOrFail(
      this.userRepository,
      grantedByUserId,
      'User',
    );
    const userRole = dto.userRoleId
      ? await findOrFail(this.userRoleRepository, dto.userRoleId, 'User role')
      : null;
    const misReportCatalog = await findOrFail(
      this.misReportCatalogRepository,
      dto.misId,
      'MIS report catalog',
    );

    const grant = this.userMisPermissionRepository.create({
      user,
      userRole,
      mis: misReportCatalog,
      grantedBy,
      createdAt: new Date(),
    });
    return this.userMisPermissionRepository.save(grant);
  }

  async revokeMisPermission(id: number): Promise<void> {
    const grant = await findOrFail(
      this.userMisPermissionRepository,
      id,
      'MIS permission',
    );
    grant.isActive = false;
    grant.isDeleted = true;
    await this.userMisPermissionRepository.save(grant);
  }
}
