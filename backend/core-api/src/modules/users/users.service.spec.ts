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
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';

function repo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    findOneBy: jest.fn(async ({ id }: { id: number }) => ({ id })),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    save: jest.fn(async (x: unknown) => x),
    create: jest.fn((x: unknown) => x),
    ...overrides,
  };
}

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: ReturnType<typeof repo>;
  let companyRepository: ReturnType<typeof repo>;
  let productRepository: ReturnType<typeof repo>;
  let roleTypeRepository: ReturnType<typeof repo>;
  let userRoleRepository: ReturnType<typeof repo>;
  let userActivityLogRepository: ReturnType<typeof repo>;

  beforeEach(async () => {
    userRepository = repo();
    companyRepository = repo();
    productRepository = repo();
    roleTypeRepository = repo();
    userRoleRepository = repo();
    userActivityLogRepository = repo();

    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(Company), useValue: companyRepository },
        { provide: getRepositoryToken(Product), useValue: productRepository },
        {
          provide: getRepositoryToken(RoleType),
          useValue: roleTypeRepository,
        },
        {
          provide: getRepositoryToken(UserRole),
          useValue: userRoleRepository,
        },
        {
          provide: getRepositoryToken(UserActivityLog),
          useValue: userActivityLogRepository,
        },
        {
          provide: ConfigService,
          useValue: { get: (_key: string, fallback?: unknown) => fallback },
        },
      ],
    }).compile();

    service = moduleRef.get(UsersService);
  });

  describe('list', () => {
    it('matches a search term against name, email, username, and mobile, not just name', async () => {
      await service.list({ search: 'ansul' });

      expect(userRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: [
            expect.objectContaining({
              name: expect.objectContaining({ _value: '%ansul%' }),
            }),
            expect.objectContaining({
              email: expect.objectContaining({ _value: '%ansul%' }),
            }),
            expect.objectContaining({
              username: expect.objectContaining({ _value: '%ansul%' }),
            }),
            expect.objectContaining({
              mobile: expect.objectContaining({ _value: '%ansul%' }),
            }),
          ],
        }),
      );
    });

    it('ANDs companyId/isActive into every OR branch of a search', async () => {
      await service.list({ search: 'ansul', companyId: 3, isActive: true });

      const [args] = userRepository.findAndCount.mock.calls[0];
      for (const branch of args.where) {
        expect(branch).toEqual(
          expect.objectContaining({
            company: { id: 3 },
            isActive: true,
          }),
        );
      }
    });

    it('applies companyId/isActive with no OR branches when there is no search term', async () => {
      await service.list({ companyId: 3, isActive: true });

      expect(userRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { company: { id: 3 }, isActive: true },
        }),
      );
    });
  });

  describe('create', () => {
    it('hashes the password and creates the user', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const user = await service.create({
        name: 'Jane',
        email: 'jane@example.com',
        password: 'password1',
        mobile: '9876543210',
        companyId: 1,
        productId: 1,
      });

      expect(user.passwordHash).not.toBe('password1');
      expect(
        await bcrypt.compare('password1', (user as User).passwordHash ?? ''),
      ).toBe(true);
      // Legacy `users.password` is NOT NULL and MD5-shaped; a user created here
      // gets an unusable value so they can only authenticate via bcrypt.
      expect((user as User).legacyPasswordMd5).toHaveLength(32);
      expect(
        await bcrypt.compare('password1', (user as User).legacyPasswordMd5),
      ).toBe(false);
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('rejects creating a user whose email already exists', async () => {
      userRepository.findOne.mockResolvedValue({ id: 1 });

      await expect(
        service.create({
          name: 'Jane',
          email: 'jane@example.com',
          password: 'password1',
          mobile: '9876543210',
          companyId: 1,
          productId: 1,
        }),
      ).rejects.toThrow(ConflictException);
      expect(userRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('throws NotFoundException for a missing user', async () => {
      userRepository.findOne.mockResolvedValue(null);
      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('softDelete', () => {
    it('marks the user inactive and deleted', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 1,
        isActive: true,
        isDeleted: false,
      });

      await service.softDelete(1);

      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false, isDeleted: true }),
      );
    });
  });

  describe('setActive', () => {
    it('deactivates a user', async () => {
      userRepository.findOne.mockResolvedValue({ id: 1, isActive: true });

      const result = await service.setActive(1, false);

      expect(result.isActive).toBe(false);
      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });

    it('reactivates a user', async () => {
      userRepository.findOne.mockResolvedValue({ id: 1, isActive: false });

      const result = await service.setActive(1, true);

      expect(result.isActive).toBe(true);
    });
  });

  describe('unlock', () => {
    it('resets the failed-login counter', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 1,
        failedLoginCount: 5,
      });

      const result = await service.unlock(1);

      expect(result.failedLoginCount).toBe(0);
      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ failedLoginCount: 0 }),
      );
    });
  });

  describe('assignRole', () => {
    it('assigns a new role to a user', async () => {
      userRepository.findOne.mockResolvedValue({ id: 1 });
      roleTypeRepository.findOne.mockResolvedValue({ id: 2, code: 'AU' });
      userRoleRepository.findOne.mockResolvedValueOnce(null); // existingAssignment check

      const result = await service.assignRole(1, { roleTypeId: 2 });

      expect(userRoleRepository.save).toHaveBeenCalled();
      expect((result as UserRole).roleType).toEqual({ id: 2, code: 'AU' });
    });

    it('rejects assigning a role the user already actively holds', async () => {
      userRepository.findOne.mockResolvedValue({ id: 1 });
      roleTypeRepository.findOne.mockResolvedValue({ id: 2, code: 'AU' });
      userRoleRepository.findOne.mockResolvedValueOnce({
        id: 99,
        isActive: true,
        isDeleted: false,
      });

      await expect(service.assignRole(1, { roleTypeId: 2 })).rejects.toThrow(
        ConflictException,
      );
      expect(userRoleRepository.save).not.toHaveBeenCalled();
    });

    it('reactivates a previously-removed assignment instead of inserting a second row', async () => {
      // `(user_role_type_id, user_role_user_id)` is a real unique index in
      // the live schema — creating a new row here for a user who already
      // has a soft-deleted row for this role throws a DB duplicate-key
      // error. Confirmed live: re-granting a role removed earlier in the
      // same session 500'd until this was fixed.
      userRepository.findOne.mockResolvedValue({ id: 1 });
      roleTypeRepository.findOne.mockResolvedValue({ id: 2, code: 'AU' });
      const removedRow = { id: 99, isActive: false, isDeleted: true };
      userRoleRepository.findOne.mockResolvedValueOnce(removedRow);

      const result = await service.assignRole(1, { roleTypeId: 2 });

      expect(userRoleRepository.create).not.toHaveBeenCalled();
      expect(userRoleRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 99, isActive: true, isDeleted: false }),
      );
      expect((result as UserRole).id).toBe(99);
    });

    it('rejects assigning an unknown role type', async () => {
      userRepository.findOne.mockResolvedValue({ id: 1 });
      roleTypeRepository.findOne.mockResolvedValue(null);

      await expect(service.assignRole(1, { roleTypeId: 999 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects an unknown supervisorRoleId', async () => {
      userRepository.findOne.mockResolvedValue({ id: 1 });
      roleTypeRepository.findOne.mockResolvedValue({ id: 2, code: 'AU' });
      userRoleRepository.findOne
        .mockResolvedValueOnce(null) // existingAssignment check
        .mockResolvedValueOnce(null); // supervisorRole lookup

      await expect(
        service.assignRole(1, { roleTypeId: 2, supervisorRoleId: 777 }),
      ).rejects.toThrow(NotFoundException);
      expect(userRoleRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('removeRole', () => {
    it('soft-removes an existing role assignment', async () => {
      userRoleRepository.findOne.mockResolvedValue({
        id: 5,
        isActive: true,
        isDeleted: false,
      });

      await service.removeRole(1, 5);

      expect(userRoleRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false, isDeleted: true }),
      );
    });

    it('throws NotFoundException when the role assignment does not belong to the user', async () => {
      userRoleRepository.findOne.mockResolvedValue(null);

      await expect(service.removeRole(1, 5)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateRole', () => {
    it('updates supervisorRole/level/isActive fields', async () => {
      userRoleRepository.findOne
        .mockResolvedValueOnce({ id: 5, level: 1, isActive: true }) // getUserRoleOrFail
        .mockResolvedValueOnce({ id: 8 }); // supervisorRole lookup

      const result = await service.updateRole(1, 5, {
        supervisorRoleId: 8,
        level: 2,
        isActive: false,
      });

      expect(result.level).toBe(2);
      expect(result.isActive).toBe(false);
      expect((result as UserRole).supervisorRole).toEqual({ id: 8 });
    });
  });

  describe('listByRole', () => {
    it('returns a minimal {id, name} shape for active users holding the role', async () => {
      userRoleRepository.find.mockResolvedValue([
        { user: { id: 1, name: 'Priya' } },
        { user: { id: 2, name: 'Ravi' } },
      ]);

      const result = await service.listByRole('CR1');

      expect(userRoleRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            roleType: { code: 'CR1' },
            isActive: true,
            isDeleted: false,
          }),
        }),
      );
      expect(result).toEqual([
        { id: 1, name: 'Priya' },
        { id: 2, name: 'Ravi' },
      ]);
    });

    it('throws BadRequestException when no role is given', async () => {
      await expect(service.listByRole('')).rejects.toThrow(BadRequestException);
      expect(userRoleRepository.find).not.toHaveBeenCalled();
    });
  });
});
