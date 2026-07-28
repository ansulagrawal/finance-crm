import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Lead } from '../leads/lead.entity';

/**
 * `ADOPT-UNVERIFIED` per docs/SCHEMA-MAP.md — legacy `api_callback_video_ekyc`
 * (absent from the UAT dump), real columns (`acvk_` prefix) confirmed from
 * `VideoKYCController::insertCallbackData()` — the async Signzy ConsenzAI
 * video-KYC verdict callback, a physically separate table from
 * `api_video_ekyc_logs` (`VideoKycLog`, the outbound session-creation log).
 * `acvk_id` is inferred (this codebase's universal PK convention) and NOT
 * independently confirmed; verify against production before cutover.
 */
@Entity('api_callback_video_ekyc')
export class VideoKycCallbackLog {
  @PrimaryGeneratedColumn({ name: 'acvk_id', type: 'bigint', unsigned: true })
  id: number;

  @Column({
    name: 'acvk_lead_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  leadId: number | null;

  @ManyToOne(() => Lead, { nullable: true })
  @JoinColumn({ name: 'acvk_lead_id' })
  lead: Lead | null;

  /** 1=>Request — legacy `acvk_method_id` (single value seen in the real insert). */
  @Column({ name: 'acvk_method_id', type: 'tinyint' })
  method: number;

  @Column({ name: 'acvk_request_id', type: 'varchar', length: 255 })
  requestId: string;

  @Column({ name: 'acvk_response', type: 'text' })
  response: string;

  /** Legacy stores the vendor's raw status string here, not a numeric code. */
  @Column({ name: 'acvk_status', type: 'varchar', length: 50 })
  status: string;

  @Column({ name: 'acvk_errors', type: 'varchar', length: 500, nullable: true })
  errors: string | null;

  @Column({ name: 'acvk_response_datetime', type: 'datetime' })
  respondedAt: Date;
}
