import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { tinyintBoolean } from '../column-transformers';

/** Legacy `docs_master` (41 rows). Legacy 41 rows vs the old seed's 7 — the legacy rows win. */
@Entity('docs_master')
export class DocumentType {
  @PrimaryGeneratedColumn({ name: 'id', type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'heading', type: 'varchar', length: 200 })
  name: string;

  @Column({ name: 'docs_type', type: 'varchar', length: 200 })
  docsType: string;

  @Column({ name: 'docs_sub_type', type: 'varchar', length: 200 })
  docsSubType: string;

  @Column({ name: 'docs_required', type: 'int', transformer: tinyintBoolean })
  isRequired: boolean;

  @Column({ name: 'created_on', type: 'timestamp' })
  createdAt: Date;

  @Column({ name: 'updated_on', type: 'timestamp' })
  updatedAt: Date;

  @Column({
    name: 'document_active',
    type: 'tinyint',
    unsigned: true,
    default: 1,
    transformer: tinyintBoolean,
  })
  isActive: boolean;

  @Column({
    name: 'document_deleted',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    transformer: tinyintBoolean,
  })
  isDeleted: boolean;
}
