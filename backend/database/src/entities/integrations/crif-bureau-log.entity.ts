import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { tinyintBoolean } from '../column-transformers';
import { Lead } from '../leads/lead.entity';

/** 1=>TU, 2=>CRIF — legacy `cibil_bureau_type` comment. */
export enum BureauType {
  TU = 1,
  CRIF = 2,
}

/**
 * Legacy `tbl_cibil_log` (Surepass CRIF bureau report — the currently-live
 * bureau vendor; Signzy's own CRIF passthrough exists in legacy config but
 * is commented out of the live code path, not ported). `tbl_cibil` is the
 * parsed bureau summary and stays untouched. Only the columns
 * `api1`/`api2`/`api3` request+response (the three real API steps) plus the
 * parsed score fields are mapped; legacy's ~15 customer-identity-snapshot
 * columns (name/email/dob/pincode/etc.) duplicate data already live on
 * `Lead`/`LeadCustomer` and are left unmapped.
 */
@Entity('tbl_cibil_log')
export class CrifBureauLog {
  @PrimaryGeneratedColumn({ name: 'cibil_id', type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'lead_id', type: 'bigint', unsigned: true, nullable: true })
  leadId: number | null;

  @ManyToOne(() => Lead, { nullable: true })
  @JoinColumn({ name: 'lead_id' })
  lead: Lead | null;

  @Column({ name: 'customer_mobile_1', type: 'varchar', length: 50 })
  mobile: string;

  @Column({ name: 'api1_request', type: 'text', nullable: true })
  api1Request: string | null;

  @Column({ name: 'api1_response', type: 'longtext', nullable: true })
  api1Response: string | null;

  @Column({
    name: 'applicationId',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  applicationId: string | null;

  @Column({ name: 'api2_request', type: 'text', nullable: true })
  api2Request: string | null;

  @Column({ name: 'api2_response', type: 'longtext', nullable: true })
  api2Response: string | null;

  @Column({
    name: 'api3_request',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  api3Request: string | null;

  @Column({
    name: 'api3_response',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  api3Response: string | null;

  @Column({ name: 'cibil_file', type: 'longtext', nullable: true })
  reportFile: string | null;

  @Column({ name: 'cibilScore', type: 'varchar', length: 50, nullable: true })
  cibilScore: string | null;

  @Column({
    name: 'cibil_bureau_type',
    type: 'tinyint',
    unsigned: true,
    default: BureauType.TU,
  })
  bureauType: BureauType;

  @Column({
    name: 'cibil_bearau_status',
    type: 'varchar',
    length: 3,
    nullable: true,
  })
  bureauStatus: string | null;

  @Column({ name: 'cibil_flag', type: 'int', nullable: true, default: 0 })
  cibilFlag: number;

  @Column({
    name: 's3_flag',
    type: 'tinyint',
    nullable: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isUploadedToS3: boolean;

  @Column({ name: 'created_at', type: 'timestamp', nullable: true })
  createdAt: Date | null;

  @Column({ name: 'updated_at', type: 'datetime', nullable: true })
  updatedAt: Date | null;

  @Column({
    name: 'cibil_log_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'cibil_log_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
