import { Lead, LeadCustomer, Loan } from '@finance-crm/database';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

const MAX_RESULTS = 50;

/**
 * Ports `SearchController.php`'s `(agent != 'OL') ? $row->email : str_pad(...)`
 * ternary — `OL` ("Other", legacy's catch-all label for any role that
 * didn't match a known case) is the one role legacy ever masked search
 * results for; every other role, including `CA`/`SA`, saw the value in
 * full. Not an admin-override case like the rest of this app's role
 * checks — `OL` is a stricter default, not a lesser one to bypass.
 */
function maskLegacyOlValue(
  value: string | null,
  visibleSuffixLength: number,
  totalLength: number,
): string | null {
  if (value == null) return value;
  return value.slice(-visibleSuffixLength).padStart(totalLength, 'X');
}

/**
 * Ported from the legacy `SearchController::filter()` field list (lead_id,
 * lead_reference_no, loan_no, pancard, name, mobile, application_no, aadhar,
 * cif, email) — legacy built this as one raw string-concatenated SQL query
 * (a real SQL-injection bug); every condition here is bound via TypeORM
 * QueryBuilder parameters instead.
 *
 * All matched fields (lead-level, customer-level KYC, loan) resolve back to
 * a single `Lead` row (loans/customers are 1:1 children of a lead in this
 * schema), so results are one flat, deduped list — not grouped by entity
 * type like a generic multi-index search would be.
 *
 * `cif` (legacy `LD.customer_id`) now matches `CifCustomer.cifNumber` —
 * see `CamService.assignCifCustomer` for how/when a lead gets one.
 */
@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
  ) {}

  async search(
    q: string,
    callerRoles: string[] = [],
  ): Promise<{ leads: Lead[] }> {
    const trimmed = q.trim();
    const isNumeric = /^\d+$/.test(trimmed);
    const likeValue = `${trimmed}%`;

    const qb = this.leadRepository
      .createQueryBuilder('lead')
      .leftJoinAndSelect('lead.leadStatus', 'leadStatus')
      .leftJoinAndSelect('lead.company', 'company')
      .leftJoinAndSelect('lead.product', 'product')
      .leftJoinAndSelect('lead.cifCustomer', 'cifCustomer')
      .leftJoin(LeadCustomer, 'customer', 'customer.leadId = lead.id')
      .leftJoin(Loan, 'loan', 'loan.leadId = lead.id')
      .where('lead.leadReferenceNo = :exact', { exact: trimmed })
      .orWhere('lead.applicationNo = :exact', { exact: trimmed })
      .orWhere('lead.mobile = :exact', { exact: trimmed })
      .orWhere('lead.email = :exact', { exact: trimmed })
      .orWhere('lead.pancard = :exact', { exact: trimmed })
      .orWhere('lead.firstName LIKE :likeValue', { likeValue })
      .orWhere('customer.pancard = :exact', { exact: trimmed })
      .orWhere('customer.aadhaarNumber = :exact', { exact: trimmed })
      .orWhere('customer.mobile = :exact', { exact: trimmed })
      .orWhere('customer.email = :exact', { exact: trimmed })
      .orWhere('loan.loanNumber = :exact', { exact: trimmed })
      .orWhere('cifCustomer.cifNumber = :exact', { exact: trimmed });

    if (isNumeric) {
      qb.orWhere('lead.id = :id', { id: Number(trimmed) });
    }

    const leads = await qb
      .orderBy('lead.id', 'DESC')
      .distinct(true)
      .take(MAX_RESULTS)
      .getMany();

    if (callerRoles.includes('OL')) {
      for (const lead of leads) {
        lead.email = maskLegacyOlValue(lead.email, 10, 15);
        // `mobile` isn't nullable on `Lead`, unlike `email`.
        lead.mobile = lead.mobile.slice(-4).padStart(10, 'X');
      }
    }

    return { leads };
  }
}
