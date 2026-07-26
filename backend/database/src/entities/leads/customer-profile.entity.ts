import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Legacy `customer_profile` (80 columns) — the customer-facing app/website
 * self-registration profile, out of this project's CRM scope (see
 * `CLAUDE.md`: the customer-facing `api/` install is explicitly excluded).
 * Only mapped here because the in-scope CRM code (`Task_Model.php`, joined
 * via `leads.lead_customer_profile_id -> customer_profile.cp_id`) reads
 * exactly one column off it, `cp_spouse_mobile` — everything else (device
 * ids, UTM tracking, journey stage, app-source, etc.) is deliberately left
 * unmapped, same reduced-scope convention as `CifCustomer`.
 */
@Entity('customer_profile')
export class CustomerProfile {
  @PrimaryGeneratedColumn({ name: 'cp_id', type: 'bigint' })
  id: number;

  @Column({
    name: 'cp_spouse_mobile',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  spouseMobile: number | null;
}
