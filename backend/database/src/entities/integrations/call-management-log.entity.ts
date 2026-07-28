import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ApiCallStatus, SerializeApiCallStatus } from './api-call-status';

/**
 * `ADOPT-UNVERIFIED` per docs/SCHEMA-MAP.md — legacy `api_call_campaign_logs`
 * (absent from the UAT dump), real columns known from
 * `CronCallController.php`'s `calllog_insert()` call site. A campaign-level
 * batch call log, not a per-lead one — no lead/user FK column is set
 * anywhere in the legacy insert. `id`/timestamps are inferred (this
 * codebase's universal convention) and NOT independently confirmed;
 * verify against production before cutover.
 */
@Entity('api_call_campaign_logs')
export class CallManagementLog {
  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint', unsigned: true })
  id: number;

  @Column({
    name: 'call_campaign_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  campaignName: string | null;

  @Column({ name: 'call_campaign_method_id', type: 'tinyint', nullable: true })
  methodId: number | null;

  @Column({
    name: 'call_campaign_status_id',
    type: 'mediumint',
    nullable: true,
  })
  @SerializeApiCallStatus()
  status: ApiCallStatus | null;

  @Column({ name: 'call_campaign_request', type: 'text', nullable: true })
  request: string | null;

  @Column({ name: 'call_campaign_response', type: 'text', nullable: true })
  response: string | null;

  @Column({
    name: 'call_campaign_errors',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  errors: string | null;

  @Column({
    name: 'call_campaign_request_datetime',
    type: 'datetime',
    nullable: true,
  })
  requestedAt: Date | null;

  @Column({
    name: 'call_campaign_response_datetime',
    type: 'datetime',
    nullable: true,
  })
  respondedAt: Date | null;
}
