import { Column, Entity, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { User } from '../users/user.entity';

/** `NEW` per docs/SCHEMA-MAP.md — JWT refresh-token hashes; legacy used PHP file sessions. */
@Entity('refresh_tokens')
export class RefreshToken extends BaseEntity {
  @ManyToOne(() => User)
  user: User;

  @Column({ type: 'varchar', length: 255 })
  tokenHash: string;

  @Column({ type: 'datetime' })
  expiresAt: Date;

  @Column({ type: 'datetime', nullable: true })
  revokedAt: Date | null;
}
