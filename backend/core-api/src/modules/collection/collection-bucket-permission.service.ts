import { findOrFail } from '@finance-crm/common';
import {
  CollectionBucket,
  User,
  UserCollectionBucketPermission,
  UserRole,
} from '@finance-crm/database';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { CreateCollectionBucketDto } from './dto/create-collection-bucket.dto';
import { GrantCollectionBucketPermissionDto } from './dto/grant-collection-bucket-permission.dto';
import { UpdateCollectionBucketDto } from './dto/update-collection-bucket.dto';

/**
 * Ports the DPD-bucket visibility restriction from
 * `UMS_Model::getCreditUserList()` (legacy `master_collection_bucket_wise` +
 * `collection_bucket_wise_permission`) — collection agents (CO1/CO2/CO3) only
 * see loans whose DPD falls within the MIN(start)/MAX(end) of their granted
 * buckets. No real bucket boundary data exists in the UAT dump (the legacy
 * table is referenced but never populated), so buckets are seeded empty and
 * defined here through admin CRUD.
 */
@Injectable()
export class CollectionBucketPermissionService {
  constructor(
    @InjectRepository(CollectionBucket)
    private readonly bucketRepository: Repository<CollectionBucket>,
    @InjectRepository(UserCollectionBucketPermission)
    private readonly permissionRepository: Repository<UserCollectionBucketPermission>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
  ) {}

  listBuckets(): Promise<CollectionBucket[]> {
    return this.bucketRepository.find({
      where: { isActive: true },
      order: { startDpd: 'ASC' },
    });
  }

  findBucket(id: number): Promise<CollectionBucket> {
    return findOrFail(this.bucketRepository, id, 'Collection bucket');
  }

  createBucket(dto: CreateCollectionBucketDto): Promise<CollectionBucket> {
    const bucket = this.bucketRepository.create(dto);
    return this.bucketRepository.save(bucket);
  }

  async updateBucket(
    id: number,
    dto: UpdateCollectionBucketDto,
  ): Promise<CollectionBucket> {
    const bucket = await this.findBucket(id);
    Object.assign(bucket, dto);
    return this.bucketRepository.save(bucket);
  }

  async removeBucket(id: number): Promise<void> {
    const bucket = await this.findBucket(id);
    bucket.isActive = false;
    bucket.isDeleted = true;
    await this.bucketRepository.save(bucket);
  }

  async listPermissions(
    userId?: number,
  ): Promise<UserCollectionBucketPermission[]> {
    return this.permissionRepository.find({
      where: {
        isActive: true,
        ...(userId ? { user: { id: userId } } : {}),
      },
      relations: { user: true, userRole: true, bucket: true },
      order: { id: 'DESC' },
    });
  }

  async grantPermission(
    dto: GrantCollectionBucketPermissionDto,
    grantedByUserId: number,
  ): Promise<UserCollectionBucketPermission> {
    const user = await findOrFail(this.userRepository, dto.userId, 'User');
    // Confirms the granting user exists; `UserCollectionBucketPermission` has
    // no `grantedBy` relation, only a plain `createdById` column (see below).
    await findOrFail(this.userRepository, grantedByUserId, 'User');
    const userRole = dto.userRoleId
      ? await findOrFail(this.userRoleRepository, dto.userRoleId, 'User role')
      : null;
    const bucket = await findOrFail(
      this.bucketRepository,
      dto.bucketId,
      'Collection bucket',
    );

    const grant = this.permissionRepository.create({
      user,
      userRole,
      bucket,
      createdById: grantedByUserId,
      createdAt: new Date(),
    });
    return this.permissionRepository.save(grant);
  }

  async revokePermission(id: number): Promise<void> {
    const grant = await findOrFail(
      this.permissionRepository,
      id,
      'Collection bucket permission',
    );
    grant.isActive = false;
    grant.isDeleted = true;
    await this.permissionRepository.save(grant);
  }
}
