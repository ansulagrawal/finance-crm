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

/** Legacy `api_face_match_logs` (Signzy selfie-vs-ID-photo face match). */
@Entity('api_face_match_logs')
export class FaceMatchLog {
  @PrimaryGeneratedColumn({ name: 'fm_id', type: 'bigint' })
  id: number;

  @Column({ name: 'fm_lead_id', type: 'bigint', unsigned: true })
  leadId: number;

  @ManyToOne(() => Lead, { nullable: false })
  @JoinColumn({ name: 'fm_lead_id' })
  lead: Lead;

  @Column({ name: 'fm_user_id', type: 'int', unsigned: true, nullable: true })
  userId: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'fm_user_id' })
  user: User | null;

  /** 1=>Signzy — legacy comment implies room for more providers. */
  @Column({ name: 'fm_provider', type: 'tinyint', unsigned: true })
  provider: number;

  /** 1=>Verify Face Match — legacy `fm_method_id` comment. */
  @Column({ name: 'fm_method_id', type: 'tinyint' })
  method: number;

  @Column({ name: 'fm_score', type: 'varchar', length: 255, nullable: true })
  matchPercentage: string | null;

  @Column({ name: 'fm_request', type: 'text', nullable: true })
  request: string | null;

  @Column({ name: 'fm_response', type: 'text', nullable: true })
  response: string | null;

  @Column({ name: 'fm_api_status_id', type: 'mediumint' })
  @SerializeApiCallStatus()
  status: ApiCallStatus;

  @Column({ name: 'fm_errors', type: 'varchar', length: 500, nullable: true })
  errors: string | null;

  @Column({ name: 'fm_request_datetime', type: 'datetime', nullable: true })
  requestedAt: Date | null;

  @Column({ name: 'fm_response_datetime', type: 'datetime', nullable: true })
  respondedAt: Date | null;

  @Column({ name: 'fm_active', type: 'tinyint', default: 1 })
  isActive: boolean;

  @Column({ name: 'fm_deleted', type: 'tinyint', default: 0 })
  isDeleted: boolean;
}
