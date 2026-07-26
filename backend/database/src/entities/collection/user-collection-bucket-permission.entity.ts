import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { tinyintBoolean } from '../column-transformers';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user-role.entity';
import { CollectionBucket } from './collection-bucket.entity';

/**
 * Legacy `collection_bucket_wise_permission` (confirmed against a real UAT
 * export) — grants a collection agent visibility into a specific DPD bucket
 * (`cbwp_mcbw_id` -> `master_collection_bucket_wise`, see `CollectionBucket`).
 */
@Entity('collection_bucket_wise_permission')
export class UserCollectionBucketPermission {
  @PrimaryGeneratedColumn({ name: 'cbwp_id', type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'cbwp_mcbw_id', type: 'int', unsigned: true })
  bucketId: number;

  @ManyToOne(() => CollectionBucket, { nullable: false })
  @JoinColumn({ name: 'cbwp_mcbw_id' })
  bucket: CollectionBucket;

  @Column({
    name: 'cbwp_user_role_id',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  userRoleId: number | null;

  @ManyToOne(() => UserRole, { nullable: true })
  @JoinColumn({ name: 'cbwp_user_role_id' })
  userRole: UserRole | null;

  @Column({ name: 'cbwp_user_id', type: 'int', unsigned: true })
  userId: number;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'cbwp_user_id' })
  user: User;

  @Column({ name: 'cbwp_created_user_id', type: 'int', nullable: true })
  createdById: number | null;

  @Column({ name: 'cbwp_created_at', type: 'timestamp' })
  createdAt: Date;

  @Column({ name: 'cbwp_updated_user_id', type: 'int', nullable: true })
  updatedById: number | null;

  @Column({ name: 'cbwp_updated_at', type: 'datetime', nullable: true })
  updatedAt: Date | null;

  @Column({
    name: 'cbwp_ip_address',
    type: 'varchar',
    length: 45,
    nullable: true,
  })
  ipAddress: string | null;

  @Column({
    name: 'cbwp_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'cbwp_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
