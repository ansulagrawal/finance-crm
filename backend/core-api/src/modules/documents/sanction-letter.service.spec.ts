import { PDF_RENDERER, STORAGE_ADAPTER } from '@finance-crm/common';
import {
  CamStatus,
  CreditAnalysisMemo,
  CustomerBanking,
  Gender,
  Lead,
  LeadCustomer,
  Loan,
} from '@finance-crm/database';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SanctionLetterService } from './sanction-letter.service';

function repo(overrides: Record<string, jest.Mock> = {}) {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    findOneBy: jest.fn().mockResolvedValue(null),
    save: jest.fn(async (x: unknown) => x),
    ...overrides,
  };
}

describe('SanctionLetterService', () => {
  let service: SanctionLetterService;
  let camRepository: ReturnType<typeof repo>;
  let leadRepository: ReturnType<typeof repo>;
  let leadCustomerRepository: ReturnType<typeof repo>;
  let customerBankingRepository: ReturnType<typeof repo>;
  let loanRepository: ReturnType<typeof repo>;
  let pdfRenderer: { renderHtmlToPdf: jest.Mock };
  let storageAdapter: { upload: jest.Mock };

  const lead = {
    id: 1,
    firstName: 'Ramesh',
    applicationNo: 'APP-1',
    pancard: 'ABCDE1234F',
  };

  beforeEach(async () => {
    camRepository = repo();
    leadRepository = repo({ findOne: jest.fn().mockResolvedValue(lead) });
    leadCustomerRepository = repo();
    customerBankingRepository = repo();
    loanRepository = repo();
    pdfRenderer = {
      renderHtmlToPdf: jest.fn().mockResolvedValue(Buffer.from('pdf-bytes')),
    };
    storageAdapter = {
      upload: jest
        .fn()
        .mockResolvedValue({ key: 'sanction-letters/x.pdf', url: 'http://x' }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SanctionLetterService,
        {
          provide: getRepositoryToken(CreditAnalysisMemo),
          useValue: camRepository,
        },
        { provide: getRepositoryToken(Lead), useValue: leadRepository },
        {
          provide: getRepositoryToken(LeadCustomer),
          useValue: leadCustomerRepository,
        },
        {
          provide: getRepositoryToken(CustomerBanking),
          useValue: customerBankingRepository,
        },
        { provide: getRepositoryToken(Loan), useValue: loanRepository },
        { provide: PDF_RENDERER, useValue: pdfRenderer },
        { provide: STORAGE_ADAPTER, useValue: storageAdapter },
      ],
    }).compile();

    service = moduleRef.get(SanctionLetterService);
  });

  it('404s when the lead does not exist', async () => {
    leadRepository.findOne.mockResolvedValue(null);
    await expect(service.generate(404)).rejects.toThrow(NotFoundException);
  });

  it('rejects when no CAM exists yet for the lead', async () => {
    camRepository.findOne.mockResolvedValue(null);
    await expect(service.generate(1)).rejects.toThrow(ConflictException);
  });

  it('rejects when the CAM is not yet sanctioned', async () => {
    camRepository.findOne.mockResolvedValue({ status: CamStatus.DRAFT });
    await expect(service.generate(1)).rejects.toThrow(ConflictException);
  });

  it('serves the already-stored letter instead of re-rendering', async () => {
    camRepository.findOne.mockResolvedValue({
      status: CamStatus.SANCTION,
      sanctionLetterFileName: 'sanction-letters/lead-1-1690000000000.pdf',
    });
    (storageAdapter as { download?: jest.Mock }).download = jest
      .fn()
      .mockResolvedValue(Buffer.from('stored-pdf-bytes'));

    const pdf = await service.generate(1);

    expect(pdf).toEqual(Buffer.from('stored-pdf-bytes'));
    expect(storageAdapter.download).toHaveBeenCalledWith(
      'sanction-letters/lead-1-1690000000000.pdf',
    );
    expect(pdfRenderer.renderHtmlToPdf).not.toHaveBeenCalled();
    expect(storageAdapter.upload).not.toHaveBeenCalled();
  });

  it('renders, uploads, and persists the storage key on a sanctioned CAM', async () => {
    const cam = {
      status: CamStatus.SANCTION,
      recommendedLoanAmount: 10000,
      tenureDays: 30,
      repaymentAmount: 11000,
      repaymentDate: '2026-08-26',
      netDisbursalAmount: 9000,
      disbursalDate: '2026-07-27',
      roi: 0.1,
      adminFee: 1000,
      sanctionedAt: '2026-07-27',
    };
    camRepository.findOne.mockResolvedValue(cam);
    leadCustomerRepository.findOne.mockResolvedValue({
      firstName: 'Ramesh',
      surName: 'Kumar',
      fatherName: 'Suresh Kumar',
      gender: Gender.MALE,
      pancard: 'ABCDE1234F',
      currentAddressLine1: '123 Main St',
    });
    customerBankingRepository.findOne.mockResolvedValue({
      accountNumber: '123456789',
      ifscCode: 'ICIC0001234',
    });
    loanRepository.findOne.mockResolvedValue({ loanNumber: 'LN-1' });

    const pdf = await service.generate(1);

    expect(pdf).toEqual(Buffer.from('pdf-bytes'));
    expect(pdfRenderer.renderHtmlToPdf).toHaveBeenCalledTimes(1);
    const [html] = pdfRenderer.renderHtmlToPdf.mock.calls[0];
    expect(html).toContain('LN-1');
    expect(html).toContain('Ramesh Kumar');
    expect(html).toContain('Acme Leasing Finance Private Limited');

    expect(storageAdapter.upload).toHaveBeenCalledTimes(1);
    const [buffer, key, contentType] = storageAdapter.upload.mock.calls[0];
    expect(buffer).toEqual(Buffer.from('pdf-bytes'));
    expect(key).toMatch(/^sanction-letters\/lead-1-\d+\.pdf$/);
    expect(contentType).toBe('application/pdf');

    expect(camRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ sanctionLetterFileName: key }),
    );
  });

  it("uses the lead's company branding and embeds its logo when present", async () => {
    leadRepository.findOne.mockResolvedValue({
      ...lead,
      company: {
        name: 'Acme Lending Pvt Ltd',
        cin: 'U12345DL2020PTC000001',
        address: '1 Acme Road, Delhi',
        logoFileKey: 'logos/acme.png',
      },
    });
    (storageAdapter as { download?: jest.Mock }).download = jest
      .fn()
      .mockResolvedValue(Buffer.from('fake-png-bytes'));
    camRepository.findOne.mockResolvedValue({
      status: CamStatus.SANCTION,
      recommendedLoanAmount: 10000,
      tenureDays: 30,
      repaymentAmount: 11000,
      repaymentDate: '2026-08-26',
      netDisbursalAmount: 9000,
      disbursalDate: '2026-07-27',
      roi: 0.1,
      adminFee: 1000,
      sanctionedAt: '2026-07-27',
    });

    await service.generate(1);

    const [html] = pdfRenderer.renderHtmlToPdf.mock.calls[0];
    expect(html).toContain('Acme Lending Pvt Ltd');
    expect(html).toContain('U12345DL2020PTC000001');
    expect(html).toContain('1 Acme Road, Delhi');
    expect(html).toContain('data:image/png;base64,');
  });
});
