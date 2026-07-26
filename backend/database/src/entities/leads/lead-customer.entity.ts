import {
  BeforeInsert,
  BeforeUpdate,
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
import { MaritalStatus } from './marital-status.entity';
import { Occupation } from './occupation.entity';
import { Qualification } from './qualification.entity';
import { Religion } from './religion.entity';

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
}

/**
 * Legacy `lead_customer` (98 columns, SPLIT with `Lead`/`LeadEmployment` per
 * docs/SCHEMA-MAP.md). Only the columns `migrate-legacy/migrate-leads.ts`
 * already proved are read elsewhere in the codebase are mapped; the rest of
 * legacy's ~90 columns (office/aadhaar address blocks, eKYC/UAN/eNACH/Credeau
 * flags, etc.) are left unmapped rather than guessed at.
 */
@Entity('lead_customer')
export class LeadCustomer {
  @PrimaryGeneratedColumn({
    name: 'customer_seq_id',
    type: 'bigint',
    unsigned: true,
  })
  id: number;

  @Column({ name: 'customer_lead_id', type: 'bigint', unsigned: true })
  leadId: number;

  @OneToOne(() => Lead, { nullable: false })
  @JoinColumn({ name: 'customer_lead_id' })
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

  @Column({ name: 'city_id', type: 'int', unsigned: true, nullable: true })
  cityId: number | null;

  @ManyToOne(() => City, { nullable: true })
  @JoinColumn({ name: 'city_id' })
  city: City | null;

  @Column({
    name: 'customer_marital_status_id',
    type: 'mediumint',
    unsigned: true,
    nullable: true,
  })
  maritalStatusId: number | null;

  @ManyToOne(() => MaritalStatus, { nullable: true })
  @JoinColumn({ name: 'customer_marital_status_id' })
  maritalStatus: MaritalStatus | null;

  @Column({
    name: 'customer_qualification_id',
    type: 'mediumint',
    unsigned: true,
    nullable: true,
  })
  qualificationId: number | null;

  @ManyToOne(() => Qualification, { nullable: true })
  @JoinColumn({ name: 'customer_qualification_id' })
  qualification: Qualification | null;

