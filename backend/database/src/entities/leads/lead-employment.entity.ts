import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { numericString, tinyintBoolean } from '../column-transformers';
import { City } from '../geography/city.entity';
import { State } from '../geography/state.entity';
import { Lead } from './lead.entity';

/**
 * Drives which of the employer-specific columns below are meaningful:
 * SALARIED leads populate employerName/designation/department/salaryMode,
 * SELF_EMPLOYED leads populate employerType/serviceTenure instead.
 * Legacy `income_type`: 1=>salaried, 2=>self-employed.
 */
export enum IncomeType {
  SALARIED = 1,
  SELF_EMPLOYED = 2,
}

/** Legacy `customer_employment` (confirmed against a real UAT export). */
@Entity('customer_employment')
export class LeadEmployment {
  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'lead_id', type: 'bigint', unsigned: true })
  leadId: number;

  @OneToOne(() => Lead, { nullable: false })
  @JoinColumn({ name: 'lead_id' })
  lead: Lead;

  @Column({
    name: 'state_id',
    type: 'mediumint',
    unsigned: true,
    nullable: true,
  })
  stateId: number | null;

  @ManyToOne(() => State, { nullable: true })
  @JoinColumn({ name: 'state_id' })
  state: State | null;

  @Column({
    name: 'city_id',
    type: 'mediumint',
    unsigned: true,
    nullable: true,
  })
  cityId: number | null;

  @ManyToOne(() => City, { nullable: true })
  @JoinColumn({ name: 'city_id' })
  city: City | null;

  @Column({
    name: 'income_type',
    type: 'tinyint',
    unsigned: true,
    nullable: true,
  })
  incomeType: IncomeType | null;

  @Column({ name: 'monthly_income', type: 'double', nullable: true })
  monthlyIncome: number | null;

  /** Legacy has two salary-mode columns — `salary_mode` is the one read
   * elsewhere; `emp_salary_mode` is used as a fallback where `salary_mode`
   * is blank (see `migrate-legacy/migrate-leads.ts`). */
  @Column({ name: 'salary_mode', type: 'varchar', length: 100, nullable: true })
  salaryMode: string | null;

  @Column({
    name: 'emp_salary_mode',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  legacySalaryMode: string | null;

  @Column({
    name: 'employer_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  employerName: string | null;

  @Column({
    name: 'emp_designation',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  designation: string | null;

  @Column({
    name: 'emp_department',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  department: string | null;

  @Column({
    name: 'emp_employer_type',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  employerType: string | null;

  @Column({ name: 'emp_house', type: 'varchar', length: 500, nullable: true })
  addressLine1: string | null;

  @Column({ name: 'emp_street', type: 'varchar', length: 255, nullable: true })
  addressLine2: string | null;

  @Column({
    name: 'emp_landmark',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  landmark: string | null;

  @Column({
    name: 'emp_pincode',
    type: 'int',
    unsigned: true,
    nullable: true,
    transformer: numericString,
  })
  pincode: string | null;

  @Column({ name: 'emp_residence_since', type: 'date', nullable: true })
  residenceSince: string | null;

  @Column({
    name: 'presentServiceTenure',
    type: 'varchar',
    length: 40,
    nullable: true,
  })
  serviceTenure: string | null;

  @Column({ name: 'created_on', type: 'datetime', nullable: true })
  createdAt: Date | null;

  @Column({ name: 'updated_on', type: 'datetime', nullable: true })
  updatedAt: Date | null;

  @Column({
    name: 'emp_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'emp_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
