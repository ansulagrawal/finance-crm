import { findOrFail } from '@finance-crm/common';
import {
  AccountAggregatorLog,
  AccountAggregatorMethod,
  AccountAggregatorProvider,
  ApiCallStatus,
  BankAnalysisLog,
  BankAnalysisMethod,
  BankVerificationLog,
  BreDecision,
  BreRule,
  BreRuleResult,
  CreditAnalysisMemo,
  CrifBureauLog,
  CustomerBanking,
  IncomeType,
  Lead,
  LeadCustomer,
  LeadCustomerReference,
  LeadEmployment,
  LeadUserType,
  Loan,
} from '@finance-crm/database';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { CustomerBlacklistCheckService } from '../collection/customer-blacklist-check.service';

export interface BreEvaluationSummary {
  overallDecision: BreDecision | 0;
  results: BreRuleResult[];
}

interface RuleOutcome {
  cutoffValue: string;
  actualValue: string;
  relevantInputs: string;
  // `BreRuleResult.systemDecision` is typed `BreDecision | 0` — legacy's
  // `BreDecision` enum has no NOT_APPLICABLE member, only APPROVE/REFER/
  // REJECT; `0` is the entity's own "not decided" sentinel (its column
  // default), reused here as a stand-in for what this port previously
  // called NOT_APPLICABLE.
  decision: BreDecision | 0;
}

const NOT_APPLICABLE = 0 as const;

const FOIR_PERCENTAGE = { NEW: 0.45, REPEAT: 0.5 };

/**
 * Ports `bre_rule_engine()` (`aip_engine/bre_rule_engine.php`) — legacy's
 * full 26-active-rule scored engine, triggered by an explicit "Run BRE"
 * action (`BreController`), distinct from `LeadEligibilityService`'s
 * lightweight pre-screen gate.
 *
 * Legacy configures 39 rule slots (`bre-rules.json`, all seeded), but only
 * 28 ever have real evaluation logic in `bre_rule_engine.php` — the other
 * 11 (`Current Residence Type`, `Company Name Match`, `Geotagging`,
 * "<=180 days..." DPD rule, `Internal Dedupe`, plus 6 more explicitly
 * commented out in source: `Personal`/`Office Email Verification`,
 * `Aadhaar`/`PAN OCR Verification`, `DOB Verification`,
 * `Current Residence Since`) are configured but never actually run by
 * legacy's own engine. This port produces **no** `BreRuleResult` row for
 * those 11 — matching legacy exactly, not a gap in this port.
 *
 * Of the 28 legacy actually evaluates, 25 are built with real logic here
 * (see the individual rule methods below) — including `SCORE`/`Overdue
 * Accounts`/`ID Variation (PAN)`/`Inquiries in last 30 days` (parsed from
 * `CrifBureauLog.response`), `Bank Account Verification` (parsed from
 * `BankVerificationLog.response`), `Eligible Loan Amount`/`Eligible Loan
 * Tenure` (a full port of `bre_quote_engine()`'s hardcoded city-category x
 * salary-band FOIR-percent table — never a missing DB table), and
 * `Banking Document`/`Bank Statement Average Monthly Balance`/`Bank
 * Statement Fraud Score`/`Bank Statement & Bank Account Match (API)`
 * (parsed from `BankAnalysisLog.response` — CartBI/"Novel Pattern",
 * ported for real as `integrations-api`'s `BankAnalysisModule` once it
 * became clear this vendor didn't need to stay unbuilt: same "real
 * adapter reading env-var credentials, doesn't function until real keys
 * are supplied" convention as every other vendor in this codebase, not
 * something that was ever blocked). Only 3 remain `NOT_APPLICABLE` with a
 * `relevantInputs` note citing the real blocker: `Account Aggregator`
 * because this backend's AA module normalizes the vendor response rather
 * than storing Finvu's raw shape legacy's rule expects;
 * `Current Employment Experience` and `Pincode Matching` because no
 * confirmed equivalent field exists in this schema.
 *
 * Final decision aggregation ported exactly: any REJECT wins; else any
 * REFER wins; else all-APPROVE wins; else (nothing computable)
 * NOT_APPLICABLE. Legacy also flips a `customer_bre_run_flag` on
 * `lead_customer` — not ported as a column here since "has this lead been
 * BRE-evaluated" is already derivable from whether any `BreRuleResult`
 * rows exist for it.
 */
@Injectable()
export class BreEvaluationService {
  private readonly logger = new Logger(BreEvaluationService.name);

  constructor(
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(LeadCustomer)
    private readonly leadCustomerRepository: Repository<LeadCustomer>,
    @InjectRepository(LeadEmployment)
    private readonly leadEmploymentRepository: Repository<LeadEmployment>,
    @InjectRepository(CreditAnalysisMemo)
    private readonly camRepository: Repository<CreditAnalysisMemo>,
    @InjectRepository(LeadCustomerReference)
    private readonly referenceRepository: Repository<LeadCustomerReference>,
    @InjectRepository(Loan)
    private readonly loanRepository: Repository<Loan>,
    @InjectRepository(BreRule)
    private readonly breRuleRepository: Repository<BreRule>,
    @InjectRepository(BreRuleResult)
    private readonly breRuleResultRepository: Repository<BreRuleResult>,
    @InjectRepository(CrifBureauLog)
    private readonly crifBureauLogRepository: Repository<CrifBureauLog>,
    @InjectRepository(BankVerificationLog)
    private readonly bankVerificationLogRepository: Repository<BankVerificationLog>,
    @InjectRepository(CustomerBanking)
    private readonly customerBankingRepository: Repository<CustomerBanking>,
    @InjectRepository(BankAnalysisLog)
    private readonly bankAnalysisLogRepository: Repository<BankAnalysisLog>,
    @InjectRepository(AccountAggregatorLog)
    private readonly accountAggregatorLogRepository: Repository<AccountAggregatorLog>,
    private readonly blacklistCheck: CustomerBlacklistCheckService,
  ) {}

