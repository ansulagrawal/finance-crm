import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { tinyintBoolean } from '../column-transformers';
import { Lead } from '../leads/lead.entity';
import { ApiCallStatus, SerializeApiCallStatus } from './api-call-status';

/** 1..6 — legacy `aa_method_id` comment (consent request/status, FI request/status/fetch, analytics report). */
export enum AccountAggregatorMethod {
  CONSENT_REQUEST = 1,
  CONSENT_STATUS = 2,
  FI_REQUEST = 3,
  FI_STATUS = 4,
  FI_FETCH_DATA = 5,
  ANALYTICS_REPORT = 6,
}

/** 1=>SIGNZY (Finvu-shaped flow), 2=>novel pattern (CartBI) — legacy `aa_provider` comment. */
export enum AccountAggregatorProvider {
  LEGACY = 1,
  NOVEL_PATTERN = 2,
}

/**
 * Legacy `api_account_aggregator_logs` (`AAController.php`, confirmed against
 * a real UAT export). Two genuinely different, both-live-in-production flows
 * distinguished by `provider`: `LEGACY` is a 5-step Finvu-shaped flow, one row
 * per `AccountAggregatorMethod` step; `NOVEL_PATTERN` (CartBI) is a simpler
 * consent-request + webhook-callback + downloaded-report flow. Unlike
 * `EkycLog`/`EsignLog` (one row per attempt), consent state chains across
 * calls (`consentHandleId` -> `consentId` -> `sessionId`), so those persist
 * forward from the consent-request step onto every later row for the same
 * lead. `responsePayload` is `longtext` — a real `NOVEL_PATTERN` download
 * response routinely exceeds `text`'s ~64KB MySQL limit.
 */
@Entity('api_account_aggregator_logs')
export class AccountAggregatorLog {
  @PrimaryGeneratedColumn({ name: 'aa_id', type: 'bigint' })
  id: number;

  @Column({ name: 'aa_lead_id', type: 'bigint' })
  leadId: number;

  @ManyToOne(() => Lead, { nullable: false })
  @JoinColumn({ name: 'aa_lead_id' })
  lead: Lead;

  @Column({
    name: 'aa_provider',
    type: 'tinyint',
    default: AccountAggregatorProvider.LEGACY,
  })
  provider: AccountAggregatorProvider;

  @Column({ name: 'aa_method_id', type: 'tinyint' })
  method: AccountAggregatorMethod;

  @Column({
    name: 'aa_consentHandleId',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  consentHandleId: string | null;

  @Column({
    name: 'aa_consentId',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  consentId: string | null;

  @Column({
    name: 'aa_sessionId',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  sessionId: string | null;

  /** `NOVEL_PATTERN` only — the vendor's report id (webhook callback -> passed
   * to the download-report call). */
  @Column({ name: 'aa_doc_id', type: 'varchar', length: 255, nullable: true })
  docId: string | null;

  /** `NOVEL_PATTERN` only — the vendor's report filename from the webhook
   * callback payload. */
  @Column({ name: 'aa_file', type: 'varchar', length: 255, nullable: true })
  reportFileName: string | null;

  @Column({ name: 'aa_token', type: 'text', nullable: true })
  token: string | null;

  @Column({ name: 'aa_request', type: 'text', nullable: true })
  requestPayload: string | null;

  @Column({ name: 'aa_response', type: 'longtext', nullable: true })
  responsePayload: string | null;

  @Column({ name: 'aa_api_status_id', type: 'mediumint' })
  @SerializeApiCallStatus()
  status: ApiCallStatus;

  @Column({
    name: 'aa_status_message',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  statusMessage: string | null;

  @Column({ name: 'aa_error_message', type: 'varchar', length: 255 })
  errorMessage: string;

  @Column({ name: 'aa_callback_status', type: 'tinyint', nullable: true })
  callbackStatus: number | null;

  @Column({ name: 'aa_request_datetime', type: 'datetime' })
  requestedAt: Date;

  @Column({ name: 'aa_response_datetime', type: 'datetime', nullable: true })
  respondedAt: Date | null;

  @Column({ name: 'aa_active', type: 'tinyint', default: 1 })
  isActive: boolean;

  @Column({ name: 'aa_deleted', type: 'tinyint', default: 0 })
  isDeleted: boolean;

  /** Confirmed against a real prod schema export; absent from the UAT baseline. */
  @Column({
    name: 's3_flag',
    type: 'tinyint',
    default: 0,
    transformer: tinyintBoolean,
  })
  s3Flag: boolean;
}
