import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { tinyintBoolean } from '../column-transformers';
import { UserRole } from './user-role.entity';

/** 1=>city, 2=>state, 3=>branch — legacy `user_role_locations.user_rl_location_type_id` comment. */
export enum UserRoleLocationType {
  CITY = 1,
  STATE = 2,
  BRANCH = 3,
}

/** Legacy `user_role_locations` (confirmed against a real UAT export). */
@Entity('user_role_locations')
export class UserRoleLocation {
  @PrimaryGeneratedColumn({
    name: 'user_rl_id',
    type: 'bigint',
    unsigned: true,
  })
  id: number;

  @Column({ name: 'user_rl_role_id', type: 'bigint', unsigned: true })
  userRoleId: number;

  @ManyToOne(() => UserRole, { nullable: false })
  @JoinColumn({ name: 'user_rl_role_id' })
  userRole: UserRole;

  @Column({
    name: 'user_rl_location_type_id',
    type: 'mediumint',
    unsigned: true,
  })
  locationType: UserRoleLocationType;

  /**
   * Polymorphic pointer, not a real FK: depending on locationType this id refers
   * to a row in master_city, master_state, or master_branch.
   */
  @Column({ name: 'user_rl_location_id', type: 'int' })
  locationId: number;

  @Column({
    name: 'user_rl_created_by',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  createdById: number | null;

  @Column({ name: 'user_rl_created_on', type: 'datetime', nullable: true })
  createdAt: Date | null;

  @Column({ name: 'user_rl_updated_by', type: 'int', nullable: true })
  updatedById: number | null;

  @Column({ name: 'user_rl_updated_on', type: 'datetime', nullable: true })
  updatedAt: Date | null;

  @Column({
    name: 'user_rl_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'user_rl_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
