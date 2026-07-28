import { Column, Entity, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { tinyintBoolean } from '../column-transformers';
import { Lead } from '../leads/lead.entity';
import { ApiCallStatus, SerializeApiCallStatus } from './api-call-status';

/** Legacy logs UAN verification calls into the generic `customer_api_data`
 * table (shared across several one-off API calls, not UAN-specific) — this
 * gives it a dedicated table instead, since it's a named sub-integration
 * here and deserves to be queryable on its own. Vendor: Signzy
 * `v3/api/advance-employment-verification`. */
@Entity('uan_verification_logs')
export class UanVerificationLog extends BaseEntity {
  @ManyToOne(() => Lead)
  lead: Lead;

  @Column({ type: 'varchar', length: 20, nullable: true })
  pancard: string | null;

  @Column({ type: 'text', nullable: true })
  request: string | null;

  @Column({ type: 'longtext', nullable: true })
  response: string | null;

  @Column({ type: 'tinyint', default: 0, transformer: tinyintBoolean })
  uanFound: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  uanNumbers: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  employerName: string | null;

  @Column({ type: 'enum', enum: ApiCallStatus, default: ApiCallStatus.PENDING })
  @SerializeApiCallStatus()
  status: ApiCallStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  errors: string | null;

  @Column({ type: 'datetime', nullable: true })
  requestedAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  respondedAt: Date | null;
}
