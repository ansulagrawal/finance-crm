import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { numericString, tinyintBoolean } from '../column-transformers';
import { User } from '../users/user.entity';

/**
 * `ADOPT-UNVERIFIED` per docs/SCHEMA-MAP.md — legacy `master_blacklist_pincode`
 * is absent from the UAT dump, but its real columns are known from
 * `old-php-files/application/controllers/BlacklistedPincodeController.php`
 * (`mbp_id`/`mbp_pincode`/`mbp_publish_by`/`mbp_created_on`/`mbp_updated_on`/
 * `mbp_active`). Confirm against production before cutover; create this
 * table only if production also lacks it.
 */
@Entity('master_blacklist_pincode')
export class BlacklistedPincode {
  @PrimaryGeneratedColumn({ name: 'mbp_id', type: 'int', unsigned: true })
  id: number;

  @Column({
    name: 'mbp_pincode',
    type: 'mediumint',
    unsigned: true,
    transformer: numericString,
  })
  pincode: string;

  @Column({
    name: 'mbp_publish_by',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  publishedById: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'mbp_publish_by' })
  publishedBy: User | null;

  @Column({ name: 'mbp_created_on', type: 'datetime', nullable: true })
  createdAt: Date | null;

  @Column({ name: 'mbp_updated_on', type: 'datetime', nullable: true })
  updatedAt: Date | null;

  @Column({
    name: 'mbp_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'mbp_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
