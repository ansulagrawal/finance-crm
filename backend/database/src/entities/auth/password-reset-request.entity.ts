import { Column, Entity, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { User } from '../users/user.entity';

/** `NEW` per docs/SCHEMA-MAP.md — OTP + reset-token flow, no legacy equivalent. */
@Entity('password_reset_requests')
export class PasswordResetRequest extends BaseEntity {
  @ManyToOne(() => User)
  user: User;

  @Column({ type: 'varchar', length: 255 })
  otpHash: string;

  @Column({ type: 'datetime' })
  otpExpiresAt: Date;

  @Column({ type: 'datetime', nullable: true })
  verifiedAt: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  resetTokenHash: string | null;

  @Column({ type: 'datetime', nullable: true })
  resetTokenExpiresAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  consumedAt: Date | null;

  /** Wrong-OTP guesses made against this request. A 6-digit OTP is only
   * 10^6 wide, so without a hard cap the 10-minute validity window is
   * brute-forceable — `AuthService.verifyPasswordResetOtp` consumes the
   * request once this hits `MAX_OTP_ATTEMPTS`. Added by m2.sql. */
  @Column({ type: 'int', default: 0 })
  otpAttemptCount: number;
}
