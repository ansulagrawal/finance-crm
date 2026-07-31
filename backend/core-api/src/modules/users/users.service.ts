import { randomBytes } from 'node:crypto';
import type { PaginatedResult } from '@finance-crm/common';
import { findOrFail } from '@finance-crm/common';
import {
  Company,
  Product,
  RoleType,
  User,
  UserActivityLog,
  UserRole,
} from '@finance-crm/database';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import {
  Between,
  ILike,
  LessThanOrEqual,
  MoreThanOrEqual,
  type Repository,
} from 'typeorm';
import { AssignUserRoleDto } from './dto/assign-user-role.dto';
import {
  CreateUserDto,
  DEFAULT_COMPANY_ID,
  DEFAULT_PRODUCT_ID,
} from './dto/create-user.dto';
import { ListActivityLogsQueryDto } from './dto/list-activity-logs-query.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';

const BCRYPT_SALT_ROUNDS_DEFAULT = 10;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(RoleType)
    private readonly roleTypeRepository: Repository<RoleType>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(UserActivityLog)
    private readonly userActivityLogRepository: Repository<UserActivityLog>,
    private readonly configService: ConfigService,
  ) {}

  async list(query: ListUsersQueryDto): Promise<PaginatedResult<User>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const commonWhere = {
      ...(query.companyId ? { company: { id: query.companyId } } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };

    const [data, total] = await this.userRepository.findAndCount({
      where: query.search
        ? [
            { ...commonWhere, name: ILike(`%${query.search}%`) },
            { ...commonWhere, email: ILike(`%${query.search}%`) },
            { ...commonWhere, username: ILike(`%${query.search}%`) },
            { ...commonWhere, mobile: ILike(`%${query.search}%`) },
          ]
        : commonWhere,
      relations: { company: true, product: true },
      order: { id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, page, limit, total };
  }

  async findById(id: number): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: { company: true, product: true },
    });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const user = this.userRepository.create({
      name: dto.name,
      email: dto.email,
      mobile: dto.mobile,
      username: dto.username ?? null,
      passwordHash: await this.hashPassword(dto.password),
      // Legacy `users.password` is NOT NULL and holds MD5. A user created here
      // gets an unusable random value: they authenticate with bcrypt via
      // `passwordHash`, and never through the legacy PHP CRM.
      legacyPasswordMd5: randomBytes(16).toString('hex'),
      // `?? DEFAULT_*` rather than relying on the DTO's property initialiser
      // alone: that default only applies when the key is absent from the body,
      // and an explicit `"companyId": null` would slip past it.
      company: await findOrFail(
        this.companyRepository,
        dto.companyId ?? DEFAULT_COMPANY_ID,
        'Company',
      ),
      product: await findOrFail(
        this.productRepository,
        dto.productId ?? DEFAULT_PRODUCT_ID,
        'Product',
      ),
    });
    return this.userRepository.save(user);
  }

  async update(id: number, dto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);
    if (dto.name !== undefined) user.name = dto.name;
    if (dto.mobile !== undefined) user.mobile = dto.mobile;
    if (dto.username !== undefined) user.username = dto.username;
    if (dto.companyId !== undefined)
      user.company = await findOrFail(
        this.companyRepository,
        dto.companyId,
        'Company',
      );
    if (dto.productId !== undefined)
      user.product = await findOrFail(
        this.productRepository,
        dto.productId ?? DEFAULT_PRODUCT_ID,
        'Product',
      );
    return this.userRepository.save(user);
  }

  async softDelete(id: number): Promise<void> {
    const user = await this.findById(id);
    user.isDeleted = true;
    user.isActive = false;
    await this.userRepository.save(user);
  }

  async setActive(id: number, isActive: boolean): Promise<User> {
    const user = await this.findById(id);
    user.isActive = isActive;
    await this.userRepository.save(user);
    return user;
  }

  async unlock(id: number): Promise<User> {
    const user = await this.findById(id);
    user.failedLoginCount = 0;
    await this.userRepository.save(user);
    return user;
  }

  async listRoles(userId: number): Promise<UserRole[]> {
    await this.findById(userId);
    return this.userRoleRepository.find({
      where: { user: { id: userId }, isActive: true },
      relations: { roleType: true, supervisorRole: true },
      order: { id: 'ASC' },
    });
  }

  /**
   * Idempotent: re-granting a role removed via `removeRole` (soft-delete)
   * reactivates that same row rather than inserting a second one — `(
   * user_role_type_id, user_role_user_id)` is a real unique index in the
   * live schema (confirmed against the Hostinger DB), so blindly creating a
   * new row here throws an unhandled DB-level duplicate-key 500 the moment
   * anyone re-grants a role a user previously held. Same pattern as
   * `DisbursalService.grantDisbursalAuthorisation`.
   */
  async assignRole(userId: number, dto: AssignUserRoleDto): Promise<UserRole> {
    const user = await this.findById(userId);
    const roleType = await this.roleTypeRepository.findOne({
      where: { id: dto.roleTypeId },
    });
    if (!roleType) {
      throw new NotFoundException(`Role type ${dto.roleTypeId} not found`);
    }

    const existingAssignment = await this.userRoleRepository.findOne({
      where: {
        user: { id: userId },
        roleType: { id: dto.roleTypeId },
      },
    });
    if (existingAssignment?.isActive && !existingAssignment.isDeleted) {
      throw new ConflictException('User already holds this role');
    }

    const supervisorRole = dto.supervisorRoleId
      ? await this.userRoleRepository.findOne({
          where: { id: dto.supervisorRoleId },
        })
      : null;
    if (dto.supervisorRoleId && !supervisorRole) {
      throw new NotFoundException(
        `Supervisor role assignment ${dto.supervisorRoleId} not found`,
      );
    }

    const userRole =
      existingAssignment ?? this.userRoleRepository.create({ user, roleType });
    userRole.isActive = true;
    userRole.isDeleted = false;
    userRole.supervisorRole = supervisorRole;
    userRole.level = dto.level ?? null;
    return this.userRoleRepository.save(userRole);
  }

  async updateRole(
    userId: number,
    userRoleId: number,
    dto: UpdateUserRoleDto,
  ): Promise<UserRole> {
    const userRole = await this.getUserRoleOrFail(userId, userRoleId);
    if (dto.supervisorRoleId !== undefined) {
      userRole.supervisorRole = await this.userRoleRepository.findOne({
        where: { id: dto.supervisorRoleId },
      });
    }
    if (dto.level !== undefined) userRole.level = dto.level;
    if (dto.isActive !== undefined) userRole.isActive = dto.isActive;
    return this.userRoleRepository.save(userRole);
  }

  async removeRole(userId: number, userRoleId: number): Promise<void> {
    const userRole = await this.getUserRoleOrFail(userId, userRoleId);
    userRole.isActive = false;
    userRole.isDeleted = true;
    await this.userRoleRepository.save(userRole);
  }

  /**
   * Minimal, deliberately not `@Roles('SA','CA')`-gated like the rest of
   * this controller — used to populate assignment pickers (e.g. a `CR2`
   * assigning a lead to a `CR1` screener), so it must be callable by any
   * authenticated user, not just admins. Returns only `{id, name}`, never
   * the full `User` entity, since it's exposed broadly.
   */
  async listByRole(
    roleCode: string,
  ): Promise<Array<{ id: number; name: string }>> {
    if (!roleCode) {
      throw new BadRequestException('role query param is required');
    }
    const userRoles = await this.userRoleRepository.find({
      where: {
        roleType: { code: roleCode },
        isActive: true,
        isDeleted: false,
        user: { isActive: true, isDeleted: false },
      },
      relations: { user: true, roleType: true },
      order: { id: 'ASC' },
    });
    return userRoles.map((userRole) => ({
      id: userRole.user.id,
      name: userRole.user.name,
    }));
  }

  async listActivityLogs(
    query: ListActivityLogsQueryDto & { userId?: number },
  ): Promise<PaginatedResult<UserActivityLog>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const occurredAtFilter = buildDateRangeFilter(query.from, query.to);

    const [data, total] = await this.userActivityLogRepository.findAndCount({
      where: {
        ...(query.userId ? { user: { id: query.userId } } : {}),
        ...(query.activityType ? { activityType: query.activityType } : {}),
        ...(occurredAtFilter ? { occurredAt: occurredAtFilter } : {}),
      },
      relations: { user: true, userRole: true },
      order: { occurredAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, page, limit, total };
  }

  private async getUserRoleOrFail(
    userId: number,
    userRoleId: number,
  ): Promise<UserRole> {
    const userRole = await this.userRoleRepository.findOne({
      where: { id: userRoleId, user: { id: userId } },
      relations: { roleType: true, supervisorRole: true },
    });
    if (!userRole) {
      throw new NotFoundException(
        `Role assignment ${userRoleId} not found for user ${userId}`,
      );
    }
    return userRole;
  }

  private async hashPassword(plain: string): Promise<string> {
    // ConfigService doesn't cast env-var strings to numbers (the generic is
    // a type hint only) — bcrypt.hash() treats a string saltOrRounds as a
    // literal salt, not a cost factor, and throws. Number(...) is required.
    const saltRounds = Number(
      this.configService.get('BCRYPT_SALT_ROUNDS', BCRYPT_SALT_ROUNDS_DEFAULT),
    );
    return bcrypt.hash(plain, saltRounds);
  }
}

function buildDateRangeFilter(
  from: string | undefined,
  to: string | undefined,
) {
  if (from && to) return Between(new Date(from), new Date(to));
  if (from) return MoreThanOrEqual(new Date(from));
  if (to) return LessThanOrEqual(new Date(to));
  return undefined;
}
