import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { tinyintBoolean } from '../column-transformers';

/**
 * Legacy `master_sms_template`. `m_st_type_id` carries the DB comment
 * `1=>collection` (`legacy-schema.sql:2954`) — it is the template catalog
 * `Collection_Model::get_sms_template_lists()`/`get_sms_template_content()`
 * query for the collection followup SMS picker (`CollectionController::
 * get_followup_template_lists()`), filtered to `m_st_type_id=1`. This is
 * unrelated to OTP delivery, which is `SmsLog.smsTypeId`'s meaning on the
 * separate `api_sms_logs` table — an earlier version of this doc comment
 * conflated the two. `legacy-schema.sql` is a schema-only dump (no
 * `INSERT INTO` rows anywhere), so no real template content is seeded here;
 * see `docs/TODO.md`.
 */
@Entity('master_sms_template')
export class SmsTemplate {
  @PrimaryGeneratedColumn({ name: 'm_st_id', type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'm_st_provider', type: 'tinyint', nullable: true })
  provider: number | null;

  /** 1=>collection — legacy `m_st_type_id` comment. */
  @Column({ name: 'm_st_type_id', type: 'tinyint', unsigned: true, default: 0 })
  typeId: number;

  /** DLT-registered template id (India TRAI regulatory requirement for
   * transactional/promotional SMS) — vendor-assigned, not ours to change. */
  @Column({ name: 'm_st_template_id', type: 'varchar', length: 50 })
  templateId: string;

  /** Sender id / DLT header id (e.g. "acme"). */
  @Column({ name: 'm_st_template_source', type: 'varchar', length: 250 })
  templateSource: string;

  @Column({
    name: 'm_st_description',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  description: string | null;

  /** Raw content with `{{placeholder}}` tokens, e.g. `{{otp}}`. */
  @Column({ name: 'm_st_content', type: 'text' })
  content: string;

  @Column({ name: 'm_st_variables_count', type: 'tinyint', default: 0 })
  variablesCount: number;

  @Column({ name: 'm_st_created_on', type: 'datetime' })
  createdAt: Date;

  @Column({
    name: 'm_st_active',
    type: 'tinyint',
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'm_st_deleted',
    type: 'tinyint',
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
