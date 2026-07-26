import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { tinyintBoolean } from '../column-transformers';

/** 1=>only IMPS, 2=>Only NEFT, 3=>Both — legacy `disb_bank_payment_type_id` comment. */
export enum DisbursementBankPaymentType {
  IMPS_ONLY = 1,
  NEFT_ONLY = 2,
  BOTH = 3,
}

/** Legacy `master_disbursement_banks` (confirmed against a real UAT export, 5 rows). */
@Entity('master_disbursement_banks')
export class DisbursementBank {
  @PrimaryGeneratedColumn({
    name: 'disb_bank_id',
    type: 'mediumint',
    unsigned: true,
  })
  id: number;

  @Column({ name: 'disb_bank_name', type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'disb_bank_account_no', type: 'varchar', length: 20 })
  accountNumber: string;

  @Column({
    name: 'disb_bank_payment_type_id',
    type: 'tinyint',
    unsigned: true,
    default: DisbursementBankPaymentType.IMPS_ONLY,
  })
  paymentType: DisbursementBankPaymentType;

  @Column({
    name: 'disb_bank_imps_api_active',
    type: 'tinyint',
    default: 0,
    transformer: tinyintBoolean,
  })
  isImpsEnabled: boolean;

  @Column({
    name: 'disb_bank_neft_api_active',
    type: 'tinyint',
    default: 0,
    transformer: tinyintBoolean,
  })
  isNeftEnabled: boolean;

  @Column({ name: 'disb_bank_created_by', type: 'int', unsigned: true })
  createdById: number;

  @Column({ name: 'disb_bank_created_on', type: 'datetime' })
  createdAt: Date;

  @Column({
    name: 'disb_bank_updated_by',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  updatedById: number | null;

  @Column({ name: 'disb_bank_updated_on', type: 'datetime', nullable: true })
  updatedAt: Date | null;

  @Column({
    name: 'disb_bank_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'disb_bank_deleted',
    type: 'tinyint',
    unsigned: true,
    nullable: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
