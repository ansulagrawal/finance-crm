import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { tinyintBoolean } from '../column-transformers';

/**
 * Legacy `cif_customer` (Customer Identification File — the cross-lead
 * -application customer master, created/matched by pancard at sanction
 * time; auto-generated `cif_number` format `"FTC" + 8-digit zero-padded
 * sequence`, e.g. `"FTC00000004"`). The table also snapshots ~60 KYC/
 * employment columns at sanction time — not mapped here since
 * `CreditAnalysisMemo`/`LeadCustomer` already keep that data live and
 * normalized per lead; only the cross-reference identity is needed for
 * `Lead.cifCustomer`. `spouseName` is mapped anyway because legacy
 * declares it NOT NULL with no default, so inserts must satisfy it.
 */
@Entity('cif_customer')
export class CifCustomer {
  @PrimaryGeneratedColumn({ name: 'cif_id', type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'cif_number', type: 'varchar', length: 20, nullable: true })
  cifNumber: string | null;

  @Column({ name: 'cif_pancard', type: 'varchar', length: 15, nullable: true })
  pancard: string | null;

  @Column({ name: 'cif_spouse_name', type: 'varchar', length: 100 })
  spouseName: string;

  @Column({
    name: 'cif_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'cif_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;

  /**
   * Confirmed against a real prod schema export (absent from the UAT
   * baseline) and against `TaskController.php:2287`'s
   * `'cif_credeau_approved_customer' => ((!empty($cam->lead_creation_mode)
   * && $cam->lead_creation_mode == 1) ? 1 : NULL)` — set at CIF-creation
   * time when the lead's `lead_creation_mode` is 1.
   */
  @Column({
    name: 'cif_credeau_approved_customer',
    type: 'tinyint',
    nullable: true,
  })
  credeauApprovedCustomer: number | null;
}
