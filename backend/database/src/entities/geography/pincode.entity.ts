import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { numericString, tinyintBoolean } from '../column-transformers';
import { City } from './city.entity';

/**
 * Legacy `master_pincode` (19,883 rows). Read by the customer-facing
 * app-server install — additive changes only.
 *
 * `m_pincode_value` is `mediumint unsigned` in legacy while every DTO and
 * service treats a pincode as a string, so it goes through `numericString`.
 * Legacy has no created/updated timestamps here.
 */
@Entity('master_pincode')
export class Pincode {
  @PrimaryGeneratedColumn({ name: 'm_pincode_id', type: 'int', unsigned: true })
  id: number;

  /** Legacy declares `m_pincode_city_id` NOT NULL, so a pincode always belongs
   * to a city. `GeographyService.createPincode` currently allows omitting it —
   * that path cannot succeed against this schema and needs the city required. */
  @ManyToOne(() => City, { nullable: false })
  @JoinColumn({ name: 'm_pincode_city_id' })
  city: City;

  @Column({
    name: 'm_pincode_value',
    type: 'mediumint',
    unsigned: true,
    transformer: numericString,
  })
  value: string;

  @Column({
    name: 'm_pincode_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'm_pincode_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
