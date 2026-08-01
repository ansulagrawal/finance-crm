import { CifCustomer, LeadUserType, Pincode } from '@finance-crm/database';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { LeadEligibilityService } from './lead-eligibility.service';
import { LeadsService } from './leads.service';

/** Legacy carries a single company and product; every existing `leads` row uses
 * id 1 for both, and both columns are NOT NULL. */
const LEGACY_DEFAULT_COMPANY_ID = 1;
const LEGACY_DEFAULT_PRODUCT_ID = 1;

export interface LeadImportRowResult {
  row: number;
  status: 'CREATED' | 'ERROR';
  leadId?: number;
  error?: string;
}

const IMPORT_ROW_LIMIT = 3000;
const REQUIRED_COLUMNS = ['name', 'mobile'] as const;

/**
 * Ports legacy `Admin/ImportController.php`'s bulk lead CSV import.
 * Legacy also cross-referenced `cif_customer` (by pancard) to flag repeat
 * customers and backfill KYC/employment data, and ran BRE eligibility
 * inline per row (`CommonComponent::run_eligibility`).
 *
 * The CIF cross-reference is now wired (see `CifCustomer`,
 * `CamService.assignCifCustomer`) — a matching pancard sets `userType` to
 * `REPEAT`. Legacy's KYC/employment backfill from the CIF snapshot isn't
 * replicated: this schema's `CifCustomer` only keeps the identity columns
 * (see that entity's doc comment), not the ~20-column snapshot legacy
 * copies into `lead_customer`/`customer_employment`.
 *
 * The inline BRE eligibility run (`CommonComponent::run_eligibility`) now
 * calls `LeadEligibilityService.evaluate()` (ports
 * `check_customer_eligibility()`) after each row is created — legacy's
 * *other* engine, the full 26-rule scored `bre_rule_engine()`, is a
 * separate, explicit "Run BRE" action (`BreEvaluationService`), not
 * something CSV import ever triggered. Since this backend's CSV format
 * (`sampleCsv()`) carries only name/mobile/email/pan/pincode — no
 * salary/employment/DOB columns legacy's real import format had — most
 * rows will fail the salary/employment/age checks with "Not available"
 * (NA, not Fail) except the hard salary-floor check, which fails outright
 * for a NEW lead with no salary on file, matching legacy's actual
 * behavior for that same input shape, not a bug in this port.
 */
@Injectable()
export class LeadImportService {
  private readonly logger = new Logger(LeadImportService.name);

  constructor(
    @InjectRepository(Pincode)
    private readonly pincodeRepository: Repository<Pincode>,
    @InjectRepository(CifCustomer)
    private readonly cifCustomerRepository: Repository<CifCustomer>,
    private readonly leadsService: LeadsService,
    private readonly leadEligibilityService: LeadEligibilityService,
  ) {}

  sampleCsv(): string {
    return 'name,mobile,email,pan,pincode\nRamesh Kumar,9876543210,ramesh@example.com,ABCDE1234F,400001\n';
  }

  async importCsv(csvText: string): Promise<LeadImportRowResult[]> {
    const rows = parseCsv(csvText).slice(0, IMPORT_ROW_LIMIT);
    if (rows.length === 0) {
      return [];
    }

    const [header, ...dataRows] = rows;
    const columns = header.map((c) => c.trim().toLowerCase());
    for (const required of REQUIRED_COLUMNS) {
      if (!columns.includes(required)) {
        throw new Error(`CSV is missing required column '${required}'`);
      }
    }

    const results: LeadImportRowResult[] = [];
    for (let i = 0; i < dataRows.length; i++) {
      const rowNumber = i + 2; // account for header row, 1-indexed
      const values = dataRows[i];
      const record: Record<string, string> = {};
      columns.forEach((col, idx) => {
        record[col] = (values[idx] ?? '').trim();
      });

      try {
        if (!record.name || !record.mobile) {
          throw new Error('name and mobile are required');
        }

        let cityId: number | undefined;
        let stateId: number | undefined;
        if (record.pincode) {
          const pincode = await this.pincodeRepository.findOne({
            where: { value: record.pincode },
            relations: { city: { state: true } },
          });
          cityId = pincode?.city?.id;
          stateId = pincode?.city?.state?.id;
        }

        let userType: LeadUserType | undefined;
        if (record.pan) {
          const existingCif = await this.cifCustomerRepository.findOne({
            where: { pancard: record.pan },
          });
          userType = existingCif ? LeadUserType.REPEAT : undefined;
        }

        const lead = await this.leadsService.create({
          // Legacy `leads.company_id`/`product_id` are NOT NULL. Bulk import has
          // no per-row company or product, so it uses the single configured one
          // that every legacy row already carries.
          companyId: LEGACY_DEFAULT_COMPANY_ID,
          productId: LEGACY_DEFAULT_PRODUCT_ID,
          firstName: record.name,
          mobile: record.mobile,
          email: record.email || undefined,
          pancard: record.pan || undefined,
          pincode: record.pincode || undefined,
          cityId,
          stateId,
          userType,
        });

        try {
          await this.leadEligibilityService.evaluate(lead.id);
        } catch (eligibilityError) {
          this.logger.warn(
            `Row ${rowNumber} (lead ${lead.id}): eligibility check failed to run - ${(eligibilityError as Error).message}`,
          );
        }

        results.push({ row: rowNumber, status: 'CREATED', leadId: lead.id });
      } catch (error) {
        results.push({
          row: rowNumber,
          status: 'ERROR',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }
}

/** Minimal CSV parser (no quoted-field/embedded-comma support) — matches
 * the simplicity of legacy's plain CI `csvimport` library usage for this
 * internal admin tool. */
function parseCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => line.split(','));
}
