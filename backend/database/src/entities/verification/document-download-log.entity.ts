import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Lead } from '../leads/lead.entity';
import { User } from '../users/user.entity';
import { Document } from './document.entity';

/** Legacy `docs_download_logs` (confirmed against a real UAT export). */
@Entity('docs_download_logs')
export class DocumentDownloadLog {
  @PrimaryGeneratedColumn({ name: 'ddl_id', type: 'bigint', unsigned: true })
  id: number;

  @Column({
    name: 'ddl_lead_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  leadId: number | null;

  @ManyToOne(() => Lead, { nullable: true })
  @JoinColumn({ name: 'ddl_lead_id' })
  lead: Lead | null;

  @Column({
    name: 'ddl_document_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  documentId: number | null;

  @ManyToOne(() => Document, { nullable: true })
  @JoinColumn({ name: 'ddl_document_id' })
  document: Document | null;

  @Column({ name: 'ddl_user_id', type: 'int', unsigned: true, nullable: true })
  userId: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'ddl_user_id' })
  user: User | null;

  @Column({
    name: 'ddl_user_role_id',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  userRoleId: number | null;

  @Column({
    name: 'ddl_user_platform',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  platform: string | null;

  @Column({
    name: 'ddl_user_browser',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  browser: string | null;

  @Column({
    name: 'ddl_user_agent',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  userAgent: string | null;

  @Column({ name: 'ddl_user_ip', type: 'varchar', length: 50, nullable: true })
  ipAddress: string | null;

  @Column({ name: 'ddl_created_on', type: 'datetime' })
  createdAt: Date;
}
