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
import { DocumentType } from './document-type.entity';

/**
 * Legacy `docs` (confirmed against a real UAT export). Only the columns
 * `migrate-legacy/migrate-verification-feedback.ts` already proved matter
 * are mapped; legacy's application_no/pancard/mobile snapshot columns
 * duplicate data already live on `Lead` and are left unmapped.
 */
@Entity('docs')
export class Document {
  @PrimaryGeneratedColumn({ name: 'docs_id', type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'lead_id', type: 'bigint', unsigned: true })
  leadId: number;

  @ManyToOne(() => Lead, { nullable: false })
  @JoinColumn({ name: 'lead_id' })
  lead: Lead;

  @Column({
    name: 'docs_master_id',
    type: 'mediumint',
    unsigned: true,
    nullable: true,
  })
  documentTypeId: number | null;

  @ManyToOne(() => DocumentType, { nullable: true })
  @JoinColumn({ name: 'docs_master_id' })
  documentType: DocumentType | null;

  @Column({ name: 'upload_by', type: 'int', nullable: true })
  uploadedById: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'upload_by' })
  uploadedBy: User | null;

  @Column({ name: 'file', type: 'varchar', length: 255, nullable: true })
  filePath: string | null;

  /** The CartBI/"Novel Pattern" bank-statement-analysis vendor's own document
   * id, set once `BankAnalysisService.upload()` gets an accepted response.
   * Used to match the vendor's async webhook callback back to this document. */
  @Column({
    name: 'docs_novel_return_id',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  novelReturnDocId: string | null;

  @Column({ name: 'created_on', type: 'datetime' })
  createdAt: Date;

  @Column({ name: 'removed_by', type: 'int', nullable: true })
  removedById: number | null;

  @Column({ name: 'removed_date', type: 'datetime', nullable: true })
  removedAt: Date | null;

  @Column({
    name: 'docs_active',
    type: 'tinyint',
    unsigned: true,
    nullable: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'docs_deleted',
    type: 'tinyint',
    unsigned: true,
    nullable: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
