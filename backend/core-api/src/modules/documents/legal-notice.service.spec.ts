import { PDF_RENDERER } from '@finance-crm/common';
import {
  Collection,
  CreditAnalysisMemo,
  Lead,
  LeadCustomer,
  Loan,
} from '@finance-crm/database';
import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LegalNoticeService } from './legal-notice.service';

function repo(overrides: Record<string, jest.Mock> = {}) {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    findOneBy: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe('LegalNoticeService', () => {
  let service: LegalNoticeService;
  let camRepository: ReturnType<typeof repo>;
  let leadRepository: ReturnType<typeof repo>;
  let loanRepository: ReturnType<typeof repo>;
  let leadCustomerRepository: ReturnType<typeof repo>;
  let collectionRepository: ReturnType<typeof repo>;
  let pdfRenderer: { renderHtmlToPdf: jest.Mock };

  const lead = { id: 1, firstName: 'Ramesh', applicationNo: 'APP-1' };

  beforeEach(async () => {
    camRepository = repo();
    leadRepository = repo({ findOneBy: jest.fn().mockResolvedValue(lead) });
    loanRepository = repo();
    leadCustomerRepository = repo();
    collectionRepository = repo();
    pdfRenderer = {
      renderHtmlToPdf: jest.fn().mockResolvedValue(Buffer.from('pdf-bytes')),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        LegalNoticeService,
        { provide: getRepositoryToken(Lead), useValue: leadRepository },
        {
          provide: getRepositoryToken(CreditAnalysisMemo),
          useValue: camRepository,
        },
        { provide: getRepositoryToken(Loan), useValue: loanRepository },
        {
          provide: getRepositoryToken(LeadCustomer),
          useValue: leadCustomerRepository,
        },
        {
          provide: getRepositoryToken(Collection),
          useValue: collectionRepository,
        },
        { provide: PDF_RENDERER, useValue: pdfRenderer },
      ],
    }).compile();

    service = moduleRef.get(LegalNoticeService);
  });

  it('renders the placeholder legal notice net of verified collections received', async () => {
    camRepository.findOne.mockResolvedValue({
      repaymentAmount: 10500,
      repaymentDate: '2026-07-01',
    });
    loanRepository.findOne.mockResolvedValue({ loanNumber: 'LN-1' });
    collectionRepository.find.mockResolvedValue([{ receivedAmount: 500 }]);

    const result = await service.generate(1);

    expect(result).toEqual(Buffer.from('pdf-bytes'));
    const [html] = pdfRenderer.renderHtmlToPdf.mock.calls[0];
    expect(html).toContain('NOT REVIEWED BY LEGAL COUNSEL');
    expect(html).toContain('LN-1');
    expect(html).toContain('10,000.00'); // 10500 - 500
  });

  it('throws ConflictException when no CAM exists yet for the lead', async () => {
    camRepository.findOne.mockResolvedValue(null);
    await expect(service.generate(1)).rejects.toThrow(ConflictException);
  });
});