  async evaluate(leadId: number): Promise<BreEvaluationSummary> {
    await findOrFail(this.leadRepository, leadId, 'Lead');
    const lead = (await this.leadRepository.findOne({
      where: { id: leadId },
      relations: { city: true, state: true },
    })) as Lead;
    const [customer, employment, cam, referenceCount] = await Promise.all([
      this.leadCustomerRepository.findOne({ where: { lead: { id: leadId } } }),
      this.leadEmploymentRepository.findOne({
        where: { lead: { id: leadId } },
      }),
      this.camRepository.findOne({ where: { lead: { id: leadId } } }),
      this.referenceRepository.count({ where: { lead: { id: leadId } } }),
    ]);
    const isBlacklisted = await this.blacklistCheck.isBlacklisted({
      firstName: customer?.firstName,
      dob: customer?.dob,
      pancard: lead.pancard,
      mobile: lead.mobile,
      alternateMobile: customer?.alternateMobile,
      email: lead.email,
      alternateEmail: customer?.alternateEmail,
    });
    const hasActiveLoan = await this.hasActiveLoanElsewhere(lead);
    // `CrifBureauLog` has no `ApiCallStatus`-shaped success flag (only an
    // unconfirmed-format `bureauStatus` string) — just take the latest row.
    const crifLog = await this.crifBureauLogRepository.findOne({
      where: { lead: { id: leadId } },
      order: { id: 'DESC' },
    });
    const bankVerificationLog =
      await this.bankVerificationLogRepository.findOne({
        where: { lead: { id: leadId } },
        order: { id: 'DESC' },
      });
    const hasBankAccountOnFile =
      (await this.customerBankingRepository.count({
        where: { lead: { id: leadId } },
      })) > 0;
    const customerBanking = await this.customerBankingRepository.findOne({
      where: { lead: { id: leadId } },
    });
    const bankAnalysisLog = await this.bankAnalysisLogRepository.findOne({
      where: {
        lead: { id: leadId },
        method: BankAnalysisMethod.DOWNLOAD,
        status: ApiCallStatus.SUCCESS,
      },
      order: { id: 'DESC' },
    });
    const bankAnalysisData = this.parseBankAnalysisData(
      bankAnalysisLog?.response ?? null,
    );
    const accountAggregatorLog =
      await this.accountAggregatorLogRepository.findOne({
        where: {
          lead: { id: leadId },
          method: AccountAggregatorMethod.FI_FETCH_DATA,
          status: ApiCallStatus.SUCCESS,
        },
        order: { id: 'DESC' },
      });

    const outcomes: Record<string, RuleOutcome> = {
      'Age Criteria': this.ageCriteria(customer?.dob ?? null),
      'Employment Type': this.employmentType(employment?.incomeType ?? null),
      'Salary Mode': this.salaryMode(employment?.salaryMode ?? null),
      'Location Criteria': this.locationCriteria(lead),
      'Salary Criteria with City Category': this.salaryWithCityCategory(lead),
      'Customer Mobile OTP': this.booleanRule(
        (customer?.mobileVerifiedStatus ?? '').toUpperCase() === 'YES',
        'Mobile OTP Verify',
      ),
      'Aadhaar EKYC Verification': this.booleanRule(
        Boolean(customer?.aadhaarNumber) &&
          (customer?.isAadhaarVerified ?? false),
        'Aadhaar EKYC Verify',
      ),
      'PAN NSDL Verification': this.booleanRule(
        Boolean(lead.pancard) && (customer?.isPancardVerified ?? false),
        'PAN Verify',
      ),
      'Min and Max loan amount': this.loanAmount(
        cam?.recommendedLoanAmount ?? null,
      ),
      'Min and Max Loan Tenure': this.loanTenure(cam?.tenureDays ?? null),
      'Customer Reference Available': this.referenceAvailable(referenceCount),
      'Active Loan': this.activeLoan(hasActiveLoan),
      'Blacklisted Customer': this.blacklistedCustomer(isBlacklisted),
      'Final FOIR Percentage': this.finalFoirPercentage(
        cam?.finalFoirPercentage ?? null,
        lead.userType,
      ),
      'Banking Document': this.bankingDocument(bankAnalysisData),
      'Bank Account Verification': this.bankAccountVerification(
        bankVerificationLog,
        hasBankAccountOnFile,
      ),
      'Bank Statement & Bank Account Match (API)':
        this.bankStatementAccountMatch(bankAnalysisData, customerBanking),
      'Current Employment Experience': this.notApplicable(
        'legacy field customer_employment_since has no confirmed equivalent column in LeadEmployment',
      ),
      'Bank Statement Average Monthly Balance':
        this.bankStatementAverageBalance(bankAnalysisData),
      'Pincode Matching': this.notApplicable(
        'no separate Aadhaar-address pincode field is modeled (only one current-address pincode per lead)',
      ),
      'Eligible Loan Amount': this.eligibleLoanAmount(
        cam,
        lead,
        customer,
        employment,
      ),
      'Eligible Loan Tenure': this.eligibleLoanTenure(cam),
      'Bank Statement Fraud Score':
        this.bankStatementFraudScore(bankAnalysisData),
      SCORE: this.bureauScore(crifLog),
      'Overdue Accounts': this.bureauOverdueAccounts(crifLog),
      'ID Variation (PAN)': this.bureauPanVariation(crifLog),
      'Inquiries in last 30 days': this.bureauInquiries(crifLog),
      'Account Aggregator': this.accountAggregator(
        accountAggregatorLog,
        customerBanking,
      ),
    };

    const results = await this.persistResults(lead, outcomes);
    const overallDecision = this.aggregate(results);
    return { overallDecision, results };
  }

