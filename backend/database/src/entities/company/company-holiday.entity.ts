import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { tinyintBoolean } from '../column-transformers';

/**
 * Legacy `company_holiday` (`Admin/CompanyHolidayController.php`) — a holiday
 * calendar. Legacy has no `company_id` column despite the per-company naming;
 * every row is unscoped, same as `company_login`/`tbl_product` treating
 * `company_id` as an implicit constant. Nothing currently reads this table
 * for SLA/collection-day math — see `docs/TODO.md`.
 */
@Entity('company_holiday')
export class CompanyHoliday {
  @PrimaryGeneratedColumn({ name: 'ch_id', type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'ch_holiday_date', type: 'date' })
  holidayDate: string;

  @Column({ name: 'ch_holiday_name', type: 'varchar', length: 500 })
  name: string;

  @Column({
    name: 'ch_active',
    type: 'tinyint',
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'ch_deleted',
    type: 'tinyint',
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;

  @Column({
    name: 'ch_created_by',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  createdById: number | null;

  @Column({ name: 'ch_created_datetime', type: 'datetime', nullable: true })
  createdAt: Date | null;

  @Column({
    name: 'ch_deleted_by',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  deletedById: number | null;

  @Column({ name: 'ch_deleted_datetime', type: 'datetime', nullable: true })
  deletedAt: Date | null;
}
