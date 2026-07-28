import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { tinyintBoolean } from '../column-transformers';
import { Lead } from '../leads/lead.entity';
import { User } from '../users/user.entity';
import { ApiCallStatus, SerializeApiCallStatus } from './api-call-status';

/**
 * 1=>Surepass, 2=>DigiTap, 3=>Signzy — real prod `poi_veri_provider` column
 * comment, confirmed against live prod log rows (2026-08-04): every real
 * row is provider 3, and its request/response shape (`panNumber`+
 * `getStatusInfo`, `result.panStatusCode`/`isValid`/`aadhaarLinked`) matches
 * the legacy PHP `TaskController::request-repay-otp`-adjacent PAN-extensive
 * call that's hardcoded to `sendCurl_request($requestData, 'panextensive',
 * 'Signzy')`. Surepass is wired as an automatic failover for PAN
 * verification when Signzy is down (client-confirmed) but no real logged
 * rows with provider 1 were available to verify against.
 */
export enum PoiVerificationProvider {
  SUREPASS = 1,
  DIGITAP = 2,
  SIGNZY = 3,
}

/**
 * Legacy `api_poi_verification_logs` — covers both proof-of-identity
 * verification (Signzy PAN fetch) and the OCR variants (PAN/Aadhaar OCR),
 * distinguished by `poi_veri_method_id` — legacy does not split these into
 * separate physical tables.
 */
@Entity('api_poi_verification_logs')
export class PoiVerificationLog {
  @PrimaryGeneratedColumn({ name: 'poi_veri_id', type: 'bigint' })
  id: number;

  @Column({ name: 'poi_veri_lead_id', type: 'bigint', unsigned: true })
  leadId: number;

  @ManyToOne(() => Lead, { nullable: false })
  @JoinColumn({ name: 'poi_veri_lead_id' })
  lead: Lead;

  @Column({
    name: 'poi_veri_user_id',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  userId: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'poi_veri_user_id' })
  user: User | null;

  @Column({ name: 'poi_veri_provider', type: 'tinyint', unsigned: true })
  provider: PoiVerificationProvider;

  /** 1=>PAN FETCH — legacy `poi_veri_method_id` comment. */
  @Column({ name: 'poi_veri_method_id', type: 'tinyint' })
  method: number;

  @Column({
    name: 'poi_veri_proof_no',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  proofNo: string | null;

  @Column({
    name: 'poi_veri_father_name',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  fatherName: string | null;

  @Column({
    name: 'poi_veri_profile_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  profileId: number | null;

  /** 1=>Other Pan Card — legacy `poi_other_pan_veri_flag` comment. */
  @Column({
    name: 'poi_other_pan_veri_flag',
    type: 'tinyint',
    unsigned: true,
    nullable: true,
    transformer: tinyintBoolean,
  })
  isOtherPancard: boolean;

  @Column({ name: 'poi_veri_request', type: 'text', nullable: true })
  request: string | null;

  @Column({ name: 'poi_veri_response', type: 'text', nullable: true })
  response: string | null;

  @Column({ name: 'poi_veri_api_status_id', type: 'mediumint' })
  @SerializeApiCallStatus()
  status: ApiCallStatus;

  @Column({
    name: 'poi_veri_errors',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  errors: string | null;

  @Column({
    name: 'poi_veri_request_datetime',
    type: 'datetime',
    nullable: true,
  })
  requestedAt: Date | null;

  @Column({
    name: 'poi_veri_response_datetime',
    type: 'datetime',
    nullable: true,
  })
  respondedAt: Date | null;

  @Column({ name: 'poi_veri_active', type: 'tinyint', default: 1 })
  isActive: boolean;

  @Column({ name: 'poi_veri_deleted', type: 'tinyint', default: 0 })
  isDeleted: boolean;

  /** Both confirmed against a real prod schema export; absent from the UAT baseline. */
  @Column({ name: 'poi_veri_dual_response', type: 'text', nullable: true })
  dualResponse: string | null;

  @Column({
    name: 'poi_http_code',
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  httpCode: string | null;
}