  private async persistResults(
    lead: Lead,
    outcomes: Record<string, RuleOutcome>,
  ): Promise<BreRuleResult[]> {
    const rules = await this.breRuleRepository.find({
      where: { name: In(Object.keys(outcomes)) },
    });
    const rulesByName = new Map(rules.map((r) => [r.name, r]));

    const saved: BreRuleResult[] = [];
    for (const [name, outcome] of Object.entries(outcomes)) {
      const rule = rulesByName.get(name);
      if (!rule) {
        this.logger.warn(
          `BRE rule '${name}' not found in bre_rules — skipping`,
        );
        continue;
      }
      const entity = this.breRuleResultRepository.create({
        lead,
        rule,
        ruleName: rule.name,
        cutoffValue: outcome.cutoffValue,
        actualValue: outcome.actualValue,
        relevantInputs: outcome.relevantInputs,
        systemDecision: outcome.decision,
        createdAt: new Date(),
      });
      saved.push(await this.breRuleResultRepository.save(entity));
    }
    return saved;
  }

  private aggregate(results: BreRuleResult[]): BreDecision | 0 {
    const decidable = results.filter(
      (r) => r.systemDecision !== NOT_APPLICABLE,
    );
    if (decidable.length === 0) return NOT_APPLICABLE;

    const approve = decidable.filter(
      (r) => r.systemDecision === BreDecision.APPROVE,
    ).length;
    const refer = decidable.filter(
      (r) => r.systemDecision === BreDecision.REFER,
    ).length;
    const reject = decidable.filter(
      (r) => r.systemDecision === BreDecision.REJECT,
    ).length;

    if (decidable.length === approve) return BreDecision.APPROVE;
    if (decidable.length === approve + refer) return BreDecision.REFER;
    if (reject > 0) return BreDecision.REJECT;
    return NOT_APPLICABLE;
  }

  private notApplicable(reason: string): RuleOutcome {
    return {
      cutoffValue: '',
      actualValue: '',
      relevantInputs: `blocked: ${reason}`,
      decision: NOT_APPLICABLE,
    };
  }

  private booleanRule(isVerified: boolean, label: string): RuleOutcome {
    return {
      cutoffValue: `${label} => Yes`,
      actualValue: isVerified ? 'Yes' : 'No',
      relevantInputs: `${label}=${isVerified}`,
      decision: isVerified ? BreDecision.APPROVE : BreDecision.REJECT,
    };
  }

  private ageCriteria(dob: Date | string | null): RuleOutcome {
    const cutoffValue = '>=21 && <= 54';
    if (!dob) {
      return {
        cutoffValue,
        actualValue: '',
        relevantInputs: 'applicant_dob=null',
        decision: NOT_APPLICABLE,
      };
    }
    const age = this.ageInYears(new Date(dob));
    const decision =
      age >= 21 && age <= 54 ? BreDecision.APPROVE : BreDecision.REJECT;
    return {
      cutoffValue,
      actualValue: `applicant_age=${age}`,
      relevantInputs: `applicant_dob=${new Date(dob).toISOString().slice(0, 10)}`,
      decision,
    };
  }

  private employmentType(incomeType: IncomeType | null): RuleOutcome {
    return {
      cutoffValue: 'Salaried',
      actualValue: incomeType != null ? String(incomeType) : '',
      relevantInputs: `applicant_employment=${incomeType ?? 'null'}`,
      decision:
        incomeType === IncomeType.SALARIED
          ? BreDecision.APPROVE
          : incomeType === IncomeType.SELF_EMPLOYED
            ? BreDecision.REJECT
            : NOT_APPLICABLE,
    };
  }

  private salaryMode(salaryMode: string | null): RuleOutcome {
    const cutoffValue = 'Bank';
    if (!salaryMode) {
      return {
        cutoffValue,
        actualValue: '',
        relevantInputs: 'applicant_salary_mode=null',
        decision: NOT_APPLICABLE,
      };
    }
    const normalized = salaryMode.toUpperCase();
    const decision =
      normalized === 'BANK'
        ? BreDecision.APPROVE
        : normalized === 'CHEQUE'
          ? BreDecision.REFER
          : BreDecision.REJECT;
    return {
      cutoffValue,
      actualValue: normalized,
      relevantInputs: `applicant_salary_mode=${normalized}`,
      decision,
    };
  }

  private locationCriteria(lead: Lead): RuleOutcome {
    const cutoffValue = 'City Sourcing => Yes';
    if (!lead.city) {
      return {
        cutoffValue,
        actualValue: '',
        relevantInputs: 'current_city=null',
        decision: NOT_APPLICABLE,
      };
    }
    return {
      cutoffValue,
      actualValue: lead.city.isSourcing ? 'Yes' : 'No',
      relevantInputs: `current_city_name=${lead.city.name},current_city_sourcing=${lead.city.isSourcing}`,
      decision: lead.city.isSourcing ? BreDecision.APPROVE : BreDecision.REJECT,
    };
  }

