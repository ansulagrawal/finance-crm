import { CustomerBlacklist } from '@finance-crm/database';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

export interface BlacklistCheckIdentity {
  firstName?: string | null;
  dob?: Date | string | null;
  pancard?: string | null;
  mobile?: string | null;
  alternateMobile?: string | null;
  email?: string | null;
  alternateEmail?: string | null;
}

/**
 * Ports `BreRuleModel::checkBlackListedCustomer()` — matches an identity
 * against every `CustomerBlacklist` row ever created (global, cross-lead),
 * by exact PAN, mobile/alternate-mobile, email/alternate-email, or
 * (first name + DOB). Legacy's hardcoded QA mobile-number bypass list is
 * not ported — see `docs/COMPLETED.md`'s dedupe write-up for the same call
 * made on an identical bypass list elsewhere.
 */
@Injectable()
export class CustomerBlacklistCheckService {
  constructor(
    @InjectRepository(CustomerBlacklist)
    private readonly customerBlacklistRepository: Repository<CustomerBlacklist>,
  ) {}

  async isBlacklisted(identity: BlacklistCheckIdentity): Promise<boolean> {
    const qb = this.customerBlacklistRepository
      .createQueryBuilder('bl')
      .where('bl.isActive = true')
      .andWhere('bl.isDeleted = false');

    const clauses: string[] = [];
    const params: Record<string, unknown> = {};

    if (identity.firstName && identity.dob) {
      clauses.push('(bl.firstName = :firstName AND bl.dob = :dob)');
      params.firstName = identity.firstName.toUpperCase();
      params.dob = identity.dob;
    }
    if (identity.pancard) {
      clauses.push('bl.pancard = :pancard');
      params.pancard = identity.pancard.toUpperCase();
    }
    if (identity.mobile) {
      clauses.push('(bl.mobile = :mobile OR bl.alternateMobile = :mobile)');
      params.mobile = identity.mobile;
    }
    if (identity.alternateMobile) {
      clauses.push(
        '(bl.mobile = :altMobile OR bl.alternateMobile = :altMobile)',
      );
      params.altMobile = identity.alternateMobile;
    }
    if (identity.email) {
      clauses.push('(bl.email = :email OR bl.alternateEmail = :email)');
      params.email = identity.email.toUpperCase();
    }
    if (identity.alternateEmail) {
      clauses.push('(bl.email = :altEmail OR bl.alternateEmail = :altEmail)');
      params.altEmail = identity.alternateEmail.toUpperCase();
    }

    if (clauses.length === 0) {
      return false;
    }

    qb.andWhere(`(${clauses.join(' OR ')})`, params);
    const match = await qb.getOne();
    return match !== null;
  }
}
