import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { tinyintBoolean } from '../column-transformers';
import { UserRole } from './user-role.entity';
import { User } from './user.entity';

/** 1=>login, 2=>role change, 3=>logout — legacy `user_activity_log.ual_type_id` comment. */
export enum UserActivityType {
  LOGIN = 1,
  ROLE_CHANGE = 2,
  LOGOUT = 3,
}

/** 1=>web, 2=>mobile — legacy `user_activity_log.ual_source_type` comment. */
export enum UserActivitySourceType {
  WEB = 1,
  MOBILE = 2,
}

/** Legacy `user_activity_log` (confirmed against a real UAT export). */
@Entity('user_activity_log')
export class UserActivityLog {
  @PrimaryGeneratedColumn({ name: 'ual_id', type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'ual_url', type: 'varchar', length: 1000, nullable: true })
  url: string | null;

  @Column({
    name: 'ual_platform',
    type: 'varchar',
    length: 1000,
    nullable: true,
  })
  platform: string | null;

  @Column({
    name: 'ual_browser',
    type: 'varchar',
    length: 1000,
    nullable: true,
  })
  browser: string | null;

  @Column({ name: 'ual_agent', type: 'varchar', length: 1000, nullable: true })
  userAgent: string | null;

  @Column({ name: 'ual_ip', type: 'varchar', length: 20, nullable: true })
  ipAddress: string | null;

  @Column({ name: 'ual_type_id', type: 'tinyint', unsigned: true, default: 0 })
  activityType: UserActivityType;

  @Column({ name: 'ual_datetime', type: 'datetime' })
  occurredAt: Date;

  /** Legacy declares this `int(11)` while `users.user_id` is `bigint unsigned` —
   * a legacy width mismatch, not a mapping error (legacy has zero FKs). */
  @Column({ name: 'ual_user_id', type: 'int' })
  userId: number;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'ual_user_id' })
  user: User;

  @Column({ name: 'ual_role_id', type: 'int', nullable: true })
  userRoleId: number | null;

  @ManyToOne(() => UserRole, { nullable: true })
  @JoinColumn({ name: 'ual_role_id' })
  userRole: UserRole | null;

  @Column({
    name: 'ual_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'ual_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;

  @Column({
    name: 'ual_source_type',
    type: 'tinyint',
    unsigned: true,
    default: 0,
  })
  sourceType: UserActivitySourceType;

  @Column({
    name: 'ual_geolocation',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  geoLocation: string | null;
}
