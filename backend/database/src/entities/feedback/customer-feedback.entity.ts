import { BeforeInsert, BeforeUpdate, Column, Entity, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { Lead } from '../leads/lead.entity';

@Entity('customer_feedbacks')
export class CustomerFeedback extends BaseEntity {
  @ManyToOne(() => Lead)
  lead: Lead;

  @Column({ type: 'varchar', length: 150, nullable: true })
  customerName: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  mobile: string | null;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  /** Stored lowercase always, regardless of caller — see `User.normalizeEmail`. */
  @BeforeInsert()
  @BeforeUpdate()
  normalizeEmail(): void {
    this.email = this.email?.toLowerCase() ?? this.email;
  }
}
