import { PDF_RENDERER } from '@finance-crm/common';
import { CreditAnalysisMemo, Lead } from '@finance-crm/database';
import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConsentFormService } from './consent-form.service';

function repo(overrides: Record<string, jest.Mock> = {}) {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    findOneBy: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe('ConsentFormService', () => {
  let service: ConsentFormService;
  let camRepository: ReturnType<typeof repo>;
  let leadRepository: ReturnType<typeof repo>;
  let pdfRenderer: { renderHtmlToPdf: jest.Mock };

  const lead = { id: 1, firstName: 'Ramesh' };

  beforeEach(async () => {
    camRepository = repo();
    leadRepository = repo({ findOneBy: jest.fn().mockResolvedValue(lead) });
    pdfRenderer = {
      renderHtmlToPdf: jest.fn().mockResolvedValue(Buffer.from('pdf-bytes')),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ConsentFormService,
        {
          provide: getRepositoryToken(CreditAnalysisMemo),
          useValue: camRepository,
        },
        { provide: getRepositoryToken(Lead), useValue: leadRepository },
        { provide: PDF_RENDERER, useValue: pdfRenderer },
      ],
    }).compile();

    service = moduleRef.get(ConsentFormService);
  });

  it('renders the consent form from the CAM terms and returns the PDF bytes', async () => {
    camRepository.findOne.mockResolvedValue({
      recommendedLoanAmount: 50000,
      roi: 0.1,
      tenureDays: 30,
      adminFee: 500,
      netDisbursalAmount: 49500,
      repaymentAmount: 51500,
    });

    const result = await service.generate(1);

    expect(result).toEqual(Buffer.from('pdf-bytes'));
    expect(pdfRenderer.renderHtmlToPdf).toHaveBeenCalledWith(
      expect.stringContaining('Ramesh'),
    );
  });

  it('throws ConflictException when no CAM exists yet for the lead', async () => {
    camRepository.findOne.mockResolvedValue(null);
    await expect(service.generate(1)).rejects.toThrow(ConflictException);
  });
});
