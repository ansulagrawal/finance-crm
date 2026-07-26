import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { numericString, tinyintBoolean } from '../column-transformers';
import { Lead } from './lead.entity';

/** 1=>Customers, 2=>Employees — legacy `lead_customer_references.ref_type` comment. */
export enum LeadReferenceType {
  CUSTOMER = 1,
  EMPLOYEE = 2,
}

/** Legacy `lead_customer_references` (confirmed against a real UAT export). */
@Entity('lead_customer_references')
export class LeadCustomerReference {
  @PrimaryGeneratedColumn({ name: 'lcr_id', type: 'bigint', unsigned: true })
  id: number;

  @Column({
    name: 'lcr_lead_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  leadId: number | null;

  @ManyToOne(() => Lead, { nullable: true })
  @JoinColumn({ name: 'lcr_lead_id' })
  lead: Lead | null;

  @Column({ name: 'lcr_name', type: 'varchar', length: 100, nullable: true })
  name: string | null;

  @Column({
    name: 'lcr_relationType',
    type: 'mediumint',
    unsigned: true,
    nullable: true,
  })
  relationType: number | null;

  @Column({
    name: 'ref_type',
    type: 'int',
    default: LeadReferenceType.CUSTOMER,
  })
  refType: LeadReferenceType;

  @Column({ name: 'lcr_mobile', type: 'bigint', transformer: numericString })
  mobile: string;

  @Column({
    name: 'lcr_created_by',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  createdById: number | null;

  @Column({ name: 'lcr_created_on', type: 'timestamp' })
  createdAt: Date;

  @Column({
    name: 'lcr_udpated_by',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  updatedById: number | null;

  @Column({ name: 'lcr_updated_on', type: 'timestamp', nullable: true })
  updatedAt: Date | null;

  @Column({
    name: 'lcr_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'lcr_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
