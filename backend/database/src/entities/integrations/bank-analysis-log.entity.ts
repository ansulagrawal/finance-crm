import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Lead } from '../leads/lead.entity';
import { User } from '../users/user.entity';
import { Document } from '../verification/document.entity';
import { ApiCallStatus, SerializeApiCallStatus } from './api-call-status';

/** 1=>Upload, 2=>Download — legacy `cart_method_id` comment. */
export enum BankAnalysisMethod {
  UPLOAD = 1,
  DOWNLOAD = 2,
}

/**
 * Legacy `api_banking_cart_log` (CartBI, internally branded "Novel Pattern"
 * — bank-statement upload + async fraud/balance analysis). Upload posts a
 * stored `Document`; CartBI's webhook later calls back with a doc id
 * (`cart_return_novel_doc_id`, matching `Document.novelReturnDocId`), which
 * triggers the download call that fetches the parsed fraud-score/average-
 * balance/account-number data used by BRE rules.
 */
@Entity('api_banking_cart_log')
export class BankAnalysisLog {
  @PrimaryGeneratedColumn({
    name: 'cart_log_id',
    type: 'bigint',
    unsigned: true,
  })
  id: number;

  @Column({ name: 'cart_lead_id', type: 'bigint', unsigned: true })
  leadId: number;

  @ManyToOne(() => Lead, { nullable: false })
  @JoinColumn({ name: 'cart_lead_id' })
  lead: Lead;

  @Column({
    name: 'cart_doc_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  documentId: number | null;

  @ManyToOne(() => Document, { nullable: true })
  @JoinColumn({ name: 'cart_doc_id' })
  document: Document | null;

  @Column({ name: 'cart_user_id', type: 'int', unsigned: true, nullable: true })
  userId: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'cart_user_id' })
  user: User | null;

  @Column({ name: 'cart_method_id', type: 'mediumint', unsigned: true })
  method: BankAnalysisMethod;

  @Column({
    name: 'cart_return_novel_doc_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  novelReturnDocId: string | null;

  @Column({
    name: 'cart_request_id',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  requestId: string | null;

  @Column({ name: 'cart_lan_no', type: 'varchar', length: 20, nullable: true })
  loanNumber: string | null;

  @Column({ name: 'cart_request', type: 'text', nullable: true })
  request: string | null;

  @Column({ name: 'cart_response', type: 'longtext', nullable: true })
  response: string | null;

  @Column({ name: 'cart_encrypted_request', type: 'longtext', nullable: true })
  encryptedRequest: string | null;

  @Column({ name: 'cart_encrypted_response', type: 'longtext', nullable: true })
  encryptedResponse: string | null;

  @Column({ name: 'cart_api_status_id', type: 'mediumint', unsigned: true })
  @SerializeApiCallStatus()
  status: ApiCallStatus;

  @Column({ name: 'cart_errors', type: 'varchar', length: 500, nullable: true })
  errors: string | null;

  @Column({ name: 's3_flag', type: 'tinyint', unsigned: true, default: 0 })
  isUploadedToS3: boolean;

  @Column({ name: 'cart_request_datetime', type: 'datetime', nullable: true })
  requestedAt: Date | null;

  @Column({ name: 'cart_response_datetime', type: 'datetime', nullable: true })
  respondedAt: Date | null;

  @Column({ name: 'cart_active', type: 'tinyint', unsigned: true, default: 1 })
  isActive: boolean;

  @Column({ name: 'cart_deleted', type: 'tinyint', unsigned: true, default: 0 })
  isDeleted: boolean;
}
