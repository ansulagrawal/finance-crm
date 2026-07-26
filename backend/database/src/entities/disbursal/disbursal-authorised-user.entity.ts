import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { User } from '../users/user.entity';

/**
 * `NEW` per `docs/SCHEMA-MAP.md` — the named-individual whitelist legacy
 * hardcoded as `if (!in_array($user_id, array(37, 31, 69, 83, 115)))` in
 * `payday_disbursement_icici_helper.php:159`. Legacy restricted the ICICI
 * disbursal call to five specific people, not to everyone holding a role,
 * and a role check alone is strictly weaker than that (`docs/TODO.md`).
 *
 * A row here is *in addition to* the `@Roles('DS1','DS2')` guard on the
 * route, never instead of it: role says "this job function disburses",
 * this table says "this person is trusted with the money-moving path".
 * Membership is checked only on `paymentMode: ONLINE` — the path that
 * actually moves money — matching what legacy gated. OFFLINE disbursal is
 * bookkeeping for a transfer a human already made and stays role-gated.
 *
 * Revocation is the `isActive` flag from `BaseEntity`, not a delete, so the
 * grant history of a money permission survives.
 */
@Entity('disbursal_authorised_users')
@Unique(['userId'])
export class DisbursalAuthorisedUser extends BaseEntity {
  @Column({ type: 'bigint', unsigned: true })
  userId: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User | null;

  /** Who granted this. An unaudited money permission is not a permission. */
  @Column({ type: 'bigint', unsigned: true, nullable: true })
  grantedById: number | null;
}
