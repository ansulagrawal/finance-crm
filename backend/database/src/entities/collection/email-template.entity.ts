import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { tinyintBoolean } from '../column-transformers';

/**
 * Legacy `master_email_template` — the email counterpart to `SmsTemplate`
 * (`master_sms_template`), read by `Collection_Model::get_email_template_
 * lists()`/`get_email_template_content()` for the collection followup email
 * picker (`CollectionController::get_followup_template_lists()`), filtered
 * to `m_et_type_id=1`.
 *
 * **Schema inferred from PHP, not confirmed against a dump**: unlike every
 * other entity in this codebase, no `CREATE TABLE` for this table exists
 * anywhere on disk (`database/legacy-baseline/legacy-schema.sql`,
 * `prod_finance-crm.sql`) — it's explicitly listed as a known gap in
 * `database/legacy-baseline/README.md`. Column names/types below are
 * reconstructed from `Collection_Model.php`'s own `SELECT`/`str_replace`
 * calls (`m_et_id, m_et_type_id, m_et_title, m_et_description, m_et_content,
 * m_et_active, m_et_deleted`) — lengths and nullability are best-effort
 * guesses matching `SmsTemplate`'s sibling columns, not verified legacy
 * values. Content merge fields observed in the PHP: `{#LOAN_NO#}`,
 * `{#CUSTOMER_NAME#}`, `{#REPAY_AMOUNT#}`, `{#REPAY_DATE#}`,
 * `{#PAYMENT_LINK#}`. No rows are seeded anywhere in this environment; see
 * `docs/TODO.md`.
 */
@Entity('master_email_template')
export class EmailTemplate {
  @PrimaryGeneratedColumn({ name: 'm_et_id', type: 'int', unsigned: true })
  id: number;

  /** 1=>collection — same convention as `SmsTemplate.typeId`. */
  @Column({ name: 'm_et_type_id', type: 'tinyint', unsigned: true, default: 0 })
  typeId: number;

  @Column({ name: 'm_et_title', type: 'varchar', length: 250 })
  title: string;

  @Column({
    name: 'm_et_description',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  description: string | null;

  /** Raw content with `{#PLACEHOLDER#}` tokens, e.g. `{#LOAN_NO#}`. */
  @Column({ name: 'm_et_content', type: 'text' })
  content: string;

  @Column({
    name: 'm_et_active',
    type: 'tinyint',
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'm_et_deleted',
    type: 'tinyint',
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
