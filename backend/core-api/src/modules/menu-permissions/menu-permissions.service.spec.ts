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
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MenuPermissionsService } from './menu-permissions.service';

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

describe('MenuPermissionsService', () => {
  let service: MenuPermissionsService;
  let menuItemRepository: ReturnType<typeof repo>;
  let roleTypeRepository: ReturnType<typeof repo>;
  let companyRepository: ReturnType<typeof repo>;
  let productRepository: ReturnType<typeof repo>;
  let userRepository: ReturnType<typeof repo>;
  let userRoleRepository: ReturnType<typeof repo>;
  let userExportPermissionRepository: ReturnType<typeof repo>;
  let userMisPermissionRepository: ReturnType<typeof repo>;
  let exportCatalogRepository: ReturnType<typeof repo>;
  let misReportCatalogRepository: ReturnType<typeof repo>;

  beforeEach(async () => {
    menuItemRepository = repo();
    roleTypeRepository = repo();
    companyRepository = repo();
    productRepository = repo();
    userRepository = repo();
    userRoleRepository = repo();
    userExportPermissionRepository = repo();
    userMisPermissionRepository = repo();
    exportCatalogRepository = repo();
    misReportCatalogRepository = repo();

    const moduleRef = await Test.createTestingModule({
      providers: [
        MenuPermissionsService,
        {
          provide: getRepositoryToken(MenuItem),
          useValue: menuItemRepository,
        },
        {
          provide: getRepositoryToken(RoleType),
          useValue: roleTypeRepository,
        },
        { provide: getRepositoryToken(Company), useValue: companyRepository },
        { provide: getRepositoryToken(Product), useValue: productRepository },
        { provide: getRepositoryToken(User), useValue: userRepository },
        {
          provide: getRepositoryToken(UserRole),
          useValue: userRoleRepository,
        },
        {
          provide: getRepositoryToken(UserExportPermission),
          useValue: userExportPermissionRepository,
        },
        {
          provide: getRepositoryToken(UserMisPermission),
          useValue: userMisPermissionRepository,
        },
        {
          provide: getRepositoryToken(ExportCatalog),
          useValue: exportCatalogRepository,
        },
        {
          provide: getRepositoryToken(MisReportCatalog),
          useValue: misReportCatalogRepository,
        },
      ],
    }).compile();

    service = moduleRef.get(MenuPermissionsService);
  });

  describe('listGrouped', () => {
    it('groups flat menu items by sectionId, preserving each item', async () => {
      menuItemRepository.find.mockResolvedValue([
        { id: 1, sectionId: 1, sectionLabel: 'Leads' },
        { id: 2, sectionId: 1, sectionLabel: 'Leads' },
        { id: 3, sectionId: 2, sectionLabel: 'Reports' },
      ]);

      const sections = await service.listGrouped({});

      expect(sections).toEqual([
        {
          sectionId: 1,
          sectionLabel: 'Leads',
          items: [
            { id: 1, sectionId: 1, sectionLabel: 'Leads' },
            { id: 2, sectionId: 1, sectionLabel: 'Leads' },
          ],
        },
        {
          sectionId: 2,
          sectionLabel: 'Reports',
          items: [{ id: 3, sectionId: 2, sectionLabel: 'Reports' }],
        },
      ]);
    });
  });

  describe('create', () => {
    const createDto = {
      roleTypeId: 1,
      sectionId: 2,
      sectionLabel: 'Leads',
      name: 'Leads',
      stage: 'screening',
      routeLink: '/leads',
      boxBgColor: '#4F46E5',
      companyId: 1,
      productId: 1,
    };

    it('throws NotFoundException for an unknown roleTypeId', async () => {
      roleTypeRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.create({ ...createDto, roleTypeId: 999 }, 9),
      ).rejects.toThrow(NotFoundException);
      expect(menuItemRepository.save).not.toHaveBeenCalled();
    });

    it('creates a menu item scoped to a role type', async () => {
      roleTypeRepository.findOneBy.mockResolvedValue({ id: 1, code: 'AU' });
      companyRepository.findOneBy.mockResolvedValue({ id: 1 });
      productRepository.findOneBy.mockResolvedValue({ id: 1 });

      const item = await service.create(createDto, 9);

      expect(menuItemRepository.save).toHaveBeenCalled();
      expect((item as MenuItem).roleType).toEqual({ id: 1, code: 'AU' });
    });
  });

  describe('remove', () => {
    it('deactivates the menu item (master_lms_menu has no is_deleted column)', async () => {
      menuItemRepository.findOneBy.mockResolvedValue({
        id: 1,
        isActive: true,
      });

      await service.remove(1);

      expect(menuItemRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });

    it('throws NotFoundException for an unknown menu item', async () => {
      menuItemRepository.findOneBy.mockResolvedValue(null);
      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('export permission grants', () => {
    it('grants an export permission tied to the granting user', async () => {
      userRepository.findOneBy
        .mockResolvedValueOnce({ id: 2 }) // dto.userId
        .mockResolvedValueOnce({ id: 9 }); // grantedByUserId
      exportCatalogRepository.findOneBy.mockResolvedValue({ id: 5 });

      const grant = await service.grantExportPermission(
        { userId: 2, exportId: 5 },
        9,
      );

      expect(userExportPermissionRepository.save).toHaveBeenCalled();
      expect((grant as UserExportPermission).grantedBy).toEqual({ id: 9 });
      expect((grant as UserExportPermission).export).toEqual({ id: 5 });
    });

    it('throws NotFoundException for an unknown target user', async () => {
      userRepository.findOneBy.mockResolvedValueOnce(null);

      await expect(
        service.grantExportPermission({ userId: 404, exportId: 5 }, 9),
      ).rejects.toThrow(NotFoundException);
    });

    it('revoking an export grant marks it inactive and deleted (a permission check reading isActive would then deny access)', async () => {
      userExportPermissionRepository.findOneBy.mockResolvedValue({
        id: 1,
        isActive: true,
        isDeleted: false,
      });

      await service.revokeExportPermission(1);

      expect(userExportPermissionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false, isDeleted: true }),
      );
    });

    it('listExportPermissions with no userId returns every grant (admin-only listing, scoped at the controller/route level)', async () => {
      userExportPermissionRepository.find.mockResolvedValue([{ id: 1 }]);

      const result = await service.listExportPermissions();

      expect(userExportPermissionRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
      expect(result).toEqual([{ id: 1 }]);
    });

    it('listExportPermissions scoped to a userId filters by that user only', async () => {
      await service.listExportPermissions(2);

      expect(userExportPermissionRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true, user: { id: 2 } },
        }),
      );
    });
  });

  describe('MIS permission grants', () => {
    it('grants a MIS permission tied to the granting user', async () => {
      userRepository.findOneBy
        .mockResolvedValueOnce({ id: 2 })
        .mockResolvedValueOnce({ id: 9 });

      misReportCatalogRepository.findOneBy.mockResolvedValue({ id: 7 });

      const grant = await service.grantMisPermission(
        { userId: 2, misId: 7 },
        9,
      );

      expect(userMisPermissionRepository.save).toHaveBeenCalled();
      expect((grant as UserMisPermission).mis).toEqual({ id: 7 });
    });

    it('revoking a MIS grant marks it inactive and deleted', async () => {
      userMisPermissionRepository.findOneBy.mockResolvedValue({
        id: 1,
        isActive: true,
        isDeleted: false,
      });

      await service.revokeMisPermission(1);

      expect(userMisPermissionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false, isDeleted: true }),
      );
    });

    it('throws NotFoundException revoking an unknown MIS grant', async () => {
      userMisPermissionRepository.findOneBy.mockResolvedValue(null);

      await expect(service.revokeMisPermission(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
