import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { tinyintBoolean } from '../column-transformers';
import { Lead } from '../leads/lead.entity';
import { User } from '../users/user.entity';

type YesNo = 'YES' | 'NO';

/** 1=pending, 2=positive, 3=negative — legacy `office_residence_status`/`office_report_status` comment. */
export type FieldVerificationReportStatus = '1' | '2' | '3';

/**
 * Legacy `tbl_verification` (confirmed against a real UAT export) — ONE row
 * per lead, with residence and office verification columns side by side on
 * the same row (legacy's own physical shape; not unpivoted into separate
 * visit rows here). One of the four legacy tables with no primary key —
 * `verify_id` is already unique/auto-increment-shaped, so the additive
 * migration adds one on it (see docs/SCHEMA-MAP.md). `@PrimaryGeneratedColumn`
 * (not `@PrimaryColumn`) so TypeORM reads the auto-incremented value back
 * onto the entity after `save()` — needed since a new row is created without
 * an id known up front (see field-verification.service.ts).
 */
@Entity('tbl_verification')
export class FieldVerificationVisit {
  @PrimaryGeneratedColumn({ name: 'verify_id', type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'lead_id', type: 'bigint', unsigned: true })
  leadId: number;

  @ManyToOne(() => Lead, { nullable: false })
  @JoinColumn({ name: 'lead_id' })
  lead: Lead;

  @Column({
    name: 'mobile_verified',
    type: 'enum',
    enum: ['NO', 'YES'],
    nullable: true,
    default: 'NO',
  })
  mobileVerified: YesNo | null;

  @Column({
    name: 'alternate_mobile_verified',
    type: 'enum',
    enum: ['NO', 'YES'],
    nullable: true,
    default: 'NO',
  })
  alternateMobileVerified: YesNo | null;

  @Column({
    name: 'office_email_verification_send_on',
    type: 'enum',
    enum: ['NO', 'YES'],
    nullable: true,
    default: 'NO',
  })
  officeEmailVerificationSentOn: YesNo | null;

  @Column({
    name: 'office_email_verified_on',
    type: 'datetime',
    nullable: true,
  })
  officeEmailVerifiedOn: Date | null;

  @Column({
    name: 'pan_verified',
    type: 'enum',
    enum: ['NO', 'YES'],
    nullable: true,
    default: 'NO',
  })
  panVerified: YesNo | null;

  @Column({
    name: 'aadhar_verified',
    type: 'enum',
    enum: ['NO', 'YES'],
    nullable: true,
    default: 'NO',
  })
  aadhaarVerified: YesNo | null;

  @Column({
    name: 'bank_statement_verified',
    type: 'enum',
    enum: ['NO', 'YES'],
    nullable: true,
    default: 'NO',
  })
  bankStatementVerified: YesNo | null;

  @Column({
    name: 'app_download_on',
    type: 'enum',
    enum: ['NO', 'YES'],
    nullable: true,
    default: 'NO',
  })
  appDownloadedOn: YesNo | null;

  @Column({
    name: 'digital_kyc_verified',
    type: 'enum',
    enum: ['NO', 'YES'],
    nullable: true,
    default: 'NO',
  })
  digitalKycVerified: YesNo | null;

  @Column({
    name: 'init_office_email_verification',
    type: 'enum',
    enum: ['NO', 'YES'],
    nullable: true,
    default: 'NO',
  })
  officeEmailVerificationInitiated: YesNo | null;

  @Column({
    name: 'init_mobile_verification',
    type: 'enum',
    enum: ['NO', 'YES'],
    nullable: true,
    default: 'NO',
  })
  mobileVerificationInitiated: YesNo | null;

  @Column({ name: 'mobile_otp', type: 'varchar', length: 20, nullable: true })
  mobileOtp: string | null;

  @Column({
    name: 'init_residence_cpv',
    type: 'enum',
    enum: ['NO', 'YES'],
    nullable: true,
    default: 'NO',
  })
  residenceCpvInitiated: YesNo | null;

  @Column({
    name: 'residece_cpv_allocated_to',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  residenceCpvAllocatedToId: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'residece_cpv_allocated_to' })
  residenceCpvAllocatedTo: User | null;

  @Column({
    name: 'residence_cpv_allocated_on',
    type: 'datetime',
    nullable: true,
  })
  residenceCpvAllocatedOn: Date | null;

  @Column({
    name: 'init_office_cpv',
    type: 'enum',
    enum: ['NO', 'YES'],
    nullable: true,
  })
  officeCpvInitiated: YesNo | null;

  @Column({
    name: 'office_cpv_allocated_to',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  officeCpvAllocatedToId: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'office_cpv_allocated_to' })
  officeCpvAllocatedTo: User | null;

  @Column({ name: 'office_cvp_allocated_on', type: 'datetime', nullable: true })
  officeCpvAllocatedOn: Date | null;

  @Column({
    name: 'visit_requested_by',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  visitRequestedById: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'visit_requested_by' })
  visitRequestedBy: User | null;

  @Column({ name: 'visit_requested_on', type: 'datetime', nullable: true })
  visitRequestedOn: Date | null;

  // --- Residence verification ---

  @Column({ name: 'residence_initiated_on', type: 'datetime', nullable: true })
  residenceInitiatedOn: Date | null;

  @Column({ name: 'received_on', type: 'datetime', nullable: true })
  residenceReceivedOn: Date | null;

