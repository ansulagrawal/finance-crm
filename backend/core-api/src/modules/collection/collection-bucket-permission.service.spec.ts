import {
  CollectionBucket,
  User,
  UserCollectionBucketPermission,
  UserRole,
} from '@finance-crm/database';
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CollectionBucketPermissionService } from './collection-bucket-permission.service';

function repo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOneBy: jest.fn().mockResolvedValue(null),
    save: jest.fn(async (x: unknown) => x),
    create: jest.fn((x: unknown) => x),
    ...overrides,
  };
}

describe('CollectionBucketPermissionService', () => {
  let service: CollectionBucketPermissionService;
  let bucketRepository: ReturnType<typeof repo>;
  let permissionRepository: ReturnType<typeof repo>;
  let userRepository: ReturnType<typeof repo>;
  let userRoleRepository: ReturnType<typeof repo>;

  beforeEach(async () => {
    bucketRepository = repo();
    permissionRepository = repo();
    userRepository = repo();
    userRoleRepository = repo();

    const moduleRef = await Test.createTestingModule({
      providers: [
        CollectionBucketPermissionService,
        {
          provide: getRepositoryToken(CollectionBucket),
          useValue: bucketRepository,
        },
        {
          provide: getRepositoryToken(UserCollectionBucketPermission),
          useValue: permissionRepository,
        },
        { provide: getRepositoryToken(User), useValue: userRepository },
        {
          provide: getRepositoryToken(UserRole),
          useValue: userRoleRepository,
        },
      ],
    }).compile();

    service = moduleRef.get(CollectionBucketPermissionService);
  });

  describe('buckets', () => {
    it('listBuckets only returns active buckets, ordered by startDpd', async () => {
      await service.listBuckets();

      expect(bucketRepository.find).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { startDpd: 'ASC' },
      });
    });

    it('createBucket saves a new bucket', async () => {
      const dto = { name: '0-30 DPD', startDpd: 0, endDpd: 30 };

      const bucket = await service.createBucket(dto);

      expect(bucketRepository.save).toHaveBeenCalled();
      expect(bucket).toEqual(dto);
    });

    it('updateBucket merges the dto onto the existing bucket', async () => {
      bucketRepository.findOneBy.mockResolvedValue({
        id: 1,
        name: '0-30 DPD',
        startDpd: 0,
        endDpd: 30,
      });

      await service.updateBucket(1, { endDpd: 45 });

      expect(bucketRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, endDpd: 45 }),
      );
    });

    it('updateBucket throws NotFoundException for an unknown bucket', async () => {
      bucketRepository.findOneBy.mockResolvedValue(null);

      await expect(service.updateBucket(999, {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('removeBucket deactivates and soft-deletes the bucket', async () => {
      bucketRepository.findOneBy.mockResolvedValue({
        id: 1,
        isActive: true,
        isDeleted: false,
      });

      await service.removeBucket(1);

      expect(bucketRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false, isDeleted: true }),
      );
    });
  });

  describe('permission grants', () => {
    it('grantPermission ties the grant to the granting user', async () => {
      userRepository.findOneBy
        .mockResolvedValueOnce({ id: 2 }) // dto.userId
        .mockResolvedValueOnce({ id: 9 }); // grantedByUserId
      bucketRepository.findOneBy.mockResolvedValue({ id: 5 });

      const grant = await service.grantPermission(
        { userId: 2, bucketId: 5 },
        9,
      );

      expect(permissionRepository.save).toHaveBeenCalled();
      expect((grant as UserCollectionBucketPermission).createdById).toBe(9);
      expect((grant as UserCollectionBucketPermission).bucket).toEqual({
        id: 5,
      });
      expect((grant as UserCollectionBucketPermission).userRole).toBeNull();
    });

    it('grantPermission resolves an optional userRoleId', async () => {
      userRepository.findOneBy
        .mockResolvedValueOnce({ id: 2 })
        .mockResolvedValueOnce({ id: 9 });
      bucketRepository.findOneBy.mockResolvedValue({ id: 5 });
      userRoleRepository.findOneBy.mockResolvedValue({ id: 3 });

      const grant = await service.grantPermission(
        { userId: 2, bucketId: 5, userRoleId: 3 },
        9,
      );

      expect((grant as UserCollectionBucketPermission).userRole).toEqual({
        id: 3,
      });
    });

    it('grantPermission throws NotFoundException for an unknown target user', async () => {
      userRepository.findOneBy.mockResolvedValueOnce(null);

      await expect(
        service.grantPermission({ userId: 404, bucketId: 5 }, 9),
      ).rejects.toThrow(NotFoundException);
      expect(permissionRepository.save).not.toHaveBeenCalled();
    });

    it('grantPermission throws NotFoundException for an unknown bucket', async () => {
      userRepository.findOneBy
        .mockResolvedValueOnce({ id: 2 })
        .mockResolvedValueOnce({ id: 9 });
      bucketRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.grantPermission({ userId: 2, bucketId: 404 }, 9),
      ).rejects.toThrow(NotFoundException);
    });

    it('revokePermission marks the grant inactive and deleted', async () => {
      permissionRepository.findOneBy.mockResolvedValue({
        id: 1,
        isActive: true,
        isDeleted: false,
      });

      await service.revokePermission(1);

      expect(permissionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false, isDeleted: true }),
      );
    });

    it('revokePermission throws NotFoundException for an unknown grant', async () => {
      permissionRepository.findOneBy.mockResolvedValue(null);

      await expect(service.revokePermission(999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('listPermissions with no userId returns every grant', async () => {
      await service.listPermissions();

      expect(permissionRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
    });

    it('listPermissions scoped to a userId filters by that user only', async () => {
      await service.listPermissions(2);

      expect(permissionRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true, user: { id: 2 } },
        }),
      );
    });
  });
});
