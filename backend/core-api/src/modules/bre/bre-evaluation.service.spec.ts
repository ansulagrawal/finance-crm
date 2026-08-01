import {
  AccountAggregatorProvider,
  BreDecision,
  IncomeType,
  LeadUserType,
} from '@finance-crm/database';
import { BreEvaluationService } from './bre-evaluation.service';

function repo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    findOneBy: jest.fn().mockResolvedValue(null),
    count: jest.fn().mockResolvedValue(0),
    save: jest.fn(async (x: unknown) => x),
    create: jest.fn((x: unknown) => x),
    ...overrides,
  };
}

describe('BreEvaluationService', () => {
  let service: BreEvaluationService;
  let leadRepository: ReturnType<typeof repo>;
  let leadCustomerRepository: ReturnType<typeof repo>;
  let leadEmploymentRepository: ReturnType<typeof repo>;
  let camRepository: ReturnType<typeof repo>;
  let referenceRepository: ReturnType<typeof repo>;
  let loanRepository: ReturnType<typeof repo>;
  let breRuleRepository: ReturnType<typeof repo>;
  let breRuleResultRepository: ReturnType<typeof repo>;
  let crifBureauLogRepository: ReturnType<typeof repo>;
  let bankVerificationLogRepository: ReturnType<typeof repo>;
  let customerBankingRepository: ReturnType<typeof repo>;
  let bankAnalysisLogRepository: ReturnType<typeof repo>;
  let accountAggregatorLogRepository: ReturnType<typeof repo>;
  let isBlacklisted: jest.Mock;

  const eligibleLead = () => ({
    id: 1,
    pancard: 'ABCDE1234F',
    mobile: '9876543210',
    email: 'a@b.com',
    monthlySalaryAmount: 40000,
    userType: LeadUserType.NEW,
    city: { name: 'Delhi', isSourcing: true, category: 'A' },
    state: { name: 'Delhi', isSourcing: true },
  });

  beforeEach(() => {
    leadRepository = repo();
    leadCustomerRepository = repo();
    leadEmploymentRepository = repo();
    camRepository = repo();
    referenceRepository = repo();
    loanRepository = repo();
    breRuleRepository = repo();
    breRuleResultRepository = repo();
    isBlacklisted = jest.fn().mockResolvedValue(false);

    leadRepository.findOneBy.mockResolvedValue(eligibleLead());
    leadRepository.findOne.mockResolvedValue(eligibleLead());
    leadCustomerRepository.findOne.mockResolvedValue({
      dob: '1995-01-01',
      mobileVerifiedStatus: 'YES',
      isAadhaarVerified: true,
      aadhaarNumber: '123412341234',
      isPancardVerified: true,
      alternateMobile: null,
      alternateEmail: null,
      firstName: 'Ramesh',
    });
    leadEmploymentRepository.findOne.mockResolvedValue({
      incomeType: IncomeType.SALARIED,
      salaryMode: 'BANK',
      monthlyIncome: 40000,
    });
    camRepository.findOne.mockResolvedValue({
      recommendedLoanAmount: 20000,
      tenureDays: 15,
      finalFoirPercentage: 30,
      appraisedMonthlyIncome: 40000,
    });
    referenceRepository.count.mockResolvedValue(2);
    loanRepository.findOne.mockResolvedValue(null);
    crifBureauLogRepository = repo();
    // `parseCrifReport` reads api1/api2/api3 response columns (latest step
    // first) -- the pre-rewrite entity had a single `response` field instead.
    crifBureauLogRepository.findOne.mockResolvedValue({
      cibilScore: '650',
      api3Response: JSON.stringify({
        data: {
          credit_report: {
            'ACCOUNTS-SUMMARY': {
              'PRIMARY-ACCOUNTS-SUMMARY': {
                'PRIMARY-OVERDUE-NUMBER-OF-ACCOUNTS': 0,
              },
            },
            'PERSONAL-INFO-VARIATION': {
              'PAN-VARIATIONS': { VARIATION: { VALUE: 'ABCDE1234F' } },
            },
            'INQUIRY-HISTORY': {
              HISTORY: { 'INQUIRY-DATE': '2020-01-01' },
            },
          },
        },
      }),
    });
    bankVerificationLogRepository = repo();
    bankVerificationLogRepository.findOne.mockResolvedValue({
      response: JSON.stringify({
        result: { active: 'YES', nameMatch: 'YES' },
      }),
    });
    customerBankingRepository = repo();
    customerBankingRepository.count.mockResolvedValue(1);
    customerBankingRepository.findOne.mockResolvedValue({
      accountNumber: '1234567890',
    });
    bankAnalysisLogRepository = repo();
    bankAnalysisLogRepository.findOne.mockResolvedValue({
      response: JSON.stringify({
        data: [
          {
            accountNumber: '0007890',
            ifscCode: 'ABCD0123456',
            fraudScore: 0,
            camAnalysisData: { averageBalanceLastSixMonth: 15000 },
          },
        ],
      }),
    });
    accountAggregatorLogRepository = repo();

    // Every rule name the service evaluates resolves to a matching BreRule row.
    const allRuleNames = [
      'Age Criteria',
      'Employment Type',
      'Salary Mode',
      'Location Criteria',
      'Salary Criteria with City Category',
      'Customer Mobile OTP',
      'Aadhaar EKYC Verification',
      'PAN NSDL Verification',
      'Min and Max loan amount',
      'Min and Max Loan Tenure',
      'Customer Reference Available',
      'Active Loan',
      'Blacklisted Customer',
      'Final FOIR Percentage',
      'Banking Document',
      'Bank Account Verification',
      'Bank Statement & Bank Account Match (API)',
      'Current Employment Experience',
      'Bank Statement Average Monthly Balance',
      'Pincode Matching',
      'Eligible Loan Amount',
      'Eligible Loan Tenure',
      'Bank Statement Fraud Score',
      'SCORE',
      'Overdue Accounts',
      'ID Variation (PAN)',
      'Inquiries in last 30 days',
      'Account Aggregator',
    ];
    breRuleRepository.find.mockResolvedValue(
      allRuleNames.map((name, i) => ({ id: i + 1, name })),
    );

    service = new BreEvaluationService(
      leadRepository as never,
      leadCustomerRepository as never,
      leadEmploymentRepository as never,
      camRepository as never,
      referenceRepository as never,
      loanRepository as never,
      breRuleRepository as never,
      breRuleResultRepository as never,
      crifBureauLogRepository as never,
      bankVerificationLogRepository as never,
      customerBankingRepository as never,
      bankAnalysisLogRepository as never,
      accountAggregatorLogRepository as never,
      { isBlacklisted } as never,
    );
  });

  it('approves an eligible lead overall', async () => {
    const summary = await service.evaluate(1);

    expect(summary.overallDecision).toBe(BreDecision.APPROVE);
    const ageResult = summary.results.find(
      (r) => r.rule.name === 'Age Criteria',
    );
    expect(ageResult?.systemDecision).toBe(BreDecision.APPROVE);
  });

  it('produces NOT_APPLICABLE results (not persisted as pass/fail) for genuinely blocked rules', async () => {
    const summary = await service.evaluate(1);

    const result = summary.results.find(
      (r) => r.rule.name === 'Current Employment Experience',
    );
    // `BreDecision` (1/2/3) has no NOT_APPLICABLE member -- the service
    // reuses the entity column's own "not decided" sentinel, plain 0.
    expect(result?.systemDecision).toBe(0);
    expect(result?.relevantInputs).toContain('blocked:');
  });

  it('Account Aggregator: NOT_APPLICABLE when no successful FI_FETCH_DATA log exists', async () => {
    const summary = await service.evaluate(1);

    const aaResult = summary.results.find(
      (r) => r.rule.name === 'Account Aggregator',
    );
    expect(aaResult?.systemDecision).toBe(0);
  });

  it('Account Aggregator: APPROVEs when NOVEL_PATTERN data matches the declared bank account', async () => {
    customerBankingRepository.findOne.mockResolvedValue({
      accountNumber: '1234567890',
      ifscCode: 'icic0001234',
      beneficiaryName: 'raj ratan',
    });
    accountAggregatorLogRepository.findOne.mockResolvedValue({
      provider: AccountAggregatorProvider.NOVEL_PATTERN,
      responsePayload: JSON.stringify({
        data: [
          {
            ifscCode: 'ICIC0001234',
            accountName: 'Raj Ratan',
            bankFullName: 'ICICI Bank Ltd',
            camAnalysisData: { minBalanceLastThreeMonth: 0.01 },
          },
        ],
      }),
    });

    const summary = await service.evaluate(1);

    const aaResult = summary.results.find(
      (r) => r.rule.name === 'Account Aggregator',
    );
    expect(aaResult?.systemDecision).toBe(BreDecision.APPROVE);
    expect(aaResult?.actualValue).toBe('Account details matched');
  });

  it('Account Aggregator: REFERs on IFSC mismatch', async () => {
    customerBankingRepository.findOne.mockResolvedValue({
      accountNumber: '1234567890',
      ifscCode: 'HDFC0000001',
      beneficiaryName: 'raj ratan',
    });
    accountAggregatorLogRepository.findOne.mockResolvedValue({
      provider: AccountAggregatorProvider.NOVEL_PATTERN,
      responsePayload: JSON.stringify({
        data: [
          {
            ifscCode: 'ICIC0001234',
            accountName: 'Raj Ratan',
            bankFullName: 'ICICI Bank Ltd',
            camAnalysisData: { minBalanceLastThreeMonth: 0.01 },
          },
        ],
      }),
    });

    const summary = await service.evaluate(1);

    const aaResult = summary.results.find(
      (r) => r.rule.name === 'Account Aggregator',
    );
    expect(aaResult?.systemDecision).toBe(BreDecision.REFER);
    expect(aaResult?.actualValue).toBe('IFSC Code does not match');
  });

  it('computes real bureau/bank-verification rule results, not NOT_APPLICABLE', async () => {
    const summary = await service.evaluate(1);

    const scoreResult = summary.results.find((r) => r.rule.name === 'SCORE');
    expect(scoreResult?.systemDecision).toBe(BreDecision.APPROVE);

    const bankAccountResult = summary.results.find(
      (r) => r.rule.name === 'Bank Account Verification',
    );
    expect(bankAccountResult?.systemDecision).toBe(BreDecision.APPROVE);

    const eligibleAmountResult = summary.results.find(
      (r) => r.rule.name === 'Eligible Loan Amount',
    );
    expect(eligibleAmountResult?.systemDecision).toBe(BreDecision.APPROVE);
  });

  it('computes real CartBI bank-analysis rule results', async () => {
    const summary = await service.evaluate(1);

    const bankingDocResult = summary.results.find(
      (r) => r.rule.name === 'Banking Document',
    );
    expect(bankingDocResult?.systemDecision).toBe(BreDecision.APPROVE);

    const avgBalanceResult = summary.results.find(
      (r) => r.rule.name === 'Bank Statement Average Monthly Balance',
    );
    expect(avgBalanceResult?.systemDecision).toBe(BreDecision.APPROVE);

    const fraudScoreResult = summary.results.find(
      (r) => r.rule.name === 'Bank Statement Fraud Score',
    );
    expect(fraudScoreResult?.systemDecision).toBe(BreDecision.APPROVE);

    const accountMatchResult = summary.results.find(
      (r) => r.rule.name === 'Bank Statement & Bank Account Match (API)',
    );
    expect(accountMatchResult?.systemDecision).toBe(BreDecision.APPROVE);
  });

  it('rejects Banking Document when no CartBI download log exists', async () => {
    bankAnalysisLogRepository.findOne.mockResolvedValue(null);

    const summary = await service.evaluate(1);

    const bankingDocResult = summary.results.find(
      (r) => r.rule.name === 'Banking Document',
    );
    expect(bankingDocResult?.systemDecision).toBe(BreDecision.REJECT);
  });

  it('never produces a result for rules legacy itself never evaluates', async () => {
    const summary = await service.evaluate(1);

    const names = summary.results.map((r) => r.rule.name);
    expect(names).not.toContain('Current Residence Type');
    expect(names).not.toContain('Internal Dedupe');
    expect(names).not.toContain('DOB Verification');
  });

  it('rejects overall when any rule rejects', async () => {
    leadEmploymentRepository.findOne.mockResolvedValue({
      incomeType: IncomeType.SELF_EMPLOYED,
      salaryMode: 'BANK',
    });

    const summary = await service.evaluate(1);

    expect(summary.overallDecision).toBe(BreDecision.REJECT);
  });

  it('rejects on an active loan elsewhere for the same pancard', async () => {
    // `Loan.status` is a free-string lifecycle label, not a LoanStatus enum.
    loanRepository.findOne.mockResolvedValue({
      id: 5,
      status: 'DISBURSED',
    });

    const summary = await service.evaluate(1);

    const activeLoanResult = summary.results.find(
      (r) => r.rule.name === 'Active Loan',
    );
    expect(activeLoanResult?.systemDecision).toBe(BreDecision.REJECT);
  });

  it('applies the REPEAT FOIR ceiling (strictly < 50%) vs NEW (<= 45%)', async () => {
    leadRepository.findOne.mockResolvedValue({
      ...eligibleLead(),
      userType: LeadUserType.REPEAT,
    });
    camRepository.findOne.mockResolvedValue({
      recommendedLoanAmount: 20000,
      tenureDays: 15,
      finalFoirPercentage: 48,
    });

    const summary = await service.evaluate(1);

    const foirResult = summary.results.find(
      (r) => r.rule.name === 'Final FOIR Percentage',
    );
    expect(foirResult?.systemDecision).toBe(BreDecision.APPROVE);
  });
});
