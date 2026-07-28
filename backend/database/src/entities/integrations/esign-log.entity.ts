import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Lead } from '../leads/lead.entity';
import { User } from '../users/user.entity';
import { ApiCallStatus, SerializeApiCallStatus } from './api-call-status';

/** 1=>Signzy, 2=>DigiTap — legacy `esign_provider` comment. */
export enum EsignProvider {
  SIGNZY = 1,
  DIGITAP = 2,
}

/** 1=>Upload Document, 2=>eSign Request, 3=>Download Docs — legacy `esign_method_id` comment. */
export enum EsignMethod {
  UPLOAD_DOCUMENT = 1,
  ESIGN_REQUEST = 2,
  DOWNLOAD_DOCS = 3,
}

/** 1=>KFS, 2=>Sanction Letter — legacy `esign_type_id` comment. */
export enum EsignDocumentType {
  KFS = 1,
  SANCTION_LETTER = 2,
}

/** Legacy `api_esign_logs` (Signzy/DigiTap contract initiate / aadhaar eSign / download signed document — one row per step). */
@Entity('api_esign_logs')
export class EsignLog {
  @PrimaryGeneratedColumn({ name: 'esign_id', type: 'bigint' })
  id: number;

  @Column({ name: 'esign_lead_id', type: 'bigint', unsigned: true })
  leadId: number;

  @ManyToOne(() => Lead, { nullable: false })
  @JoinColumn({ name: 'esign_lead_id' })
  lead: Lead;

  @Column({
    name: 'esign_user_id',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  userId: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'esign_user_id' })
  user: User | null;

  @Column({ name: 'esign_provider', type: 'tinyint', unsigned: true })
  provider: EsignProvider;

  @Column({ name: 'esign_method_id', type: 'tinyint' })
  method: EsignMethod;

  @Column({
    name: 'esign_type_id',
    type: 'tinyint',
    unsigned: true,
    nullable: true,
  })
  documentType: EsignDocumentType | null;

  @Column({
    name: 'esign_aadhaar_no',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  aadhaarNo: string | null;

  @Column({ name: 'esign_request', type: 'text', nullable: true })
  request: string | null;

  @Column({ name: 'esign_response', type: 'text', nullable: true })
  response: string | null;

  @Column({ name: 'esign_api_status_id', type: 'mediumint' })
  @SerializeApiCallStatus()
  status: ApiCallStatus;

  @Column({
    name: 'esign_errors',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  errors: string | null;

  @Column({
    name: 'esign_return_url',
    type: 'varchar',
    length: 250,
    nullable: true,
  })
  returnUrl: string | null;

  @Column({ name: 's3_flag', type: 'tinyint', unsigned: true, default: 0 })
  isUploadedToS3: boolean;

  @Column({ name: 'esign_request_datetime', type: 'datetime', nullable: true })
  requestedAt: Date | null;

  @Column({ name: 'esign_response_datetime', type: 'datetime', nullable: true })
  respondedAt: Date | null;

  @Column({ name: 'esign_active', type: 'tinyint', default: 1 })
  isActive: boolean;

  @Column({ name: 'esign_deleted', type: 'tinyint', default: 0 })
  isDeleted: boolean;
}