  private salaryWithCityCategory(lead: Lead): RuleOutcome {
    const cutoffValue = '>=25,000 & CITY CAT A';
    const income = lead.monthlySalaryAmount;
    const category = lead.city?.category ?? null;
    if (!income || !category) {
      return {
        cutoffValue,
        actualValue: '',
        relevantInputs: `customer_monthly_income=${income ?? 'null'},current_city_category=${category ?? 'null'}`,
        decision: NOT_APPLICABLE,
      };
    }

    let decision: BreDecision;
    let actualValue: string;
    if (income >= 25000) {
      decision = BreDecision.APPROVE;
      actualValue = `>=25,000 & CITY CAT ${category}`;
    } else if (income >= 20000 && category === 'B') {
      decision = BreDecision.REFER;
      actualValue = '20,000 >= & < 25,000 & CITY CAT B';
    } else {
      decision = BreDecision.REJECT;
      actualValue = '<25,000';
    }
    return {
      cutoffValue,
      actualValue,
      relevantInputs: `customer_monthly_income=${income},current_city_category=${category}`,
      decision,
    };
  }

  private loanAmount(recommendedLoanAmount: number | null): RuleOutcome {
    const cutoffValue = '>=5,000 & <=1,00,000';
    if (!recommendedLoanAmount) {
      return {
        cutoffValue,
        actualValue: '',
        relevantInputs: 'recommend_loan_amount=null',
        decision: NOT_APPLICABLE,
      };
    }
    const inRange =
      recommendedLoanAmount >= 5000 && recommendedLoanAmount <= 100000;
    return {
      cutoffValue,
      actualValue: inRange ? '>=5,000 & <=1,00,000' : '<5,000 or >1,00,000',
      relevantInputs: `recommend_loan_amount=${recommendedLoanAmount}`,
      decision: inRange ? BreDecision.APPROVE : BreDecision.REJECT,
    };
  }

  private loanTenure(tenureDays: number | null): RuleOutcome {
    const cutoffValue = '>=7 days to <=30 days';
    if (!tenureDays) {
      return {
        cutoffValue,
        actualValue: '',
        relevantInputs: 'recommend_loan_tenure=null',
        decision: NOT_APPLICABLE,
      };
    }
    let decision: BreDecision;
    let actualValue: string;
    if (tenureDays >= 7 && tenureDays <= 30) {
      decision = BreDecision.APPROVE;
      actualValue = '>=7 days to <=30 days';
    } else if (tenureDays > 30 && tenureDays <= 40) {
      decision = BreDecision.REFER;
      actualValue = '>30 days to <=40 days';
    } else if (tenureDays < 7) {
      decision = BreDecision.REJECT;
      actualValue = '<7 days';
    } else {
      decision = BreDecision.REJECT;
      actualValue = '>40 days';
    }
    return {
      cutoffValue,
      actualValue,
      relevantInputs: `recommend_loan_tenure=${tenureDays}`,
      decision,
    };
  }

  private referenceAvailable(count: number): RuleOutcome {
    const decision = count >= 2 ? BreDecision.APPROVE : BreDecision.REJECT;
    return {
      cutoffValue: 'Reference Available => Yes',
      actualValue: count >= 2 ? 'Yes' : 'No',
      relevantInputs: `customer_reference_count=${count}`,
      decision,
    };
  }

  private activeLoan(hasActiveLoan: boolean): RuleOutcome {
    return {
      cutoffValue: 'Active Loan => No',
      actualValue: hasActiveLoan ? 'Yes' : 'No',
      relevantInputs: `active_loan=${hasActiveLoan}`,
      decision: hasActiveLoan ? BreDecision.REJECT : BreDecision.APPROVE,
    };
  }

  private blacklistedCustomer(isBlacklisted: boolean): RuleOutcome {
    return {
      cutoffValue: 'Customer Details Matched => No',
      actualValue: isBlacklisted ? 'Yes' : 'No',
      relevantInputs: `black_list_match=${isBlacklisted}`,
      decision: isBlacklisted ? BreDecision.REFER : BreDecision.APPROVE,
    };
  }

  /**
   * Legacy's high-earner/owned-residence branch (`monthly_salary > 300000
   * && r_type == 'OWNED'`) is a subset of the plain NEW-user branch below
   * it (both require the same `<= 45%` threshold and both APPROVE) — a
   * dead/redundant branch, not ported. REPEAT allows a strictly higher
   * (< 50%, not <=) FOIR ceiling than NEW (<= 45%), matching legacy.
   */
  private finalFoirPercentage(
    finalFoirPercentage: number | null,
    userType: LeadUserType,
  ): RuleOutcome {
    const cutoffValue = `Final FOIR Percentage <= ${userType === LeadUserType.REPEAT ? FOIR_PERCENTAGE.REPEAT * 100 : FOIR_PERCENTAGE.NEW * 100}%`;
    if (!finalFoirPercentage || finalFoirPercentage <= 0) {
      return {
        cutoffValue,
        actualValue: '',
        relevantInputs: `final_foir_percentage=${finalFoirPercentage ?? 'null'},user_type=${userType}`,
        decision: NOT_APPLICABLE,
      };
    }
    const withinLimit =
      userType === LeadUserType.REPEAT
        ? finalFoirPercentage < FOIR_PERCENTAGE.REPEAT * 100
        : finalFoirPercentage <= FOIR_PERCENTAGE.NEW * 100;
    return {
      cutoffValue,
      actualValue: `final_foir_percentage=${finalFoirPercentage}`,
      relevantInputs: `final_foir_percentage=${finalFoirPercentage},user_type=${userType}`,
      decision: withinLimit ? BreDecision.APPROVE : BreDecision.REJECT,
    };
  }

