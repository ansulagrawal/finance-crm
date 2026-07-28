import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { ApiCallStatus, SerializeApiCallStatus } from './api-call-status';

/** 1=>Worldline, 2=>DigiTap — legacy `enach_provider` comment. */
export enum EnachProvider {
  WORLDLINE = 1,
  DIGITAP = 2,
}

/** 1=>Register, 2=>Get Details, 3=>Get Files, 4=>Get E-Aadhaar, 5=>Pull Document — legacy `enach_request_id` comment. */
export enum EnachRequestType {
  REGISTER = 1,
  GET_DETAILS = 2,
  GET_FILES = 3,
  GET_E_AADHAAR = 4,
  PULL_DOCUMENT = 5,
}

/**
 * Legacy `api_enach_logs` (ICICI eNACH mandate scheduling/transaction
 * initiation, keyed by `loan_no` rather than a lead FK — legacy has no
 * lead-id column on this table). Legacy currently ships this hardcoded/
 * stubbed (a canned response, not a live curl call) — see docs/TODO.md;
 * this entity models the real table shape regardless of that.
 */
@Entity('api_enach_logs')
export class EnachLog {
  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint' })
  id: number;

  @Column({
    name: 'enach_user_id',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  userId: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'enach_user_id' })
  user: User | null;

  @Column({ name: 'enach_provider', type: 'tinyint', unsigned: true })
  provider: EnachProvider;

  @Column({ name: 'enach_request_id', type: 'tinyint' })
  requestType: EnachRequestType;

  @Column({ name: 'enach_loan_no', type: 'varchar', length: 50 })
  loanNumber: string;

  @Column({ name: 'enach_txn_id', type: 'varchar', length: 50 })
  transactionId: string;

  @Column({
    name: 'enach_mandate_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  mandateId: string | null;

  @Column({ name: 'enach_request', type: 'longtext', nullable: true })
  request: string | null;

  @Column({ name: 'enach_response', type: 'longtext', nullable: true })
  response: string | null;

  @Column({
    name: 'enach_status_code',
    type: 'varchar',
    length: 4,
    nullable: true,
  })
  statusCode: string | null;

  @Column({ name: 'enach_api_status_id', type: 'mediumint' })
  @SerializeApiCallStatus()
  status: ApiCallStatus;

  @Column({
    name: 'enach_errors',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  errors: string | null;

  @Column({ name: 'enach_return_url', type: 'text', nullable: true })
  returnUrl: string | null;

  @Column({ name: 'enach_request_datetime', type: 'datetime', nullable: true })
  requestedAt: Date | null;

  @Column({ name: 'enach_response_datetime', type: 'datetime', nullable: true })
  respondedAt: Date | null;

  @Column({ name: 'enach_active', type: 'tinyint', default: 1 })
  isActive: boolean;

  @Column({ name: 'enach_deleted', type: 'tinyint', default: 0 })
  isDeleted: boolean;
}