  @Column({
    name: 'met_with',
    type: 'varchar',
    length: 100,
    nullable: true,
    default: '-',
  })
  residenceMetWith: string | null;

  @Column({ name: 'relation', type: 'varchar', length: 100, nullable: true })
  residenceRelation: string | null;

  @Column({
    name: 'res_employer_name',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  residenceEmployerName: string | null;

  @Column({
    name: 'residence_type',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  residenceType: string | null;

  @Column({
    name: 'office_residence_house_type',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  residenceHouseType: string | null;

  @Column({
    name: 'office_residence_ease_of_identification',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  residenceEaseOfIdentification: string | null;

  @Column({
    name: 'office_residence_locality',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  residenceLocality: string | null;

  @Column({
    name: 'office_residence_residing_since',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  residenceResidingSince: string | null;

  @Column({
    name: 'office_residence_total_members_in_family',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  residenceTotalMembersInFamily: string | null;

  @Column({
    name: 'office_residence_earn_ng_members_in_family',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  residenceEarningMembersInFamily: string | null;

  @Column({
    name: 'office_residence_living_standard',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  residenceLivingStandard: string | null;

  @Column({
    name: 'office_residence_neighbour_check',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  residenceNeighbourCheck: string | null;

  @Column({
    name: 'office_residence_geo_cordinates',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  residenceGeoCoordinates: string | null;

  @Column({
    name: 'office_residence_visit_on',
    type: 'datetime',
    nullable: true,
  })
  residenceVisitedOn: Date | null;

  @Column({ name: 'office_residence_remarks', type: 'text' })
  residenceRemarks: string;

  @Column({
    name: 'office_residence_document_verified',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  residenceDocumentVerified: string | null;

  @Column({
    name: 'office_residence_photo',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  residencePhotoFileKey: string | null;

  @Column({
    name: 'office_residence_status',
    type: 'varchar',
    length: 255,
    nullable: true,
    default: '1',
  })
  residenceReportStatus: FieldVerificationReportStatus | null;

  // --- Office verification ---

  @Column({ name: 'office_initiated_on', type: 'datetime', nullable: true })
  officeInitiatedOn: Date | null;

  @Column({ name: 'office_received_on', type: 'datetime', nullable: true })
  officeReceivedOn: Date | null;

  @Column({
    name: 'office_met_with',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  officeMetWith: string | null;

  @Column({
    name: 'office_relation',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  officeRelation: string | null;

  @Column({
    name: 'office_entry_allowed',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  officeEntryAllowed: string | null;

  @Column({
    name: 'office_employer_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  officeEmployerName: string | null;

  @Column({
    name: 'office_company_signboard_sighted',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  officeCompanySignboardSighted: string | null;

  @Column({
    name: 'office_locality',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  officeLocality: string | null;

  @Column({
    name: 'office_no_of_staff_sighted',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  officeNoOfStaffSighted: string | null;

  @Column({
    name: 'office_employee_strength',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  officeEmployeeStrength: string | null;

  @Column({
    name: 'office_employed_since',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  officeEmployedSince: string | null;

  @Column({
    name: 'office_geo_cordinates',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  officeGeoCoordinates: string | null;

  @Column({ name: 'office_visit_on', type: 'datetime', nullable: true })
  officeVisitedOn: Date | null;

  @Column({
    name: 'office_remarks',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  officeRemarks: string | null;

  @Column({
    name: 'office_document_verified',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  officeDocumentVerified: string | null;

  @Column({ name: 'office_photo_of_office', type: 'text', nullable: true })
  officePhotoFileKey: string | null;

  @Column({
    name: 'office_report_status',
    type: 'varchar',
    length: 255,
    nullable: true,
    default: '1',
  })
  officeReportStatus: FieldVerificationReportStatus | null;

  @Column({ name: 'office_comp_type', type: 'int', nullable: true })
  officeCompanyType: number | null;

  @Column({ name: 'office_col_status', type: 'int', nullable: true })
  officeCollectionStatus: number | null;

  // --- GPS trail (never actually populated in legacy — no format to match) ---

  @Column({
    name: 'lead_office_start_lat',
    type: 'varchar',
    length: 45,
    nullable: true,
  })
  officeStartLatitude: string | null;

  @Column({
    name: 'lead_office_start_lang',
    type: 'varchar',
    length: 45,
    nullable: true,
  })
  officeStartLongitude: string | null;

  @Column({
    name: 'lead_office_end_lat',
    type: 'varchar',
    length: 45,
    nullable: true,
  })
  officeEndLatitude: string | null;

  @Column({
    name: 'lead_office_end_lang',
    type: 'varchar',
    length: 45,
    nullable: true,
  })
  officeEndLongitude: string | null;

  @Column({
    name: 'lead_res_start_lat',
    type: 'varchar',
    length: 45,
    nullable: true,
  })
  residenceStartLatitude: string | null;

  @Column({
    name: 'lead_res_start_lang',
    type: 'varchar',
    length: 45,
    nullable: true,
  })
  residenceStartLongitude: string | null;

  @Column({
    name: 'lead_res_end_lat',
    type: 'varchar',
    length: 45,
    nullable: true,
  })
  residenceEndLatitude: string | null;

  @Column({
    name: 'lead_res_end_lang',
    type: 'varchar',
    length: 45,
    nullable: true,
  })
  residenceEndLongitude: string | null;

  @Column({
    name: 'verify_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'verify_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
