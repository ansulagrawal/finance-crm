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

/** 1=>Request, 2=>Email Sent, 3=>Callback — legacy `avedl_method_id` comment. */
export enum VideoKycMethod {
  REQUEST = 1,
  EMAIL_SENT = 2,
  CALLBACK = 3,
}

/** Legacy `api_video_ekyc_logs` (Signzy ConsenzAI video-KYC session creation). */
@Entity('api_video_ekyc_logs')
export class VideoKycLog {
  @PrimaryGeneratedColumn({ name: 'avedl_id', type: 'bigint' })
  id: number;

  @Column({ name: 'avedl_lead_id', type: 'bigint', unsigned: true })
  leadId: number;

  @ManyToOne(() => Lead, { nullable: false })
  @JoinColumn({ name: 'avedl_lead_id' })
  lead: Lead;

  @Column({
    name: 'avedl_user_id',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  userId: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'avedl_user_id' })
  user: User | null;

  /** 1=>Signzy — legacy comment implies room for more providers. */
  @Column({ name: 'avedl_provider', type: 'tinyint', unsigned: true })
  provider: number;

  @Column({ name: 'avedl_method_id', type: 'tinyint' })
  method: VideoKycMethod;

  @Column({
    name: 'avedl_request_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  requestId: string | null;

  @Column({ name: 'avedl_request', type: 'text', nullable: true })
  request: string | null;

  @Column({ name: 'avedl_response', type: 'text', nullable: true })
  response: string | null;

  @Column({ name: 'avedl_return_url', type: 'text', nullable: true })
  returnUrl: string | null;

  @Column({ name: 'avedl_status_id', type: 'mediumint' })
  @SerializeApiCallStatus()
  status: ApiCallStatus;

  @Column({
    name: 'avedl_errors',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  errors: string | null;

  @Column({ name: 'avedl_request_datetime', type: 'datetime', nullable: true })
  requestedAt: Date | null;

  @Column({ name: 'avedl_response_datetime', type: 'datetime', nullable: true })
  respondedAt: Date | null;

  @Column({ name: 'avedl_active', type: 'tinyint', default: 1 })
  isActive: boolean;

  @Column({ name: 'avedl_deleted', type: 'tinyint', default: 0 })
  isDeleted: boolean;
}