  private async hasActiveLoanElsewhere(lead: Lead): Promise<boolean> {
    if (!lead.pancard) return false;
    const activeLoan = await this.loanRepository.findOne({
      where: {
        lead: { pancard: lead.pancard },
        // `Loan.status` is legacy's free-string lifecycle label (same value
        // space as `Lead.legacyStatus`), not a `LoanStatus` enum.
        status: 'DISBURSED',
      },
    });
    return activeLoan !== null;
  }

  private ageInYears(dob: Date): number {
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const monthDiff = now.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
      age -= 1;
    }
    return age;
  }

  /**
   * Parses `CrifBureauLog`'s CRIF-report JSON for `ACCOUNTS-SUMMARY`,
   * `PERSONAL-INFO-VARIATION`, `INQUIRY-HISTORY` — sibling keys under the
   * same `credit_report` root that `cibilScore` (`SCORES.SCORE.SCORE-VALUE`)
   * comes from, confirmed live via `CrifBureauService`'s own extraction.
   *
   * UNCONFIRMED: this entity models a 3-step legacy API flow
   * (`api1Response`/`api2Response`/`api3Response`) that the pre-rewrite
   * entity (a single `response` field) didn't have, and no source confirms
   * which step actually carries the full `credit_report` JSON. Tries all
   * three (latest step first) rather than committing to one guess — should
   * be confirmed against a real production log and simplified once it is.
   */
  private parseCrifReport(log: CrifBureauLog): Record<string, unknown> | null {
    for (const response of [
      log.api3Response,
      log.api2Response,
      log.api1Response,
    ]) {
      if (!response) continue;
      try {
        const parsed = JSON.parse(response) as {
          data?: { credit_report?: Record<string, unknown> };
        };
        const report = parsed.data?.credit_report;
        if (report) return report;
      } catch {
        // try the next response field
      }
    }
    return null;
  }

  private bureauScore(log: CrifBureauLog | null): RuleOutcome {
    const cutoffValue = 'Score >= 500';
    const score = log?.cibilScore ? Number(log.cibilScore) : null;
    if (!log || score === null || Number.isNaN(score)) {
      return {
        cutoffValue,
        actualValue: '',
        relevantInputs: 'bureau_score=null',
        decision: BreDecision.REFER,
      };
    }
    return {
      cutoffValue,
      actualValue: `Score ${score >= 500 ? '>=' : '<'} 500`,
      relevantInputs: `bureau_score=${score}`,
      decision: score >= 500 ? BreDecision.APPROVE : BreDecision.REFER,
    };
  }

  private bureauOverdueAccounts(log: CrifBureauLog | null): RuleOutcome {
    const cutoffValue = 'Overdue Accounts == 0';
    const report = log ? this.parseCrifReport(log) : null;
    const overdue = this.readPath<number>(report, [
      'ACCOUNTS-SUMMARY',
      'PRIMARY-ACCOUNTS-SUMMARY',
      'PRIMARY-OVERDUE-NUMBER-OF-ACCOUNTS',
    ]);
    if (!report || overdue === null) {
      return {
        cutoffValue,
        actualValue: '',
        relevantInputs: 'over_due_accounts=null',
        decision: BreDecision.REJECT,
      };
    }
    const count = Number(overdue);
    return {
      cutoffValue,
      actualValue: `Overdue Accounts ${count === 0 ? '== 0' : '> 0'}`,
      relevantInputs: `over_due_accounts=${count}`,
      decision: count === 0 ? BreDecision.APPROVE : BreDecision.REFER,
    };
  }

  private bureauPanVariation(log: CrifBureauLog | null): RuleOutcome {
    const cutoffValue = 'Variation <= 1';
    const report = log ? this.parseCrifReport(log) : null;
    const variation = this.readPath<unknown>(report, [
      'PERSONAL-INFO-VARIATION',
      'PAN-VARIATIONS',
      'VARIATION',
    ]);
    if (!report || variation === null) {
      return {
        cutoffValue,
        actualValue: '',
        relevantInputs: 'pan_variation_count=null',
        decision: BreDecision.REJECT,
      };
    }
    const count = Array.isArray(variation) ? variation.length : 1;
    return {
      cutoffValue,
      actualValue: `Variation ${count <= 1 ? '<= 1' : '> 1'}`,
      relevantInputs: `pan_variation_count=${count}`,
      decision: count <= 1 ? BreDecision.APPROVE : BreDecision.REFER,
    };
  }

  private bureauInquiries(log: CrifBureauLog | null): RuleOutcome {
    const cutoffValue = 'Inquiries <= 3';
    const report = log ? this.parseCrifReport(log) : null;
    const history = this.readPath<unknown>(report, [
      'INQUIRY-HISTORY',
      'HISTORY',
    ]);
    if (!report || history === null) {
      return {
        cutoffValue,
        actualValue: '',
        relevantInputs: 'inquiries_last_30_days=null',
        decision: BreDecision.REJECT,
      };
    }
    const rows = Array.isArray(history) ? history : [history];
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const count = rows.filter((row) => {
      const date = (row as { 'INQUIRY-DATE'?: string })?.['INQUIRY-DATE'];
      return date && new Date(date).getTime() > thirtyDaysAgo;
    }).length;
    return {
      cutoffValue,
      actualValue: `Inquiries ${count <= 3 ? '<= 3' : '> 3'}`,
      relevantInputs: `inquiries_last_30_days=${count}`,
      decision: count <= 3 ? BreDecision.APPROVE : BreDecision.REFER,
    };
  }

  private readPath<T>(
    obj: Record<string, unknown> | null,
    path: string[],
  ): T | null {
    let current: unknown = obj;
    for (const key of path) {
      if (current == null || typeof current !== 'object') return null;
      current = (current as Record<string, unknown>)[key];
    }
    return (current ?? null) as T | null;
  }

  /**
   * Parses `BankAnalysisLog.response` (the DOWNLOAD-method call's stored
   * response) for the CartBI fields legacy's `bre_rule_engine()` reads off
   * `$bank_analysis_data['data'][0]` — confirmed shape via
   * `BankAnalysisService.downloadResult()`'s own return contract.
   */
  private parseBankAnalysisData(response: string | null): {
    accountNumber: string | null;
    ifscCode: string | null;
    fraudScore: number | null;
    averageBalanceLastSixMonth: number | null;
  } | null {
    if (!response) return null;
    try {
      const parsed = JSON.parse(response) as {
        data?: Array<{
          accountNumber?: string;
          ifscCode?: string;
          fraudScore?: number;
          camAnalysisData?: { averageBalanceLastSixMonth?: number };
        }>;
      };
      const first = parsed.data?.[0];
      if (!first) return null;
      return {
        accountNumber: first.accountNumber?.trim() ?? null,
        ifscCode: first.ifscCode?.trim().toUpperCase() ?? null,
        fraudScore: first.fraudScore ?? null,
        averageBalanceLastSixMonth:
          first.camAnalysisData?.averageBalanceLastSixMonth != null
            ? Math.round(first.camAnalysisData.averageBalanceLastSixMonth)
            : null,
      };
    } catch {
      return null;
    }
  }

  private bankingDocument(
    data: ReturnType<BreEvaluationService['parseBankAnalysisData']>,
  ): RuleOutcome {
    const cutoffValue = 'Bank Statement uploaded & Banking Analysis => Yes';
    const present = data !== null;
    return {
      cutoffValue,
      actualValue: present ? 'Yes' : 'No',
      relevantInputs: `bank_statement_analysis=${present}`,
      decision: present ? BreDecision.APPROVE : BreDecision.REJECT,
    };
  }

  private bankStatementAverageBalance(
    data: ReturnType<BreEvaluationService['parseBankAnalysisData']>,
  ): RuleOutcome {
    const cutoffValue = '>=10,000';
    const balance = data?.averageBalanceLastSixMonth ?? null;
    if (!data || balance === null) {
      return {
        cutoffValue,
        actualValue: '',
        relevantInputs: 'bank_analysis_average_balance=null',
        decision: BreDecision.REJECT,
      };
    }
    const decision = balance >= 10000 ? BreDecision.APPROVE : BreDecision.REFER;
    return {
      cutoffValue,
      actualValue: `${balance}`,
      relevantInputs: `bank_analysis_average_balance=${balance}`,
      decision,
    };
  }

  private bankStatementFraudScore(
    data: ReturnType<BreEvaluationService['parseBankAnalysisData']>,
  ): RuleOutcome {
    const cutoffValue = 'Fraud Score <= 0';
    const score = data?.fraudScore ?? null;
    if (!data || score === null) {
      return {
        cutoffValue,
        actualValue: '',
        relevantInputs: 'bank_analysis_fraud_score=null',
        decision: BreDecision.REJECT,
      };
    }
    return {
      cutoffValue,
      actualValue: `Fraud Score ${score <= 0 ? '<= 0' : '> 0'}`,
      relevantInputs: `bank_analysis_fraud_score=${score}`,
      decision: score <= 0 ? BreDecision.APPROVE : BreDecision.REFER,
    };
  }

  /** Ports `bank_statement_account_rule` — matches the last 4 digits of
   * the CartBI-reported account number against the lead's on-file
   * `CustomerBanking.accountNumber`, same as legacy's `substr(...,-4,4)`
   * comparison. */
  private bankStatementAccountMatch(
    data: ReturnType<BreEvaluationService['parseBankAnalysisData']>,
    customerBanking: CustomerBanking | null,
  ): RuleOutcome {
    const cutoffValue = 'Bank Statement & Bank Account Match => Yes';
    if (!data?.accountNumber) {
      return {
        cutoffValue,
        actualValue: '',
        relevantInputs: `bank_analysis_account_no=null,bank_account_number=${customerBanking?.accountNumber ?? 'null'}`,
        decision: NOT_APPLICABLE,
      };
    }
    if (!customerBanking?.accountNumber) {
      return {
        cutoffValue,
        actualValue: 'Bank Statement & Bank Account Match => No',
        relevantInputs: `bank_analysis_account_no=${data.accountNumber},bank_account_number=null`,
        decision: BreDecision.REFER,
      };
    }
    const matches =
      data.accountNumber.slice(-4) === customerBanking.accountNumber.slice(-4);
    return {
      cutoffValue,
      actualValue: `Bank Statement & Bank Account Match => ${matches ? 'Yes' : 'No'}`,
      relevantInputs: `bank_analysis_account_no=${data.accountNumber},bank_account_number=${customerBanking.accountNumber}`,
      decision: matches ? BreDecision.APPROVE : BreDecision.REFER,
    };
  }

  /**
   * Parses `AccountAggregatorLog.responsePayload` for the latest
   * successful `FI_FETCH_DATA` row (either provider — both `LEGACY` and
   * `NOVEL_PATTERN` are confirmed live in production simultaneously, so
   * this reads whichever fired most recently for the lead). Branches on
   * `log.provider` since the two flows store genuinely different response
   * envelopes:
   * - `NOVEL_PATTERN`: `{data: [{ifscCode, accountName, bankFullName,
   *   camAnalysisData: {minBalanceLastThreeMonth}}]}` — confirmed via a
   *   real production report sample, not guessed.
   * - `LEGACY`: `{result: {body: [{fiObjects: [{Summary: {ifscCode,
   *   currentBalance}, Profile: {Holders: {Holder: {name}}}}]}]}}`
   *   (Finvu's raw shape) — confirmed via `AAController.php`'s own field
   *   access in `createBankStatement_from_fiData()`/`bre_rule_engine.php`.
   *
   * Legacy has no `bankFullName`/`fipName` equivalent in the `LEGACY`
   * (Finvu) shape's `fiObjects` structure read here — `bankName` is left
   * `null` for that branch, matching the `!empty($aa_fipName)` guard in
   * `bre_rule_engine.php`'s own `else` branch (Finvu path), which never
   * actually assigns `$aa_fipName` either.
   */
  private parseAccountAggregatorData(log: AccountAggregatorLog | null): {
    accountHolderName: string | null;
    ifscCode: string | null;
    bankName: string | null;
    currentBalance: number | null;
  } | null {
    if (!log?.responsePayload) return null;
    try {
      if (log.provider === AccountAggregatorProvider.NOVEL_PATTERN) {
        const parsed = JSON.parse(log.responsePayload) as {
          data?: Array<{
            ifscCode?: string | null;
            accountName?: string | null;
            bankFullName?: string | null;
            camAnalysisData?: { minBalanceLastThreeMonth?: number };
          }>;
        };
        const first = parsed.data?.[0];
        if (!first) return null;
        return {
          accountHolderName: first.accountName?.trim().toUpperCase() ?? null,
          ifscCode: first.ifscCode?.trim().toUpperCase() ?? null,
          bankName: first.bankFullName?.trim().toUpperCase() ?? null,
          currentBalance:
            first.camAnalysisData?.minBalanceLastThreeMonth ?? null,
        };
      }

      const parsed = JSON.parse(log.responsePayload) as {
        result?: {
          body?: Array<{
            fiObjects?: Array<{
              Summary?: { currentBalance?: number; ifscCode?: string };
              Profile?: { Holders?: { Holder?: { name?: string } } };
            }>;
          }>;
        };
      };
      const fiObject = parsed.result?.body?.[0]?.fiObjects?.[0];
      if (!fiObject) return null;
      return {
        accountHolderName:
          fiObject.Profile?.Holders?.Holder?.name?.trim().toUpperCase() ?? null,
        ifscCode: fiObject.Summary?.ifscCode?.trim().toUpperCase() ?? null,
        bankName: null,
        currentBalance: fiObject.Summary?.currentBalance ?? null,
      };
    } catch {
      return null;
    }
  }

  /**
   * Ports the "Account Aggregator" rule from `bre_rule_engine()` (rule id
   * 39) — compares the AA-fetched account details against the customer's
   * own declared bank account (`CustomerBanking.ifscCode`/
   * `beneficiaryName`).
   *
   * Legacy's real 3-branch decision logic, ported faithfully including
   * its own bug: the mismatch branch compares `$aa_fipName` (the AA
   * response's *bank name*) against `$beneficiary_name` (the customer's
   * own name) — clearly meant to compare account-holder *name* against
   * *name*, not bank name against name. Not silently corrected here,
   * same "documented, not fixed without a business call" convention as
   * `LeadRejectionService`/`ApplicationHoldRedistributionService`'s own
   * ported legacy bugs.
   */
  private accountAggregator(
    log: AccountAggregatorLog | null,
    customerBanking: CustomerBanking | null,
  ): RuleOutcome {
    const cutoffValue = 'Account Details Matched';
    const data = this.parseAccountAggregatorData(log);
    const relevantInputs = `aa_name=${data?.accountHolderName ?? 'null'},aa_bank_name=${data?.bankName ?? 'null'},aa_ifsc_code=${data?.ifscCode ?? 'null'},aa_current_balance=${data?.currentBalance ?? 'null'},declared_ifsc_code=${customerBanking?.ifscCode ?? 'null'},declared_beneficiary_name=${customerBanking?.beneficiaryName ?? 'null'}`;

    if (!data || !customerBanking) {
      return {
        cutoffValue,
        actualValue: '',
        relevantInputs,
        decision: NOT_APPLICABLE,
      };
    }

    const declaredIfsc = customerBanking.ifscCode?.trim().toUpperCase() ?? null;
    const declaredName =
      customerBanking.beneficiaryName?.trim().toUpperCase() ?? null;

    if (
      data.ifscCode &&
      data.bankName &&
      data.currentBalance != null &&
      data.ifscCode === declaredIfsc &&
      data.accountHolderName === declaredName
    ) {
      return {
        cutoffValue,
        actualValue: 'Account details matched',
        relevantInputs,
        decision: BreDecision.APPROVE,
      };
    }
    if (data.ifscCode && data.ifscCode !== declaredIfsc) {
      return {
        cutoffValue,
        actualValue: 'IFSC Code does not match',
        relevantInputs,
        decision: BreDecision.REFER,
      };
    }
    if (data.bankName && data.bankName !== declaredName) {
      return {
        cutoffValue,
        actualValue: 'Beneficiary Name does not match',
        relevantInputs,
        decision: BreDecision.REFER,
      };
    }
    return {
      cutoffValue,
      actualValue: '',
      relevantInputs,
      decision: NOT_APPLICABLE,
    };
  }

  /**
   * Ports `bank_acc_verification_rule` — Signzy penny-drop
   * (`BankVerificationLog.response.result.active`/`.nameMatch`, confirmed
   * live shape via `BankVerificationService`). Legacy's
   * `!in_array($lead_data_source_id, array(32))` exemption (a specific
   * data-source id skips this check) isn't ported — no confirmed mapping
   * for legacy data source id 32 in this schema's seeded `data-sources.json`.
   */
  private bankAccountVerification(
    log: BankVerificationLog | null,
    hasBankAccountOnFile: boolean,
  ): RuleOutcome {
    const cutoffValue = 'Bank Account Verification => Yes & Name Match => Yes';
    if (!log?.response) {
      return {
        cutoffValue,
        actualValue: '',
        relevantInputs: `bank_account_verification=null,has_bank_account_on_file=${hasBankAccountOnFile}`,
        decision: hasBankAccountOnFile ? BreDecision.REJECT : NOT_APPLICABLE,
      };
    }
    let active = false;
    let nameMatch = false;
    try {
      const parsed = JSON.parse(log.response) as {
        result?: { active?: string; nameMatch?: string };
      };
      active = parsed.result?.active?.toUpperCase() === 'YES';
      nameMatch = parsed.result?.nameMatch?.toUpperCase() === 'YES';
    } catch {
      // fall through with active=false, nameMatch=false
    }
    const decision =
      active && nameMatch
        ? BreDecision.APPROVE
        : active
          ? BreDecision.REFER
          : BreDecision.REJECT;
    return {
      cutoffValue,
      actualValue: `Bank Account Verification=${active ? 'Yes' : 'No'}, Name Match=${nameMatch ? 'Yes' : 'No'}`,
      relevantInputs: `bank_account_status=${active},bank_account_name_match_status=${nameMatch}`,
      decision,
    };
  }

  /**
   * Ports `bre_quote_engine()`'s city-category x salary-band FOIR-percent
   * table (hardcoded PHP, not a DB lookup table — nothing was "missing"
   * here, an earlier pass hadn't read this far into the file). Legacy's
   * third sub-branch per band (`office_email AND residence_type` both
   * present) is unreachable dead code — the preceding `office_email OR
   * residence_type` branch already wins the `else if` chain for that same
   * input, so this port only models two tiers per band (both absent vs.
   * at least one present).
   */
  private eligibleFoirPercent(
    category: string | null,
    monthlySalary: number,
    atLeastOnePresent: boolean,
  ): number {
    if (category === 'A') {
      if (monthlySalary >= 50000) return atLeastOnePresent ? 0.75 : 0.7;
      if (monthlySalary >= 30000) return atLeastOnePresent ? 0.65 : 0.6;
      if (monthlySalary >= 15000) return atLeastOnePresent ? 0.55 : 0.5;
      return 0;
    }
    if (category === 'B') {
      if (monthlySalary >= 50000) return atLeastOnePresent ? 0.8 : 0.75;
      if (monthlySalary >= 30000) return atLeastOnePresent ? 0.7 : 0.65;
      if (monthlySalary >= 15000) return atLeastOnePresent ? 0.6 : 0.55;
      if (monthlySalary >= 10000) return atLeastOnePresent ? 0.5 : 0.45;
      return 0;
    }
    return 0;
  }

  private eligibleLoanAmount(
    cam: CreditAnalysisMemo | null,
    lead: Lead,
    customer: LeadCustomer | null,
    employment: LeadEmployment | null,
  ): RuleOutcome {
    const monthlySalary =
      cam?.appraisedMonthlyIncome ?? employment?.monthlyIncome ?? 0;
    const obligations = lead.obligations ?? 0;
    const atLeastOnePresent = Boolean(
      customer?.alternateEmail || customer?.currentResidenceType,
    );
    const foirPercent = this.eligibleFoirPercent(
      lead.city?.category ?? null,
      Number(monthlySalary),
      atLeastOnePresent,
    );
    const maxLoanAmount = Math.round(
      (Number(monthlySalary) - Number(obligations)) * foirPercent,
    );
    const cutoffValue = `Eligible Loan Amount => ${maxLoanAmount}`;

    const recommended = cam?.recommendedLoanAmount ?? null;
    if (!recommended) {
      return {
        cutoffValue,
        actualValue: '',
        relevantInputs: `recommend_loan_amount=null,max_loan_amount=${maxLoanAmount}`,
        decision: BreDecision.REJECT,
      };
    }
    const withinLimit = Number(recommended) <= maxLoanAmount;
    return {
      cutoffValue,
      actualValue: withinLimit
        ? 'Recommend Loan Amount <= Eligible Loan Amount'
        : 'Recommend Loan Amount > Eligible Loan Amount',
      relevantInputs: `recommend_loan_amount=${recommended},max_loan_amount=${maxLoanAmount}`,
      decision: withinLimit ? BreDecision.APPROVE : BreDecision.REJECT,
    };
  }

  /** `bre_quote_engine()` hardcodes `max_loan_tenure => 40` in its return
   * array regardless of any per-lead input — this rule is effectively a
   * flat 40-day cap, not city/salary-dependent like the loan-amount rule. */
  private eligibleLoanTenure(cam: CreditAnalysisMemo | null): RuleOutcome {
    const maxLoanTenure = 40;
    const cutoffValue = `Eligible Loan Tenure => ${maxLoanTenure}`;
    const recommended = cam?.tenureDays ?? null;
    if (!recommended) {
      return {
        cutoffValue,
        actualValue: '',
        relevantInputs: 'recommend_loan_tenure=null',
        decision: BreDecision.REJECT,
      };
    }
    const withinLimit = recommended <= maxLoanTenure;
    return {
      cutoffValue,
      actualValue: withinLimit
        ? 'Recommend Loan Tenure <= Eligible Loan Tenure'
        : 'Recommend Loan Tenure > Eligible Loan Tenure',
      relevantInputs: `recommend_loan_tenure=${recommended}`,
      decision: withinLimit ? BreDecision.APPROVE : BreDecision.REJECT,
    };
  }
}