  @Column({
    name: 'customer_religion_id',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  religionId: number | null;

  @ManyToOne(() => Religion, { nullable: true })
  @JoinColumn({ name: 'customer_religion_id' })
  religion: Religion | null;

  @Column({
    name: 'customer_spouse_occupation_id',
    type: 'mediumint',
    unsigned: true,
    nullable: true,
  })
  spouseOccupationId: number | null;

  @ManyToOne(() => Occupation, { nullable: true })
  @JoinColumn({ name: 'customer_spouse_occupation_id' })
  spouseOccupation: Occupation | null;

  @Column({ name: 'first_name', type: 'varchar', length: 100, nullable: true })
  firstName: string | null;

  @Column({ name: 'middle_name', type: 'varchar', length: 100, nullable: true })
  middleName: string | null;

  @Column({ name: 'sur_name', type: 'varchar', length: 100, nullable: true })
  surName: string | null;

  @Column({ name: 'father_name', type: 'varchar', length: 50, nullable: true })
  fatherName: string | null;

  @Column({ name: 'gender', type: 'enum', enum: Gender, nullable: true })
  gender: Gender | null;

  @Column({ name: 'dob', type: 'date', nullable: true })
  dob: string | null;

  @Column({ name: 'mobile', type: 'varchar', length: 20, nullable: true })
  mobile: string | null;

  @Column({
    name: 'alternate_mobile',
    type: 'bigint',
    unsigned: true,
    nullable: true,
    transformer: numericString,
  })
  alternateMobile: string | null;

  @Column({ name: 'email', type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({
    name: 'alternate_email',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  alternateEmail: string | null;

  @Column({ name: 'pancard', type: 'varchar', length: 15, nullable: true })
  pancard: string | null;

  @Column({ name: 'aadhar_no', type: 'varchar', length: 20, nullable: true })
  aadhaarNumber: string | null;

  @Column({
    name: 'pancard_verified_status',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isPancardVerified: boolean;

  @Column({
    name: 'aadhaar_ocr_verified_status',
    type: 'tinyint',
    unsigned: true,
    nullable: true,
    transformer: tinyintBoolean,
  })
  isAadhaarVerified: boolean;

  /**
   * `"<lat>,<long>"`, set by `payday_reverse_geo_code.php`'s
   * `address_to_lat_long` when `address_type==2` — a different function
   * from the coords-to-address flow `ReverseGeocodeService` ports today
   * (see `docs/TODO.md`, that address->coordinates direction isn't ported
   * yet). Widened 50->255 chars in prod vs the UAT baseline.
   */
  @Column({
    name: 'aa_aadhaar_address_coordinates',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  aaAadhaarAddressCoordinates: string | null;

  /** Set by `payday_aadhaar_digilocker_api.php` from the eKYC XML's address block. */
  @Column({
    name: 'aa_current_eaadhaar_address',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  aaCurrentEaadhaarAddress: string | null;

  /**
   * The structured Aadhaar-address block `CAMController::
   * savePaydayCAMDetails()` requires (house/locality/city/state/pincode) —
   * distinct from `aaCurrentEaadhaarAddress` (a single raw string from the
   * eKYC XML) and `aaAadhaarAddressCoordinates` (a lat/long pair). Real
   * legacy `lead_customer` columns, confirmed against `legacy-schema.sql`
   * — not an additive change, just previously left unmapped (see
   * `docs/TODO.md`'s history on this).
   */
  @Column({
    name: 'aa_current_house',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  aaAddressLine1: string | null;

  @Column({
    name: 'aa_current_locality',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  aaAddressLine2: string | null;

  @Column({
    name: 'aa_current_landmark',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  aaLandmark: string | null;

  @Column({
    name: 'aa_cr_residence_pincode',
    type: 'mediumint',
    unsigned: true,
    nullable: true,
    transformer: numericString,
  })
  aaPincode: string | null;

  @Column({
    name: 'aa_current_state_id',
    type: 'mediumint',
    unsigned: true,
    nullable: true,
  })
  aaStateId: number | null;

  @ManyToOne(() => State, { nullable: true })
  @JoinColumn({ name: 'aa_current_state_id' })
  aaState: State | null;

  @Column({
    name: 'aa_current_city_id',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  aaCityId: number | null;

  @ManyToOne(() => City, { nullable: true })
  @JoinColumn({ name: 'aa_current_city_id' })
  aaCity: City | null;

  /** `'YES'`/`'NO'`/null, not a tinyint flag — legacy stores verification
   * status as a string here, unlike `pancard_verified_status`. */
  @Column({
    name: 'email_verified_status',
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  emailVerifiedStatus: string | null;

  @Column({
    name: 'mobile_verified_status',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  mobileVerifiedStatus: string | null;

  @Column({
    name: 'customer_face_match_flag',
    type: 'tinyint',
    nullable: true,
    transformer: tinyintBoolean,
  })
  isFaceMatchVerified: boolean;

  @Column({
    name: 'customer_face_match_percentage',
    type: 'varchar',
    length: 5,
    nullable: true,
  })
  faceMatchPercentage: string | null;

  @Column({
    name: 'current_house',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  currentAddressLine1: string | null;

  @Column({
    name: 'current_locality',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  currentAddressLine2: string | null;

  @Column({
    name: 'current_landmark',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  currentLandmark: string | null;

  @Column({
    name: 'current_residence_type',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  currentResidenceType: string | null;

  @Column({
    name: 'current_residence_since',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  currentResidenceSince: string | null;

  @Column({
    name: 'cr_residence_pincode',
    type: 'mediumint',
    unsigned: true,
    nullable: true,
    transformer: numericString,
  })
  pincode: string | null;

  @Column({
    name: 'customer_spouse_name',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  spouseName: string | null;

  /** No column in `lead_customer` for this — legacy only stores it in the
   * app-server-owned `customer_profile` table (joined via
   * `leads.lead_customer_profile_id`), which this rewrite doesn't adopt.
   * Added by the additive migration so the CRM can capture/show it directly. */
  @Column({
    name: 'spouse_mobile',
    type: 'varchar',
    length: 15,
    nullable: true,
  })
  spouseMobile: string | null;

  @Column({
    name: 'customer_current_aadhaar_residence_distance',
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  residenceDistanceKm: string | null;

  @Column({
    name: 'customer_vkyc_flag',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  vkycFlag: boolean;

  @Column({
    name: 'customer_vkyc_completed_on',
    type: 'datetime',
    nullable: true,
  })
  vkycCompletedOn: Date | null;

  @Column({ name: 'created_date', type: 'datetime' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'datetime', nullable: true })
  updatedAt: Date | null;

  @Column({
    name: 'customer_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'customer_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;

  /** Stored lowercase always, regardless of caller — see `User.normalizeEmail`. */
  @BeforeInsert()
  @BeforeUpdate()
  normalizeEmail(): void {
    this.email = this.email?.toLowerCase() ?? this.email;
    this.alternateEmail =
      this.alternateEmail?.toLowerCase() ?? this.alternateEmail;
  }
}
